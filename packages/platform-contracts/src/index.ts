export type TenantId = string & { readonly __brand: "TenantId" };
export type UserId = string & { readonly __brand: "UserId" };

export type PlatformRole = "platform_owner" | "platform_admin" | "support";
export type TenantRole = "tenant_owner" | "tenant_admin" | "staff" | "customer";

export interface TenantContext {
  tenantId: TenantId;
  tenantSlug: string;
  currency: string;
  locale: string;
  timeZone: string;
}

export interface Principal {
  userId: UserId;
  tenantId: TenantId;
  roles: readonly (PlatformRole | TenantRole)[];
  authenticationMethod: "session" | "service_token";
}

export function assertTenantMatch(expectedTenantId: string, actualTenantId: string): void {
  if (expectedTenantId !== actualTenantId) {
    throw new Error("TENANT_CONTEXT_MISMATCH");
  }
}
