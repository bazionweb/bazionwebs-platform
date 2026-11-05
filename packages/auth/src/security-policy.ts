export type PlatformRole = "platform_owner" | "platform_admin" | "platform_support";

export function isPlatformOrganizationCreator(role: string | null | undefined): role is "platform_owner" | "platform_admin" {
  return role === "platform_owner" || role === "platform_admin";
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
  return !parseRoles(requestedOrganizationRoles).includes("owner") || isPlatformOrganizationCreator(platformRole);
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
    const local = host === "localhost" || host === "127.0.0.1";
    if (!host || parsed.username || parsed.password) return defaultOrigins;
    if (local && nodeEnv !== "production") return [...new Set([...defaultOrigins, origin])];
    if (parsed.protocol !== "https:" || (parsed.port !== "" && parsed.port !== "443")) return defaultOrigins;
    if (await isVerifiedTenantHost(host)) return [...new Set([...defaultOrigins, origin])];
  } catch {
    // Invalid origins must never enter the trusted-origin list.
  }
  return defaultOrigins;
}
