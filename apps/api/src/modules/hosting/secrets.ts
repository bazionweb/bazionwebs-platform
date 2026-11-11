import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { resolve, sep } from "node:path";
import type { TenantHostingSecretResolver, TenantHostingTemplate } from "@bazion/platform-contracts";

const tenantUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const templateNames = new Set<TenantHostingTemplate>(["wordpress", "node-nextjs", "ecommerce"]);
const requiredKeys: Record<TenantHostingTemplate, readonly string[]> = {
  wordpress: ["WORDPRESS_IMAGE", "MARIADB_IMAGE", "MARIADB_DATABASE", "MARIADB_USER", "MARIADB_PASSWORD", "MARIADB_ROOT_PASSWORD"],
  "node-nextjs": ["APP_IMAGE"],
  ecommerce: ["APP_IMAGE", "POSTGRES_IMAGE", "POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD"],
};
const forbiddenKeys = new Set(["PATH", "HOME", "HOSTNAME", "PORT", "NODE_ENV", "PWD", "SHELL", "SHLVL"]);
const maxSecretBytes = 64 * 1024;

function invalidSecret(): Error {
  return new Error("HOSTING_SECRET_INVALID");
}

function validateImageReference(value: string): boolean {
  if (/replace[-_ ]?with|your[-_]|placeholder/i.test(value) || /:latest$/i.test(value)) return false;
  if (/^sha256:[a-f0-9]{64}$/i.test(value)) return false;
  if (/@sha256:[a-f0-9]{64}$/i.test(value)) return true;
  const finalSegment = value.split("/").at(-1) ?? "";
  return /^[A-Za-z0-9][A-Za-z0-9_.-]*:[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(finalSegment);
}

/** Creates the only secret reference accepted by this runtime for a tenant/template pair. */
export function tenantHostingDockerSecretReference(tenantId: string, template: TenantHostingTemplate): string {
  if (!tenantUuidPattern.test(tenantId) || !templateNames.has(template)) throw new Error("HOSTING_SECRET_REFERENCE_INVALID");
  return `docker-secret://bazion-hosting-${tenantId.toLowerCase()}-${template}`;
}

/**
 * Resolves JSON environment maps from Docker Swarm secrets mounted read-only
 * under /run/secrets. Secret values never enter the database or API request.
 */
export class DockerSecretTenantHostingSecretResolver implements TenantHostingSecretResolver {
  private readonly directory: string;

  constructor(secretDirectory = "/run/secrets") {
    this.directory = resolve(secretDirectory);
  }

  async resolveEnvironment(reference: string): Promise<Readonly<Record<string, string>>> {
    const match = /^docker-secret:\/\/bazion-hosting-([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})-(wordpress|node-nextjs|ecommerce)$/i.exec(reference);
    if (!match) throw new Error("HOSTING_SECRET_REFERENCE_INVALID");
    const tenantId = match[1]!.toLowerCase();
    const template = match[2]!.toLowerCase() as TenantHostingTemplate;
    const name = `bazion-hosting-${tenantId}-${template}`;
    const file = resolve(this.directory, name);
    const prefix = this.directory.endsWith(sep) ? this.directory : `${this.directory}${sep}`;
    if (!file.startsWith(prefix) && !file.startsWith(`${this.directory}/`)) throw invalidSecret();

    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
      const info = await handle.stat();
      if (!info.isFile() || info.size < 2 || info.size > maxSecretBytes || (process.platform !== "win32" && (info.mode & 0o022) !== 0)) {
        throw invalidSecret();
      }
      const raw = await handle.readFile({ encoding: "utf8" });
      let parsed: unknown;
      try { parsed = JSON.parse(raw) as unknown; } catch { throw invalidSecret(); }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw invalidSecret();

      const values: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (
          !/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(key) ||
          forbiddenKeys.has(key) ||
          key.startsWith("COMPOSE_") ||
          key.startsWith("DOCKER_") ||
          key === "__proto__" ||
          typeof value !== "string" ||
          value.length === 0 ||
          value.length > 8_192 ||
          /[\r\n\0]/.test(value)
        ) throw invalidSecret();
        values[key] = value;
      }
      for (const key of requiredKeys[template]) {
        if (!values[key]) throw invalidSecret();
      }
      for (const [key, value] of Object.entries(values)) {
        if ((key === "APP_IMAGE" || key.endsWith("_IMAGE")) && !validateImageReference(value)) {
          throw new Error("HOSTING_IMAGE_REFERENCE_INVALID");
        }
      }
      return Object.freeze(values);
    } catch (error) {
      if (error instanceof Error && ["HOSTING_SECRET_REFERENCE_INVALID", "HOSTING_SECRET_INVALID", "HOSTING_IMAGE_REFERENCE_INVALID"].includes(error.message)) {
        throw error;
      }
      throw new Error("HOSTING_SECRET_UNAVAILABLE");
    } finally {
      await handle?.close().catch(() => undefined);
    }
  }
}
