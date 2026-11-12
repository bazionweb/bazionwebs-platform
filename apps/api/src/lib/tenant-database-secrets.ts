import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { resolve, sep } from "node:path";
import type { TenantDatabaseSecretResolver } from "./database.js";

const tenantUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxSecretBytes = 16 * 1024;
const maxDatabaseUrlLength = 8_192;

function invalidSecret(): Error {
  return new Error("TENANT_DATABASE_SECRET_INVALID");
}

/** Creates the only Docker secret reference accepted for a dedicated tenant database. */
export function tenantDatabaseDockerSecretReference(tenantId: string): string {
  if (!tenantUuidPattern.test(tenantId)) throw new Error("TENANT_DATABASE_SECRET_REFERENCE_INVALID");
  return `docker-secret://bazion-tenant-db-${tenantId.toLowerCase()}`;
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
        !parsedUrl.hostname
      ) throw invalidSecret();
      return databaseUrl;
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
