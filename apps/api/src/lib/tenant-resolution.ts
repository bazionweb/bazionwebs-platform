import { resolvePublicTenantByHostname, resolvePublicTenantBySlug } from "@bazion/auth/server";
import type { AppConfig } from "../config.js";

export async function resolveTenantId(
  hostname: string,
  config: AppConfig,
  explicitTenantSlugOrId?: string,
): Promise<string> {
  const cleanHost = (hostname || "").split(":", 1)[0]!.trim().toLowerCase();

  // 1. If explicit tenant slug or ID is requested (e.g. from x-bazion-tenant header)
  if (explicitTenantSlugOrId) {
    const cleanExplicit = explicitTenantSlugOrId.trim().toLowerCase();
    const bySlug = await resolvePublicTenantBySlug(cleanExplicit);
    if (bySlug) return bySlug.id;
  }

  // 2. Check if host has a subdomain (e.g. joe-ministries.localhost)
  if (cleanHost.endsWith(".localhost")) {
    const subdomain = cleanHost.slice(0, -".localhost".length);
    if (subdomain && subdomain !== "www") {
      const bySubdomain = await resolvePublicTenantBySlug(subdomain);
      if (bySubdomain) return bySubdomain.id;
    }
  }

  // 3. Check verified domain directory (e.g. custom client domain)
  const tenant = await resolvePublicTenantByHostname(cleanHost);
  if (tenant) return tenant.id;

  // 4. In static mode or local development, fall back to DEFAULT_TENANT_ID for naked localhost
  if (config.TENANT_RESOLUTION_MODE === "static" || cleanHost === "localhost" || cleanHost === "127.0.0.1") {
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
