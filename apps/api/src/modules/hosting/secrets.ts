import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { resolve, sep } from "node:path";
import {
  TENANT_HOSTING_TEMPLATES,
  type TenantHostingSecretResolver,
  type TenantHostingTemplate,
} from "@bazion/platform-contracts";
import { HttpSecretManagerClient, type SecretManagerClient } from "../../lib/secret-manager-client.js";

export { HttpSecretManagerClient } from "../../lib/secret-manager-client.js";
export type { HttpSecretManagerClientOptions, SecretManagerClient } from "../../lib/secret-manager-client.js";

const tenantUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const templateNames = new Set<TenantHostingTemplate>(TENANT_HOSTING_TEMPLATES);
const secretReferencePattern = new RegExp(
  `^docker-secret://bazion-hosting-([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})-(${TENANT_HOSTING_TEMPLATES.join("|")})$`,
  "i",
);
const requiredKeys: Record<TenantHostingTemplate, readonly string[]> = {
  wordpress: ["WORDPRESS_IMAGE", "MARIADB_IMAGE", "MARIADB_DATABASE", "MARIADB_USER", "MARIADB_PASSWORD", "MARIADB_ROOT_PASSWORD"],
  "node-nextjs": ["APP_IMAGE"],
  ecommerce: ["APP_IMAGE", "POSTGRES_IMAGE", "POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD"],
};
const forbiddenKeys = new Set(["PATH", "HOME", "HOSTNAME", "PORT", "NODE_ENV", "PWD", "SHELL", "SHLVL"]);
const maxSecretBytes = 64 * 1024;
const maxCachedHostingSecrets = 256;

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

export type HostingSecretBackend = "docker" | "secret-manager";

/** Creates the backend-appropriate secret reference accepted by this runtime for a tenant/template pair. */
export function tenantHostingSecretReference(
  tenantId: string,
  template: TenantHostingTemplate,
  backend: HostingSecretBackend = "docker",
): string {
  if (!tenantUuidPattern.test(tenantId) || !templateNames.has(template)) {
    throw new Error("HOSTING_SECRET_REFERENCE_INVALID");
  }
  const cleanTenantId = tenantId.toLowerCase();
  return backend === "secret-manager"
    ? `secret-manager://bazion-hosting-${cleanTenantId}-${template}`
    : `docker-secret://bazion-hosting-${cleanTenantId}-${template}`;
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
    const match = secretReferencePattern.exec(reference);
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
      const parsed = JSON.parse(raw) as unknown;
      return validateHostingSecretMap(parsed, template);
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

function validateHostingSecretMap(parsed: unknown, template: TenantHostingTemplate): Readonly<Record<string, string>> {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw invalidSecret();

  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (
      !/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(key)
      || forbiddenKeys.has(key)
      || key.startsWith("COMPOSE_")
      || key.startsWith("DOCKER_")
      || key === "__proto__"
      || typeof value !== "string"
      || value.length === 0
      || value.length > 8_192
      || /[\r\n\0]/.test(value)
    ) {
      throw invalidSecret();
    }
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
}

export interface SecretManagerResolverOptions {
  client: SecretManagerClient;
  pathPrefix?: string;
  secretVersion?: string;
  cacheTtlMs?: number;
}

const secretManagerReferencePattern = new RegExp(
  `^(?:secret-manager|docker-secret)://bazion-hosting-([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})-(${TENANT_HOSTING_TEMPLATES.join("|")})$`,
  "i",
);

/** Formats the tenant-scoped Secret Manager key path used for dedicated hosting deployments. */
export function tenantHostingSecretManagerPath(
  tenantId: string,
  template: TenantHostingTemplate,
  prefix = "tenants",
): string {
  if (!tenantUuidPattern.test(tenantId) || !templateNames.has(template)) {
    throw new Error("HOSTING_SECRET_REFERENCE_INVALID");
  }
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, "") || "tenants";
  if (!cleanPrefix.split("/").every((segment) => /^[A-Za-z0-9_-]{1,64}$/.test(segment))) {
    throw new Error("HOSTING_SECRET_PATH_PREFIX_INVALID");
  }
  return `${cleanPrefix}/${tenantId.toLowerCase()}/hosting/${template}`;
}

/**
 * Production secret-manager resolver for tenant-scoped dedicated hosting deployments.
 * Enforces tenant-prefixed secret paths, optional version pinning, strict env validation,
 * and bounded TTL caching without leaking secret values into DB or logs.
 */
export class SecretManagerTenantHostingSecretResolver implements TenantHostingSecretResolver {
  private readonly client: SecretManagerClient;
  private readonly pathPrefix: string;
  private readonly secretVersion: string | undefined;
  private readonly cacheTtlMs: number;
  private readonly cache = new Map<string, { values: Readonly<Record<string, string>>; expiresAt: number }>();

  constructor(options: SecretManagerResolverOptions) {
    this.client = options.client;
    this.pathPrefix = (options.pathPrefix ?? "tenants").replace(/^\/+|\/+$/g, "") || "tenants";
    this.secretVersion = options.secretVersion?.trim() || undefined;
    tenantHostingSecretManagerPath("11111111-1111-4111-8111-111111111111", "node-nextjs", this.pathPrefix);
    const ttl = Math.trunc(options.cacheTtlMs ?? 60_000);
    this.cacheTtlMs = Number.isFinite(ttl) ? Math.max(0, Math.min(300_000, ttl)) : 60_000;
  }

  async resolveEnvironment(reference: string): Promise<Readonly<Record<string, string>>> {
    const match = secretManagerReferencePattern.exec(reference);
    if (!match) throw new Error("HOSTING_SECRET_REFERENCE_INVALID");

    const tenantId = match[1]!.toLowerCase();
    const template = match[2]!.toLowerCase() as TenantHostingTemplate;
    const secretPath = tenantHostingSecretManagerPath(tenantId, template, this.pathPrefix);
    if (!secretPath.startsWith(`${this.pathPrefix}/${tenantId}/`)) {
      throw invalidSecret();
    }

    const cacheKey = `${secretPath}@${this.secretVersion ?? "latest"}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.values;
    }

    let raw: string | null;
    try {
      raw = await this.client.getSecretValue(secretPath, this.secretVersion);
    } catch {
      throw new Error("HOSTING_SECRET_UNAVAILABLE");
    }
    if (!raw || raw.trim().length < 2 || Buffer.byteLength(raw, "utf8") > maxSecretBytes) {
      throw new Error("HOSTING_SECRET_UNAVAILABLE");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      throw invalidSecret();
    }

    const values = validateHostingSecretMap(parsed, template);
    if (this.cacheTtlMs > 0) {
      if (this.cache.size >= maxCachedHostingSecrets) {
        const now = Date.now();
        for (const [key, entry] of this.cache) {
          if (entry.expiresAt <= now) this.cache.delete(key);
        }
        if (this.cache.size >= maxCachedHostingSecrets) {
          const oldestKey = this.cache.keys().next().value as string | undefined;
          if (oldestKey) this.cache.delete(oldestKey);
        }
      }
      this.cache.set(cacheKey, {
        values,
        expiresAt: Date.now() + this.cacheTtlMs,
      });
    }
    return values;
  }
}

export function createTenantHostingSecretResolverFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  secretManagerClient?: SecretManagerClient,
): TenantHostingSecretResolver {
  const backend = (env.HOSTING_SECRET_BACKEND ?? "docker").trim().toLowerCase();
  if (backend === "secret-manager") {
    const resolvedClient =
      secretManagerClient
      ?? (env.HOSTING_SECRET_MANAGER_URL?.trim() && env.HOSTING_SECRET_MANAGER_TOKEN?.trim()
        ? new HttpSecretManagerClient({
            baseUrl: env.HOSTING_SECRET_MANAGER_URL.trim(),
            authToken: env.HOSTING_SECRET_MANAGER_TOKEN.trim(),
            allowInsecureLocalhost: env.NODE_ENV !== "production",
          })
        : undefined);
    if (!resolvedClient) {
      throw new Error("HOSTING_SECRET_MANAGER_CLIENT_REQUIRED");
    }
    return new SecretManagerTenantHostingSecretResolver({
      client: resolvedClient,
      ...(env.HOSTING_SECRET_MANAGER_PREFIX ? { pathPrefix: env.HOSTING_SECRET_MANAGER_PREFIX } : {}),
      ...(env.HOSTING_SECRET_MANAGER_VERSION ? { secretVersion: env.HOSTING_SECRET_MANAGER_VERSION } : {}),
      ...(env.HOSTING_SECRET_CACHE_TTL_MS ? { cacheTtlMs: Number(env.HOSTING_SECRET_CACHE_TTL_MS) } : {}),
    });
  }
  return new DockerSecretTenantHostingSecretResolver(env.HOSTING_DOCKER_SECRETS_DIR || "/run/secrets");
}
