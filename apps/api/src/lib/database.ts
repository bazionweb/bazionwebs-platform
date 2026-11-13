import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "@bazion/database";
import { currentDatabaseSchemaVersion, requiredDatabaseMigrations } from "@bazion/database";

/** Shared-tier data pool and control-plane lookups only. Tenant business data must use withTenantTransaction. */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

const tenantDirectoryPool = new Pool({
  connectionString: process.env.TENANT_RESOLVER_DATABASE_URL,
  max: 4,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

let tenantBackupPool: Pool | undefined;

function getTenantBackupPool(): Pool {
  if (tenantBackupPool) return tenantBackupPool;
  const connectionString = process.env.TENANT_BACKUP_DATABASE_URL?.trim();
  if (!connectionString) throw routingError("TENANT_BACKUP_DATABASE_NOT_CONFIGURED");
  tenantBackupPool = new Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: "bazion-tenant-backup",
  });
  return tenantBackupPool;
}


function createDatabase(connectionPool: Pool) {
  return drizzle(connectionPool, { schema });
}

export const db = createDatabase(pool);
export type TenantTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type TenantDatabase = typeof db;

type ResolvedBinding = {
  tenantId: string;
  tenantStatus: string;
  tier: "shared" | "dedicated";
  state: "shared" | "provisioning" | "ready" | "failed" | "draining";
  runtimeSecretRef: string | null;
  schemaVersion: string | null;
};

/** Provider-neutral hook: the API bootstrap installs the production secret adapter. */
export interface TenantDatabaseSecretResolver {
  resolveDatabaseUrl(secretReference: string, tenantId: string): Promise<string>;
}

const localEnvironmentSecretResolver: TenantDatabaseSecretResolver = {
  async resolveDatabaseUrl(secretReference) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Production secret-manager adapter is not configured.");
    }
    const match = /^env:\/\/(TENANT_DATABASE_[A-Z0-9_]+)$/.exec(secretReference);
    const secretName = match?.[1];
    if (!secretName) throw new Error("Unsupported local database secret reference.");
    const connectionString = process.env[secretName];
    if (!connectionString) throw new Error("Local tenant database secret is not configured.");
    return connectionString;
  },
};

let secretResolver = localEnvironmentSecretResolver;

/** Install this before the server starts accepting requests when a managed secret adapter is available. */
export function configureTenantDatabaseSecretResolver(resolver: TenantDatabaseSecretResolver): void {
  secretResolver = resolver;
}

const BINDING_CACHE_TTL_MS = 5_000;
const MAX_BINDING_CACHE_ENTRIES = 2_048;
const DEDICATED_POOL_IDLE_TTL_MS = 5 * 60_000;
const MAX_DEDICATED_POOLS_PER_PROCESS = 16;
const DEDICATED_POOL_MAX_CONNECTIONS = 3;

const bindingCache = new Map<string, { binding: ResolvedBinding; expiresAt: number }>();
const dedicatedPools = new Map<string, DedicatedPoolEntry>();
const allDedicatedPools = new Set<DedicatedPoolEntry>();
const pendingPools = new Map<string, Promise<DedicatedPoolEntry>>();

interface DedicatedPoolEntry {
  tenantId: string;
  secretReference: string;
  pool: Pool;
  database: TenantDatabase;
  lastUsedAt: number;
  activeTransactions: number;
  retired: boolean;
}

function routingError(code: string): Error & { code: string; statusCode: number } {
  return Object.assign(new Error(code), { code, statusCode: 503 });
}

async function resolveBinding(tenantId: string): Promise<ResolvedBinding> {
  const now = Date.now();
  const cached = bindingCache.get(tenantId);
  if (cached && cached.expiresAt > now) return cached.binding;
  if (cached) bindingCache.delete(tenantId);

  const result = await tenantDirectoryPool.query<{
    tenant_id: string;
    tenant_status: string;
    tier: "shared" | "dedicated" | null;
    state: ResolvedBinding["state"] | null;
    runtime_secret_ref: string | null;
    schema_version: string | null;
  }>(
    `SELECT t.id::text AS tenant_id, t.status AS tenant_status,
            b.tier, b.state, b.runtime_secret_ref, b.schema_version
       FROM public.tenants t
       LEFT JOIN public.tenant_database_bindings b ON b.tenant_id = t.id
      WHERE t.id = $1
      LIMIT 1`,
    [tenantId],
  );
  const row = result.rows[0];
  if (!row) throw routingError("TENANT_DATABASE_TENANT_NOT_FOUND");

  const binding: ResolvedBinding = {
    tenantId: row.tenant_id,
    tenantStatus: row.tenant_status,
    tier: row.tier ?? "shared",
    state: row.state ?? "shared",
    runtimeSecretRef: row.runtime_secret_ref,
    schemaVersion: row.schema_version,
  };
  if (bindingCache.size >= MAX_BINDING_CACHE_ENTRIES) {
    const oldestTenantId = bindingCache.keys().next().value;
    if (oldestTenantId) bindingCache.delete(oldestTenantId);
  }
  bindingCache.set(tenantId, { binding, expiresAt: now + BINDING_CACHE_TTL_MS });
  return binding;
}

function retirePool(entry: DedicatedPoolEntry): void {
  entry.retired = true;
  if (dedicatedPools.get(entry.tenantId) === entry) dedicatedPools.delete(entry.tenantId);
  if (entry.activeTransactions === 0) {
    allDedicatedPools.delete(entry);
    void entry.pool.end().catch(() => undefined);
  }
}

function reapIdlePools(now: number): void {
  for (const entry of allDedicatedPools) {
    if (entry.activeTransactions === 0 && now - entry.lastUsedAt >= DEDICATED_POOL_IDLE_TTL_MS) {
      retirePool(entry);
    }
  }
}

async function buildDedicatedPool(binding: ResolvedBinding, secretReference: string): Promise<DedicatedPoolEntry> {
  let connectionString: string;
  try {
    connectionString = await secretResolver.resolveDatabaseUrl(secretReference, binding.tenantId);
    const url = new URL(connectionString);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") throw new Error("Invalid database URL protocol.");
  } catch {
    throw routingError("TENANT_DATABASE_SECRET_UNAVAILABLE");
  }

  const dedicatedPool = new Pool({
    connectionString,
    max: DEDICATED_POOL_MAX_CONNECTIONS,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  try {
    const configuredSchemaVersion = process.env.TENANT_DATABASE_SCHEMA_VERSION?.trim();
    if ((configuredSchemaVersion && configuredSchemaVersion !== currentDatabaseSchemaVersion) ||
        binding.schemaVersion !== currentDatabaseSchemaVersion) {
      throw routingError("TENANT_DATABASE_SCHEMA_VERSION_MISMATCH");
    }
    const verification = await dedicatedPool.query<{
      tenant_count: number;
      matching_tenant_count: number;
      applied_migrations_count: number;
    }>(
      `SELECT count(*)::int AS tenant_count,
              count(*) FILTER (WHERE id = $1)::int AS matching_tenant_count,
              (SELECT count(*)::int FROM public.schema_migrations WHERE version = ANY($2::varchar[])) AS applied_migrations_count
         FROM public.tenants`,
      [binding.tenantId, requiredDatabaseMigrations],
    );
    const row = verification.rows[0];
    if (!row || row.tenant_count !== 1 || row.matching_tenant_count !== 1 ||
        row.applied_migrations_count !== requiredDatabaseMigrations.length) {
      throw routingError("TENANT_DATABASE_VERIFICATION_FAILED");
    }
  } catch (error) {
    await dedicatedPool.end().catch(() => undefined);
    if (error && typeof error === "object" && "code" in error && typeof error.code === "string" && error.code.startsWith("TENANT_DATABASE_")) {
      throw error;
    }
    throw routingError("TENANT_DATABASE_VERIFICATION_FAILED");
  }

  return {
    tenantId: binding.tenantId,
    secretReference,
    pool: dedicatedPool,
    database: createDatabase(dedicatedPool),
    lastUsedAt: Date.now(),
    activeTransactions: 0,
    retired: false,
  };
}

async function acquireDedicatedPool(binding: ResolvedBinding): Promise<{ database: TenantDatabase; release: () => void }> {
  const secretReference = binding.runtimeSecretRef;
  if (!secretReference) throw routingError("TENANT_DATABASE_BINDING_INCOMPLETE");

  const now = Date.now();
  reapIdlePools(now);
  const cached = dedicatedPools.get(binding.tenantId);
  if (cached && cached.secretReference === secretReference && !cached.retired) {
    cached.activeTransactions += 1;
    cached.lastUsedAt = now;
    return { database: cached.database, release: () => releaseDedicatedPool(cached) };
  }
  if (cached) retirePool(cached);

  let pending = pendingPools.get(binding.tenantId);
  if (!pending) {
    if (allDedicatedPools.size + pendingPools.size >= MAX_DEDICATED_POOLS_PER_PROCESS) {
      const oldestIdle = [...allDedicatedPools]
        .filter((entry) => entry.activeTransactions === 0)
        .sort((left, right) => left.lastUsedAt - right.lastUsedAt)[0];
      if (oldestIdle) retirePool(oldestIdle);
    }
    if (allDedicatedPools.size + pendingPools.size >= MAX_DEDICATED_POOLS_PER_PROCESS) {
      throw routingError("TENANT_DATABASE_POOL_CAPACITY_REACHED");
    }
    pending = Promise.resolve().then(() => buildDedicatedPool(binding, secretReference));
    pendingPools.set(binding.tenantId, pending);
    void pending.then((entry) => {
      pendingPools.delete(binding.tenantId);
      allDedicatedPools.add(entry);
      dedicatedPools.set(binding.tenantId, entry);
    }, () => {
      pendingPools.delete(binding.tenantId);
    });
  }

  const entry = await pending;
  if (entry.retired || entry.secretReference !== secretReference) throw routingError("TENANT_DATABASE_BINDING_CHANGED");
  entry.activeTransactions += 1;
  entry.lastUsedAt = Date.now();
  return { database: entry.database, release: () => releaseDedicatedPool(entry) };
}

function releaseDedicatedPool(entry: DedicatedPoolEntry): void {
  entry.activeTransactions = Math.max(0, entry.activeTransactions - 1);
  entry.lastUsedAt = Date.now();
  if (entry.retired && entry.activeTransactions === 0) {
    allDedicatedPools.delete(entry);
    void entry.pool.end().catch(() => undefined);
  }
}

export interface TenantTransactionOptions {
  /** Permit backup/restore tooling to work with suspended or closed tenants without reactivating them. */
  allowInactive?: boolean;
  /** A stable read-only MVCC snapshot for logical backups. */
  repeatableReadOnly?: boolean;
}

async function inTenantTransaction<T>(
  database: TenantDatabase,
  tenantId: string,
  callback: (tx: TenantTransaction) => Promise<T>,
  options: TenantTransactionOptions = {},
): Promise<T> {
  return database.transaction(async (tx) => {
    if (options.repeatableReadOnly) {
      // This must be the first statement after BEGIN; do not move below set_config.
      await tx.execute(sql.raw("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY"));
    }
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return callback(tx);
  });
}

/** Resolve the tenant binding before every transaction; dedicated failures never fall back to shared data. */
export async function withTenantTransaction<T>(
  tenantId: string,
  callback: (tx: TenantTransaction) => Promise<T>,
  options: TenantTransactionOptions = {},
): Promise<T> {
  const binding = await resolveBinding(tenantId);
  if (!options.allowInactive && binding.tenantStatus !== "active") throw routingError("TENANT_DATABASE_TENANT_INACTIVE");

  if (binding.tier === "shared" && binding.state === "shared") {
    const staleDedicatedPool = dedicatedPools.get(tenantId);
    if (staleDedicatedPool) retirePool(staleDedicatedPool);
    return inTenantTransaction(db, tenantId, callback, options);
  }
  if (binding.tier !== "dedicated" || binding.state !== "ready") {
    const staleDedicatedPool = dedicatedPools.get(tenantId);
    if (staleDedicatedPool) retirePool(staleDedicatedPool);
    throw routingError("TENANT_DATABASE_BINDING_NOT_READY");
  }

  const lease = await acquireDedicatedPool(binding);
  try {
    return await inTenantTransaction(lease.database, tenantId, callback, options);
  } finally {
    lease.release();
  }
}

/** Maintenance is allowed to expire records after a tenant is suspended or disabled. */
export async function withTenantMaintenanceTransaction<T>(tenantId: string, callback: (tx: TenantTransaction) => Promise<T>): Promise<T> {
  return withTenantTransaction(tenantId, callback, { allowInactive: true });
}

/** Enumerate tenant IDs for supervised all-tenant jobs; business work remains tenant-scoped. */
export async function listTenantIdsForMaintenance(): Promise<string[]> {
  const result = await tenantDirectoryPool.query<{ tenant_id: string }>(
    "SELECT id::text AS tenant_id FROM public.tenants ORDER BY id",
  );
  return result.rows.map(({ tenant_id }) => tenant_id);
}

export interface TenantBackupTransactionOptions {
  allowInactive?: boolean;
  repeatableReadOnly?: boolean;
}

/**
 * Uses the dedicated backup role for shared databases and the dedicated
 * database's migration credential for single-tenant databases. Both paths
 * retain FORCE ROW LEVEL SECURITY and set the tenant context transaction-locally.
 */
export async function withTenantBackupTransaction<T>(
  tenantId: string,
  callback: (tx: TenantTransaction) => Promise<T>,
  options: TenantBackupTransactionOptions = {},
): Promise<T> {
  const backupPool = getTenantBackupPool();
  const bindingResult = await backupPool.query<{
    tenant_id: string;
    tenant_status: string;
    tier: "shared" | "dedicated";
    state: "shared" | "provisioning" | "ready" | "failed" | "draining";
    migration_secret_ref: string | null;
    schema_version: string | null;
  }>(
    `SELECT t.id::text AS tenant_id, t.status AS tenant_status,
            COALESCE(b.tier, 'shared') AS tier, COALESCE(b.state, 'shared') AS state,
            b.migration_secret_ref, b.schema_version
       FROM public.tenants t
       LEFT JOIN public.tenant_database_bindings b ON b.tenant_id = t.id
      WHERE t.id = $1
      LIMIT 1`,
    [tenantId],
  );
  const binding = bindingResult.rows[0];
  if (!binding) throw routingError("TENANT_DATABASE_TENANT_NOT_FOUND");
  if (!options.allowInactive && binding.tenant_status !== "active") {
    throw routingError("TENANT_DATABASE_TENANT_INACTIVE");
  }

  if (binding.tier === "shared" && binding.state === "shared") {
    return inTenantTransaction(createDatabase(backupPool), tenantId, callback, {
      ...(options.repeatableReadOnly ? { repeatableReadOnly: true } : {}),
    });
  }
  if (binding.tier !== "dedicated" || binding.state !== "ready" ||
      !binding.migration_secret_ref || binding.schema_version !== currentDatabaseSchemaVersion) {
    throw routingError("TENANT_BACKUP_DATABASE_BINDING_NOT_READY");
  }

  let connectionString: string;
  try {
    connectionString = await secretResolver.resolveDatabaseUrl(binding.migration_secret_ref, tenantId);
    const url = new URL(connectionString);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") throw new Error("Invalid database URL protocol.");
  } catch {
    throw routingError("TENANT_BACKUP_DATABASE_SECRET_UNAVAILABLE");
  }

  const dedicatedBackupPool = new Pool({
    connectionString,
    max: 2,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: "bazion-tenant-dedicated-backup",
  });
  try {
    const verification = await dedicatedBackupPool.query<{
      tenant_count: number;
      matching_tenant_count: number;
      applied_migrations_count: number;
    }>(
      `SELECT count(*)::int AS tenant_count,
              count(*) FILTER (WHERE id = $1)::int AS matching_tenant_count,
              (SELECT count(*)::int FROM public.schema_migrations WHERE version = ANY($2::varchar[])) AS applied_migrations_count
         FROM public.tenants`,
      [tenantId, requiredDatabaseMigrations],
    );
    const row = verification.rows[0];
    if (!row || row.tenant_count !== 1 || row.matching_tenant_count !== 1 ||
        row.applied_migrations_count !== requiredDatabaseMigrations.length) {
      throw routingError("TENANT_BACKUP_DATABASE_VERIFICATION_FAILED");
    }
    return await inTenantTransaction(createDatabase(dedicatedBackupPool), tenantId, callback, {
      ...(options.repeatableReadOnly ? { repeatableReadOnly: true } : {}),
    });
  } finally {
    await dedicatedBackupPool.end().catch(() => undefined);
  }
}

export async function closeTenantDatabaseResources(): Promise<void> {
  await Promise.allSettled([...pendingPools.values()]);
  bindingCache.clear();
  const entries = [...allDedicatedPools];
  allDedicatedPools.clear();
  dedicatedPools.clear();
  const backupPool = tenantBackupPool;
  tenantBackupPool = undefined;
  await Promise.all([
    tenantDirectoryPool.end(),
    ...(backupPool ? [backupPool.end().catch(() => undefined)] : []),
    ...entries.map((entry) => entry.pool.end().catch(() => undefined)),
  ]);
}
