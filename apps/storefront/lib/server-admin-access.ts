import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerApiBaseUrl } from "./server-api-base-url";

export interface AdminIdentity {
  user: { id: string; email: string; name: string; emailVerified: boolean };
  organization: { id: string; role: string } | null;
  tenant: { id: string; slug: string; name: string; currency: string; status: string } | null;
  platformRole: "platform_owner" | "platform_admin" | "platform_support" | null;
}

async function loadAdminIdentity(): Promise<AdminIdentity | null> {
  const incomingHeaders = await headers();
  const cookie = incomingHeaders.get("cookie");
  if (!cookie) return null;
  const apiBaseUrl = getServerApiBaseUrl();
  try {
    const response = await fetch(`${apiBaseUrl}/v1/auth/me`, {
      headers: { cookie },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (response.status === 401) return null;
    if (!response.ok) {
      throw new Error(`Admin identity API returned HTTP ${response.status}.`);
    }
    return (await response.json()) as AdminIdentity;
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Could not verify the tenant admin session with the API.", { cause: error });
    }
    return null;
  }
}

export async function requireTenantDashboardAccess(): Promise<AdminIdentity> {
  const identity = await loadAdminIdentity();
  if (!identity) redirect("/login?callbackURL=%2Fadmin");
  if (!identity.organization || !identity.tenant || identity.tenant.status !== "active") {
    redirect("/workspace?reason=tenant-access-required");
  }
  return identity;
}

export async function requireTenantModuleAccess(moduleId: string): Promise<AdminIdentity> {
  const identity = await requireTenantDashboardAccess();
  const incomingHeaders = await headers();
  const cookie = incomingHeaders.get("cookie");
  if (!cookie) redirect("/login?callbackURL=%2Fadmin%2Fcommerce");
  const apiBaseUrl = getServerApiBaseUrl();

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/v1/admin/tenant/modules`, {
      headers: { cookie },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    redirect("/admin?reason=module-access-unavailable");
  }
  if (response.status === 401) redirect("/login?callbackURL=%2Fadmin%2Fcommerce");
  if (!response.ok) redirect("/admin?reason=module-access-unavailable");

  const result = await response.json() as { modules?: Array<{ id: string; enabled: boolean }> };
  if (!result.modules?.some((module) => module.id === moduleId && module.enabled)) {
    redirect("/admin?reason=module-disabled");
  }
  return identity;
}

export async function requirePlatformOwnerAccess(): Promise<AdminIdentity> {
  const identity = await loadAdminIdentity();
  if (!identity) redirect("/login?callbackURL=%2Fplatform");
  if (identity.platformRole !== "platform_owner") redirect("/workspace?reason=platform-owner-required");
  return identity;
}
