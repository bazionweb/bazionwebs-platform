import type { Principal } from "@bazion/platform-contracts";

export interface Authenticator {
  authenticate(authorizationHeader?: string, sessionCookie?: string): Promise<Principal | null>;
}

export interface AuthorizationPolicy {
  can(principal: Principal, action: string, resourceTenantId: string): boolean;
}

// Intentionally no homemade password/session implementation. Plug in a maintained identity provider.
export function requireTenantRole(principal: Principal, allowedRoles: readonly string[], resourceTenantId: string): void {
  if (principal.tenantId !== resourceTenantId || !principal.roles.some((role) => allowedRoles.includes(role))) {
    throw new Error("FORBIDDEN");
  }
}
