import {
  buildTenantDomainVisitUrl,
  buildTenantStorefrontUrl,
  buildTenantWorkspacePickerUrl,
  resolveConfiguredWorkspaceBaseUrl,
} from "@bazion/auth/client";

const DEV_FALLBACK_STOREFRONT_ORIGIN = "http://localhost:3000";

export function getPublicStorefrontBaseUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_PUBLIC_STOREFRONT_URL
    || process.env.PUBLIC_STOREFRONT_URL
    || DEV_FALLBACK_STOREFRONT_ORIGIN;
  return resolveConfiguredWorkspaceBaseUrl(configured);
}

export function getTenantStorefrontUrl(tenantSlug: string): string {
  return buildTenantStorefrontUrl(getPublicStorefrontBaseUrl(), tenantSlug);
}

export function getTenantDomainUrl(hostname: string): string {
  return buildTenantDomainVisitUrl(hostname, getPublicStorefrontBaseUrl());
}

export function getTenantWorkspacePickerUrl(
  input: { slug: string; authOrganizationId?: string | null },
  next: "/admin" | "/workspace" = "/admin",
): string {
  return buildTenantWorkspacePickerUrl(getPublicStorefrontBaseUrl(), {
    organizationId: input.authOrganizationId ?? null,
    tenantSlug: input.slug,
    next,
  });
}

export function getDefaultTenantAdminUrl(): string {
  return `${getPublicStorefrontBaseUrl()}/admin`;
}

