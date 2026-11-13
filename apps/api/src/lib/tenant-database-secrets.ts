import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { resolve, sep } from "node:path";
import type { TenantDatabaseSecretResolver } from "./database.js";
import { HttpSecretManagerClient, type SecretManagerClient } from "./secret-manager-client.js";

const tenantUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxSecretBytes = 16 * 1024;
const maxDatabaseUrlLength = 8_192;
const maxCachedDatabaseSecrets = 256;

function invalidSecret(): Error {
  return new Error("TENANT_DATABASE_SECRET_INVALID");
}

function parseTenantDatabaseUrl(raw: string): string {
  if (Buffer.byteLength(raw, "utf8") > maxSecretBytes) throw invalidSecret();
  let parsed: unknown;
  try { parsed = JSON.parse(raw) as unknown; } catch { throw invalidSecret(); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw invalidSecret();

  const values = parsed as Record<string, unknown>;
  if (Object.keys(values).length !== 1 || typeof values.DATABASE_URL !== "string") throw invalidSecret();
  const databaseUrl = values.DATABASE_URL;
  if (
    databaseUrl.length === 0 ||
    databaseUrl.length > maxDatabaseUrlLength ||
    databaseUrl.trim() !== databaseUrl ||
    /[\u0000-\u001f\u007f]/.test(databaseUrl)
  ) throw invalidSecret();

  let parsedUrl: URL;
  try { parsedUrl = new URL(databaseUrl); } catch { throw invalidSecret(); }
  if (
    (parsedUrl.protocol !== "postgres:" && parsedUrl.protocol !== "postgresql:") ||
    !parsedUrl.hostname ||
    parsedUrl.username.length === 0 ||
    parsedUrl.pathname.length <= 1 ||
    parsedUrl.hash.length > 0
  ) throw invalidSecret();
  return databaseUrl;
}

/** Creates the only Docker secret reference accepted for a dedicated tenant database. */
export function tenantDatabaseDockerSecretReference(tenantId: string): string {
  if (!tenantUuidPattern.test(tenantId)) throw new Error("TENANT_DATABASE_SECRET_REFERENCE_INVALID");
  return `docker-secret://bazion-tenant-db-${tenantId.toLowerCase()}`;
}

/** Creates the only Secret Manager reference accepted for a dedicated tenant database. */
export function tenantDatabaseSecretManagerReference(tenantId: string): string {
  if (!tenantUuidPattern.test(tenantId)) throw new Error("TENANT_DATABASE_SECRET_REFERENCE_INVALID");
  return `secret-manager://bazion-tenant-db-${tenantId.toLowerCase()}`;
}

/** Formats the per-tenant database credential path inside the configured secret namespace. */
export function tenantDatabaseSecretManagerPath(tenantId: string, prefix = "tenants"): string {
  if (!tenantUuidPattern.test(tenantId)) throw new Error("TENANT_DATABASE_SECRET_REFERENCE_INVALID");
  const cleanPrefix = prefix.trim().replace(/^\/+|\/+$/g, "") || "tenants";
  if (!cleanPrefix.split("/").every((segment) => /^[A-Za-z0-9_-]{1,64}$/.test(segment))) {
    throw new Error("TENANT_DATABASE_SECRET_PREFIX_INVALID");
  }
  return `${cleanPrefix}/${tenantId.toLowerCase()}/database`;
}

export interface SecretManagerTenantDatabaseSecretResolverOptions {
  client: SecretManagerClient;
  pathPrefix?: string;
  secretVersion?: string;
  cacheTtlMs?: number;
}

/** Resolves tenant-isolated database URLs without persisting credential material in the control plane. */
export class SecretManagerTenantDatabaseSecretResolver implements TenantDatabaseSecretResolver {
  private readonly client: SecretManagerClient;
  private readonly pathPrefix: string;
  private readonly secretVersion: string | undefined;
  private readonly cacheTtlMs: number;
  private readonly cache = new Map<string, { databaseUrl: string; expiresAt: number }>();

  constructor(options: SecretManagerTenantDatabaseSecretResolverOptions) {
    this.client = options.client;
    this.pathPrefix = (options.pathPrefix ?? "tenants").trim();
    tenantDatabaseSecretManagerPath("11111111-1111-4111-8111-111111111111", this.pathPrefix);
    this.secretVersion = options.secretVersion?.trim() || undefined;
    const ttl = Math.trunc(options.cacheTtlMs ?? 30_000);
    this.cacheTtlMs = Number.isFinite(ttl) ? Math.max(0, Math.min(300_000, ttl)) : 30_000;
  }

  async resolveDatabaseUrl(secretReference: string, tenantId: string): Promise<string> {
    if (!tenantUuidPattern.test(tenantId)) throw new Error("TENANT_DATABASE_SECRET_REFERENCE_INVALID");
    const match = /^secret-manager:\/\/bazion-tenant-db-([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(secretReference);
    if (!match || match[1]!.toLowerCase() !== tenantId.toLowerCase()) {
      throw new Error("TENANT_DATABASE_SECRET_REFERENCE_INVALID");
    }

    const secretPath = tenantDatabaseSecretManagerPath(tenantId, this.pathPrefix);
    const cacheKey = `${secretPath}@${this.secretVersion ?? "latest"}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.databaseUrl;

    let raw: string | null;
    try {
      raw = await this.client.getSecretValue(secretPath, this.secretVersion);
    } catch {
      throw new Error("TENANT_DATABASE_SECRET_UNAVAILABLE");
    }
    if (!raw || raw.trim().length < 2 || Buffer.byteLength(raw, "utf8") > maxSecretBytes) {
      throw new Error("TENANT_DATABASE_SECRET_UNAVAILABLE");
    }

    const databaseUrl = parseTenantDatabaseUrl(raw);
    if (this.cacheTtlMs > 0) {
      if (this.cache.size >= maxCachedDatabaseSecrets) {
        const now = Date.now();
        for (const [key, entry] of this.cache) {
          if (entry.expiresAt <= now) this.cache.delete(key);
        }
        if (this.cache.size >= maxCachedDatabaseSecrets) {
          const oldestKey = this.cache.keys().next().value as string | undefined;
          if (oldestKey) this.cache.delete(oldestKey);
        }
      }
      this.cache.set(cacheKey, { databaseUrl, expiresAt: Date.now() + this.cacheTtlMs });
    }
    return databaseUrl;
  }
}

/**
 * Resolves a JSON database credential from a read-only Docker Swarm secret
 * mounted under the configured secret directory. Secret values never enter
 * the tenant directory database or API request.
 */
export class DockerSecretTenantDatabaseSecretResolver implements TenantDatabaseSecretResolver {
  private readonly directory: string;

  constructor(secretDirectory = "/run/secrets") {
    this.directory = resolve(secretDirectory);
  }

  async resolveDatabaseUrl(secretReference: string, tenantId: string): Promise<string> {
    if (!tenantUuidPattern.test(tenantId)) throw new Error("TENANT_DATABASE_SECRET_REFERENCE_INVALID");
    const match = /^docker-secret:\/\/bazion-tenant-db-([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(secretReference);
    if (!match || match[1]!.toLowerCase() !== tenantId.toLowerCase()) {
      throw new Error("TENANT_DATABASE_SECRET_REFERENCE_INVALID");
    }

    const name = `bazion-tenant-db-${tenantId.toLowerCase()}`;
    const file = resolve(this.directory, name);
    const prefix = this.directory.endsWith(sep) ? this.directory : `${this.directory}${sep}`;
    if (!file.startsWith(prefix)) throw invalidSecret();

    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
      const info = await handle.stat();
      if (
        !info.isFile() ||
        info.size < 2 ||
        info.size > maxSecretBytes ||
        (process.platform !== "win32" && ((info.mode & 0o222) !== 0 || (info.mode & 0o444) === 0))
      ) throw invalidSecret();

      const raw = await handle.readFile({ encoding: "utf8" });
      return parseTenantDatabaseUrl(raw);
    } catch (error) {
      if (error instanceof Error && [
        "TENANT_DATABASE_SECRET_REFERENCE_INVALID",
        "TENANT_DATABASE_SECRET_INVALID",
      ].includes(error.message)) throw error;
      throw new Error("TENANT_DATABASE_SECRET_UNAVAILABLE");
    } finally {
      await handle?.close().catch(() => undefined);
    }
  }
}

export interface TenantDatabaseSecretResolverConfig {
  backend: "docker" | "secret-manager";
  secretDirectory: string;
  secretManagerUrl?: string | undefined;
  secretManagerToken?: string | undefined;
  secretManagerPrefix?: string | undefined;
  secretManagerVersion?: string | undefined;
  secretManagerCacheTtlMs?: number | undefined;
}

/** Builds the configured production adapter. The HTTP client rejects non-TLS production endpoints. */
export function createTenantDatabaseSecretResolver(
  config: TenantDatabaseSecretResolverConfig,
): TenantDatabaseSecretResolver {
  if (config.backend === "docker") {
    return new DockerSecretTenantDatabaseSecretResolver(config.secretDirectory);
  }
  if (!config.secretManagerUrl?.trim() || !config.secretManagerToken?.trim()) {
    throw new Error("TENANT_DATABASE_SECRET_MANAGER_CLIENT_REQUIRED");
  }
  return new SecretManagerTenantDatabaseSecretResolver({
    client: new HttpSecretManagerClient({
      baseUrl: config.secretManagerUrl,
      authToken: config.secretManagerToken,
    }),
    ...(config.secretManagerPrefix ? { pathPrefix: config.secretManagerPrefix } : {}),
    ...(config.secretManagerVersion ? { secretVersion: config.secretManagerVersion } : {}),
    ...(config.secretManagerCacheTtlMs !== undefined ? { cacheTtlMs: config.secretManagerCacheTtlMs } : {}),
  });
}
