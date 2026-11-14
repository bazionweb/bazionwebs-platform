export type PlatformRole = "platform_owner" | "platform_admin" | "platform_support";

export const platformPermissions = [
  "platform.overview.read",
  "tenant.list",
  "tenant.read",
  "tenant.create",
  "tenant.update",
  "tenant.suspend",
  "tenant.restore",
  "tenant.close",
  "tenant.owner.assign",
  "module.catalog.read",
  "tenant.modules.read",
  "tenant.modules.update",
  "tenant.settings.read",
  "tenant.settings.update",
  "tenant.domain.verify",
  "audit.read",
  "usage.read",
] as const;

export type PlatformPermission = (typeof platformPermissions)[number];

const platformRolePermissions: Readonly<Record<PlatformRole, readonly PlatformPermission[]>> = {
  platform_owner: platformPermissions,
  platform_admin: [
    "tenant.list",
    "tenant.read",
    "tenant.update",
    "tenant.suspend",
    "tenant.restore",
    "tenant.modules.read",
    "tenant.modules.update",
    "tenant.settings.read",
    "tenant.settings.update",
    "tenant.domain.verify",
    "audit.read",
    "usage.read",
  ],
  platform_support: [
    "tenant.list",
    "tenant.read",
    "tenant.modules.read",
    "tenant.settings.read",
    "audit.read",
    "usage.read",
  ],
};

export function isPlatformOrganizationCreator(role: string | null | undefined): role is "platform_owner" {
  return role === "platform_owner";
}

/** Platform permissions are independent of Better Auth organization roles. */
export function canAccessPlatformPermission(
  role: string | null | undefined,
  permission: string,
): permission is PlatformPermission {
  if (role !== "platform_owner" && role !== "platform_admin" && role !== "platform_support") return false;
  return (platformRolePermissions[role] as readonly string[]).includes(permission);
}

/** Only the platform owner is global; other platform roles must match the active tenant context. */
export function canAccessPlatformTenantScope(
  platformRole: string | null | undefined,
  activeTenantId: string | null | undefined,
  targetTenantId: string | null | undefined,
): boolean {
  if (platformRole === "platform_owner") return true;
  return Boolean(activeTenantId && targetTenantId && activeTenantId === targetTenantId);
}

export function getPlatformPermissions(role: string | null | undefined): readonly PlatformPermission[] {
  if (role !== "platform_owner" && role !== "platform_admin" && role !== "platform_support") return [];
  return platformRolePermissions[role];
}

export function canCreateClientOrganization(
  role: string | null | undefined,
  emailVerified: boolean,
): boolean {
  return emailVerified && isPlatformOrganizationCreator(role);
}

function parseRoles(value: string): string[] {
  return value.split(",").map((role) => role.trim()).filter(Boolean);
}

export function canGrantClientOwner(
  platformRole: string | null | undefined,
  requestedOrganizationRoles: string,
): boolean {
  void platformRole;
  // The generic Better Auth invitation/member APIs cannot grant ownership.
  // The audited, atomic platform transfer service is the only owner-grant path.
  return !parseRoles(requestedOrganizationRoles).includes("owner");
}

export function normalizeTenantHostname(hostname: string): string | null {
  const value = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!value || value.length > 253 || value.includes("/") || value.includes("@")) return null;
  if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/.test(value)) {
    return null;
  }
  return value;
}

export async function resolveTrustedOriginsForRequest(
  request: Request | undefined,
  defaultOrigins: string[],
  nodeEnv: string,
  isVerifiedTenantHost: (hostname: string) => Promise<boolean>,
): Promise<string[]> {
  if (!request) return defaultOrigins;
  const origin = request.headers.get("origin");
  if (!origin || defaultOrigins.includes(origin)) return defaultOrigins;

  try {
    const parsed = new URL(origin);
    const host = normalizeTenantHostname(parsed.hostname);
    if (!host || parsed.username || parsed.password) return defaultOrigins;
    const local = host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");
    if (local && nodeEnv !== "production") return [...new Set([...defaultOrigins, origin])];
    if (parsed.protocol !== "https:" || (parsed.port !== "" && parsed.port !== "443")) return defaultOrigins;
    if (await isVerifiedTenantHost(host)) return [...new Set([...defaultOrigins, origin])];
  } catch {
    // Invalid origins must never enter the trusted-origin list.
  }
  return defaultOrigins;
}
