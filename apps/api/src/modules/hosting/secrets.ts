import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { resolve, sep } from "node:path";
import {
  TENANT_HOSTING_TEMPLATES,
  type TenantHostingSecretResolver,
  type TenantHostingTemplate,
} from "@bazion/platform-contracts";

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

export interface SecretManagerClient {
  getSecretValue(secretPath: string, version?: string): Promise<string | null>;
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
    this.cacheTtlMs = Math.max(0, options.cacheTtlMs ?? 60_000);
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

    const raw = await this.client.getSecretValue(secretPath, this.secretVersion);
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
      this.cache.set(cacheKey, {
        values,
        expiresAt: Date.now() + this.cacheTtlMs,
      });
    }
    return values;
  }
}

export interface HttpSecretManagerClientOptions {
  baseUrl: string;
  authToken: string;
  timeoutMs?: number;
  allowInsecureLocalhost?: boolean;
  fetchImpl?: typeof fetch;
}

/**
 * HTTP Secret Manager client (Vault / external secret broker compatible) that fetches
 * tenant-scoped JSON secret maps over TLS (or loopback in non-production) with Bearer auth.
 */
export class HttpSecretManagerClient implements SecretManagerClient {
  private readonly baseUrl: string;
  private readonly authToken: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpSecretManagerClientOptions) {
    const parsed = new URL(options.baseUrl);
    const isLoopback = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
    const httpsOk = parsed.protocol === "https:";
    const devHttpOk = options.allowInsecureLocalhost === true && isLoopback && parsed.protocol === "http:";
    if ((!httpsOk && !devHttpOk) || parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new Error("HOSTING_SECRET_MANAGER_URL_INVALID");
    }
    const token = options.authToken.trim();
    if (!token) {
      throw new Error("HOSTING_SECRET_MANAGER_TOKEN_REQUIRED");
    }
    this.baseUrl = parsed.toString().replace(/\/+$/, "");
    this.authToken = token;
    this.timeoutMs = Math.max(500, Math.min(30_000, Math.trunc(options.timeoutMs ?? 5_000)));
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getSecretValue(secretPath: string, version?: string): Promise<string | null> {
    const cleanPath = secretPath.replace(/^\/+/, "");
    const query = version ? `?version=${encodeURIComponent(version)}` : "";
    const response = await this.fetchImpl(`${this.baseUrl}/${cleanPath}${query}`, {
      method: "GET",
      redirect: "error",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.authToken}`,
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error("HOSTING_SECRET_UNAVAILABLE");
    }

    const payload = (await response.json()) as unknown;
    if (typeof payload === "string") {
      return payload;
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw invalidSecret();
    }
    const record = payload as Record<string, unknown>;
    if (typeof record.secretString === "string") {
      return record.secretString;
    }
    if (record.data && typeof record.data === "object" && !Array.isArray(record.data)) {
      const innerData = record.data as Record<string, unknown>;
      if (innerData.data && typeof innerData.data === "object" && !Array.isArray(innerData.data)) {
        return JSON.stringify(innerData.data);
      }
      return JSON.stringify(innerData);
    }
    return JSON.stringify(record);
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
