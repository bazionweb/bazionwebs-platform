import {
  resolvePublicTenantByHostname,
  resolvePublicTenantBySlug,
  resolvePublicTenantInstallationByHostname,
} from "@bazion/auth/server";
import type { AppConfig } from "../config.js";

export interface TenantRoutingContext {
  tenantId: string;
  installationId: string | null;
}

function normalizeHostForRouting(hostname: string) {
  const rawHost = (hostname || "").trim().toLowerCase();
  const cleanHost = rawHost === "::1"
    ? rawHost
    : rawHost.startsWith("[") && rawHost.includes("]")
      ? rawHost.slice(1, rawHost.indexOf("]"))
      : rawHost.split(":", 1)[0]!;
  const isLoopbackHost = cleanHost === "localhost" || cleanHost === "127.0.0.1" || cleanHost === "::1";
  return { cleanHost, isLoopbackHost };
}

async function resolveFallbackTenantId(
  cleanHost: string,
  isLoopbackHost: boolean,
  config: AppConfig,
  explicitTenantSlugOrId?: string,
): Promise<string> {
  // The explicit selector exists only for local development against a naked
  // loopback host. It is not a production tenant-routing mechanism.
  if (config.NODE_ENV !== "production" && isLoopbackHost && explicitTenantSlugOrId) {
    const cleanExplicit = explicitTenantSlugOrId.trim().toLowerCase();
    const bySlug = await resolvePublicTenantBySlug(cleanExplicit);
    if (bySlug) return bySlug.id;
  }

  // In static mode or local development, fall back to DEFAULT_TENANT_ID for
  // a naked loopback host. Production startup independently rejects static mode.
  if (config.TENANT_RESOLUTION_MODE === "static" || isLoopbackHost) {
    if (config.NODE_ENV === "production" && config.TENANT_RESOLUTION_MODE === "static") {
      throw Object.assign(new Error("Static tenant resolution is disabled in production."), {
        statusCode: 503,
        code: "TENANT_RESOLUTION_DISABLED",
      });
    }
    if (config.DEFAULT_TENANT_ID) return config.DEFAULT_TENANT_ID;
  }

  throw Object.assign(new Error("This hostname is not mapped to an active Bazion client."), {
    statusCode: 404,
    code: "TENANT_NOT_FOUND",
  });
}

/**
 * Resolves the authoritative tenant ID and optional pinned installation ID for
 * a verified hostname before multi-installation routing is enabled.
 */
export async function resolveTenantRouting(
  hostname: string,
  config: AppConfig,
  explicitTenantSlugOrId?: string,
): Promise<TenantRoutingContext> {
  const { cleanHost, isLoopbackHost } = normalizeHostForRouting(hostname);

  if (cleanHost.endsWith(".localhost")) {
    const subdomain = cleanHost.slice(0, -".localhost".length);
    if (subdomain && subdomain !== "www") {
      const bySubdomain = await resolvePublicTenantBySlug(subdomain);
      if (bySubdomain) return { tenantId: bySubdomain.id, installationId: null };
    }
  }

  const routed = await resolvePublicTenantInstallationByHostname(cleanHost);
  if (routed) {
    return {
      tenantId: routed.id,
      installationId: routed.installation_id ?? null,
    };
  }

  return {
    tenantId: await resolveFallbackTenantId(cleanHost, isLoopbackHost, config, explicitTenantSlugOrId),
    installationId: null,
  };
}

export async function resolveTenantId(
  hostname: string,
  config: AppConfig,
  explicitTenantSlugOrId?: string,
): Promise<string> {
  const { cleanHost, isLoopbackHost } = normalizeHostForRouting(hostname);

  // Host mapping is authoritative. A caller-supplied tenant header must never
  // override a verified custom domain or a tenant-specific local hostname.
  if (cleanHost.endsWith(".localhost")) {
    const subdomain = cleanHost.slice(0, -".localhost".length);
    if (subdomain && subdomain !== "www") {
      const bySubdomain = await resolvePublicTenantBySlug(subdomain);
      if (bySubdomain) return bySubdomain.id;
    }
  }

  const tenant = await resolvePublicTenantByHostname(cleanHost);
  if (tenant) return tenant.id;

  return resolveFallbackTenantId(cleanHost, isLoopbackHost, config, explicitTenantSlugOrId);
}
