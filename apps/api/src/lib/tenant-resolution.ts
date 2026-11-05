import { resolvePublicTenantByHostname } from "@bazion/auth/server";
import type { AppConfig } from "../config.js";

export async function resolveTenantId(hostname: string, config: AppConfig): Promise<string> {
  if (config.TENANT_RESOLUTION_MODE === "static") {
    if (config.NODE_ENV === "production") {
      throw Object.assign(new Error("Static tenant resolution is disabled in production."), {
        statusCode: 503,
        code: "TENANT_RESOLUTION_DISABLED",
      });
    }
    if (!config.DEFAULT_TENANT_ID) throw new Error("DEFAULT_TENANT_ID is required in static mode.");
    return config.DEFAULT_TENANT_ID;
  }

  const tenant = await resolvePublicTenantByHostname(hostname);
  if (!tenant) {
    throw Object.assign(new Error("This hostname is not mapped to an active Bazion client."), {
      statusCode: 404,
      code: "TENANT_NOT_FOUND",
    });
  }
  return tenant.id;
}
