import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  pools: [] as Array<{ connectionString: string | undefined; end: ReturnType<typeof vi.fn> }>,
  transactionConnections: [] as Array<string | undefined>,
  directoryRows: [] as Array<Record<string, unknown>>,
  verificationRows: [] as Array<Record<string, unknown>>,
  queries: [] as Array<{ connectionString: string | undefined; query: string }>,
}));

vi.mock("pg", () => ({
  Pool: class MockPool {
    connectionString: string | undefined;
    end = vi.fn(async () => undefined);

    constructor(config: { connectionString: string | undefined }) {
      this.connectionString = config.connectionString;
      mockState.pools.push(this);
    }

    async query(query: string) {
      mockState.queries.push({ connectionString: this.connectionString, query });
      if (this.connectionString === "tenant-directory") return { rows: mockState.directoryRows };
      if (this.connectionString === "postgres://gmfc:secret@db.example/gmfc") {
        return { rows: mockState.verificationRows };
      }
      return { rows: [] };
    }
  },
}));

vi.mock("drizzle-orm/node-postgres", () => ({
  drizzle: (connectionPool: { connectionString: string | undefined }) => ({
    transaction: async <T>(callback: (transaction: { execute: () => Promise<void> }) => Promise<T>) => {
      mockState.transactionConnections.push(connectionPool.connectionString);
      return callback({ execute: async () => undefined });
    },
  }),
}));

const tenantId = "7a80eaae-6f8c-44c1-b22a-3dca458f0ec1";
const expectedSchemaVersion = "0013_tenant_database_routing.sql";
let databaseModule: typeof import("./database.js") | undefined;

async function loadDatabaseModule() {
  databaseModule = await import("./database.js");
  return databaseModule;
}

function activeTenant(binding: Partial<Record<string, unknown>> = {}) {
  mockState.directoryRows = [{
    tenant_id: tenantId,
    tenant_status: "active",
    tier: null,
    state: null,
    runtime_secret_ref: null,
    schema_version: null,
    ...binding,
  }];
}

describe("tenant database routing", () => {
  beforeEach(() => {
    vi.resetModules();
    mockState.pools = [];
    mockState.transactionConnections = [];
    mockState.directoryRows = [];
    mockState.verificationRows = [{ tenant_count: 1, matching_tenant_count: 1, schema_applied: true }];
    mockState.queries = [];
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DATABASE_URL", "shared-business-db");
    vi.stubEnv("TENANT_RESOLVER_DATABASE_URL", "tenant-directory");
    vi.stubEnv("TENANT_DATABASE_SCHEMA_VERSION", expectedSchemaVersion);
    vi.stubEnv("TENANT_DATABASE_GMFC", "postgres://gmfc:secret@db.example/gmfc");
  });

  afterEach(async () => {
    if (databaseModule) {
      await databaseModule.closeTenantDatabaseResources();
      await databaseModule.pool.end();
      databaseModule = undefined;
    }
    vi.unstubAllEnvs();
  });

  it("uses shared RLS when a tenant has no explicit binding", async () => {
    activeTenant();
    const database = await loadDatabaseModule();

    await expect(database.withTenantTransaction(tenantId, async () => "shared result")).resolves.toBe("shared result");

    expect(mockState.transactionConnections).toEqual(["shared-business-db"]);
    expect(mockState.queries.some(({ query }) => query.includes("tenant_database_bindings"))).toBe(true);
    expect(mockState.pools.some(({ connectionString }) => connectionString === "postgres://gmfc:secret@db.example/gmfc")).toBe(false);
  });

  it("routes a ready tenant to its verified dedicated database and reuses its bounded pool", async () => {
    activeTenant({
      tier: "dedicated",
      state: "ready",
      runtime_secret_ref: "env://TENANT_DATABASE_GMFC",
      schema_version: expectedSchemaVersion,
    });
    const database = await loadDatabaseModule();

    await database.withTenantTransaction(tenantId, async () => "first");
    await database.withTenantTransaction(tenantId, async () => "second");

    expect(mockState.transactionConnections).toEqual([
      "postgres://gmfc:secret@db.example/gmfc",
      "postgres://gmfc:secret@db.example/gmfc",
    ]);
    expect(mockState.pools.filter(({ connectionString }) => connectionString === "postgres://gmfc:secret@db.example/gmfc")).toHaveLength(1);
    expect(mockState.queries.some(({ query }) => query.includes("schema_migrations"))).toBe(true);
  });

  it("fails closed for provisioning bindings instead of falling back to shared data", async () => {
    activeTenant({ tier: "dedicated", state: "provisioning" });
    const database = await loadDatabaseModule();

    await expect(database.withTenantTransaction(tenantId, async () => undefined))
      .rejects.toMatchObject({ code: "TENANT_DATABASE_BINDING_NOT_READY", statusCode: 503 });
    expect(mockState.transactionConnections).toEqual([]);
  });

  it("rejects a dedicated database that contains another tenant or lacks the declared migration", async () => {
    activeTenant({
      tier: "dedicated",
      state: "ready",
      runtime_secret_ref: "env://TENANT_DATABASE_GMFC",
      schema_version: expectedSchemaVersion,
    });
    mockState.verificationRows = [{ tenant_count: 2, matching_tenant_count: 1, schema_applied: false }];
    const database = await loadDatabaseModule();

    await expect(database.withTenantTransaction(tenantId, async () => undefined))
      .rejects.toMatchObject({ code: "TENANT_DATABASE_VERIFICATION_FAILED", statusCode: 503 });
    expect(mockState.transactionConnections).toEqual([]);
    expect(mockState.pools.at(-1)?.end).toHaveBeenCalledOnce();
  });

  it("rejects a dedicated binding when its schema version does not match the running API", async () => {
    activeTenant({
      tier: "dedicated",
      state: "ready",
      runtime_secret_ref: "env://TENANT_DATABASE_GMFC",
      schema_version: "0012_previous.sql",
    });
    const database = await loadDatabaseModule();

    await expect(database.withTenantTransaction(tenantId, async () => undefined))
      .rejects.toMatchObject({ code: "TENANT_DATABASE_SCHEMA_VERSION_MISMATCH", statusCode: 503 });
    expect(mockState.transactionConnections).toEqual([]);
  });

  it("rejects missing tenant bindings without querying or writing tenant data", async () => {
    mockState.directoryRows = [];
    const database = await loadDatabaseModule();

    await expect(database.withTenantTransaction(tenantId, async () => undefined))
      .rejects.toMatchObject({ code: "TENANT_DATABASE_TENANT_NOT_FOUND", statusCode: 503 });
    expect(mockState.transactionConnections).toEqual([]);
  });
});
