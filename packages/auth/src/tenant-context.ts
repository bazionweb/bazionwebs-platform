import { fromNodeHeaders } from "better-auth/node";
import type { IncomingHttpHeaders } from "node:http";
import {
  auth,
  resolvePlatformMemberByUserId,
  resolveTenantByOrganizationId,
} from "./server.js";
import { parseOrganizationRoles } from "./permissions.js";
import { canAccessPlatformPermission, type PlatformPermission } from "./security-policy.js";

export interface ActiveTenantContext {
  userId: string;
  email: string;
  name: string;
  organizationId: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  currency: string;
  roles: string[];
}

export interface CurrentIdentity {
  user: { id: string; email: string; name: string; emailVerified: boolean };
  organization: { id: string; role: string } | null;
  tenant: { id: string; slug: string; name: string; currency: string; status: string } | null;
  platformRole: "platform_owner" | "platform_admin" | "platform_support" | null;
}

export async function getCurrentIdentity(headers: IncomingHttpHeaders): Promise<CurrentIdentity | null> {
  const authHeaders = fromNodeHeaders(headers);
  const session = await auth.api.getSession({ headers: authHeaders });
  if (!session) return null;

  const activeOrganizationId = (session.session as typeof session.session & {
    activeOrganizationId?: string | null;
  }).activeOrganizationId;
  const [member, platformMember] = await Promise.all([
    activeOrganizationId ? auth.api.getActiveMember({ headers: authHeaders }) : Promise.resolve(null),
    resolvePlatformMemberByUserId(session.user.id),
  ]);

  const tenant = member ? await resolveTenantByOrganizationId(member.organizationId) : null;
  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      emailVerified: session.user.emailVerified,
    },
    organization: member ? { id: member.organizationId, role: member.role } : null,
    tenant: tenant
      ? { id: tenant.id, slug: tenant.slug, name: tenant.name, currency: tenant.default_currency, status: tenant.status }
      : null,
    platformRole: platformMember?.role ?? null,
  };
}

export async function getActiveTenantContext(headers: IncomingHttpHeaders): Promise<ActiveTenantContext | null> {
  const identity = await getCurrentIdentity(headers);
  if (!identity?.organization || !identity.tenant || identity.tenant.status !== "active") return null;
  return {
    userId: identity.user.id,
    email: identity.user.email,
    name: identity.user.name,
    organizationId: identity.organization.id,
    tenantId: identity.tenant.id,
    tenantSlug: identity.tenant.slug,
    tenantName: identity.tenant.name,
    currency: identity.tenant.currency,
    roles: parseOrganizationRoles(identity.organization.role),
  };
}

export type TenantPermissionRequest = {
  product?: Array<"read" | "create" | "update" | "delete">;
  order?: Array<"read" | "update" | "refund">;
  customer?: Array<"read" | "update">;
  store?: Array<"read" | "update">;
  churchprivate?: Array<"read" | "update">;
  analytics?: Array<"read">;
  organization?: Array<"update">;
  member?: Array<"create" | "update" | "delete">;
  invitation?: Array<"create" | "cancel">;
};

export async function hasActiveTenantPermission(headers: IncomingHttpHeaders, permissions: TenantPermissionRequest): Promise<boolean> {
  const context = await getActiveTenantContext(headers);
  if (!context) return false;
  const result = await auth.api.hasPermission({ headers: fromNodeHeaders(headers), body: { permissions } });
  return result.success === true;
}

export async function requireActiveTenantPermission(headers: IncomingHttpHeaders, permissions: TenantPermissionRequest): Promise<ActiveTenantContext> {
  const context = await getActiveTenantContext(headers);
  if (!context) throw Object.assign(new Error("An active organization membership is required."), { statusCode: 403, code: "TENANT_MEMBERSHIP_REQUIRED" });
  if (!(await hasActiveTenantPermission(headers, permissions))) {
    throw Object.assign(new Error("You do not have permission to perform this action."), { statusCode: 403, code: "PERMISSION_DENIED" });
  }
  return context;
}

export async function requirePlatformPermission(headers: IncomingHttpHeaders, permission: PlatformPermission) {
  const identity = await getCurrentIdentity(headers);
  if (!identity?.platformRole || !canAccessPlatformPermission(identity.platformRole, permission)) {
    throw Object.assign(new Error("You do not have permission to perform this platform operation."), {
      statusCode: 403,
      code: "PLATFORM_PERMISSION_DENIED",
    });
  }
  return { userId: identity.user.id, email: identity.user.email, role: identity.platformRole };
}

export async function requirePlatformRole(
  headers: IncomingHttpHeaders,
  allowedRoles: readonly ("platform_owner" | "platform_admin" | "platform_support")[],
): Promise<{ userId: string; email: string; role: "platform_owner" | "platform_admin" | "platform_support" }> {
  const identity = await getCurrentIdentity(headers);
  if (!identity?.platformRole || !allowedRoles.includes(identity.platformRole)) {
    throw Object.assign(new Error("Platform administrator access is required."), { statusCode: 403, code: "PLATFORM_PERMISSION_DENIED" });
  }
  return { userId: identity.user.id, email: identity.user.email, role: identity.platformRole };
}
