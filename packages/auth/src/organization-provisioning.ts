import { buildTenantSubdomainHostname } from "./deep-links.js";

export interface OrganizationTenantLinkQuery {
  query(
    sql: string,
    values: unknown[],
  ): Promise<{ rowCount: number | null; rows: Array<Record<string, unknown>> }>;
}

export interface AuthOrganization {
  id: string;
  slug?: string;
  name?: string;
}

/** Link the auth organization to its already-reserved platform tenant. */
export async function linkOrganizationToTenant(
  pool: OrganizationTenantLinkQuery,
  organization: AuthOrganization,
): Promise<string> {
  const organizationId = organization.id;
  const slug = organization.slug?.trim();
  const name = organization.name?.trim();
  if (!organizationId || !slug || !name) {
    throw new Error("Organization was created without the required Bazion tenant mapping fields.");
  }

  const result = await pool.query(
    `UPDATE public.tenants
        SET auth_organization_id = $1, name = $2, status = 'active', updated_at = now()
      WHERE slug = $3
        AND status IN ('provisioning', 'active')
        AND (auth_organization_id IS NULL OR auth_organization_id = $1)
      RETURNING id`,
    [organizationId, name, slug],
  );
  const tenantId = result.rows[0]?.id;
  if (result.rowCount !== 1 || typeof tenantId !== "string" || !tenantId) {
    throw new Error("Organization was created but its Bazion tenant mapping needs reconciliation.");
  }
  return tenantId;
}

function resolvePreviewHostname(
  slug: string,
  environment: string,
  publicStorefrontUrl?: string,
): string | null {
  if (!slug) return null;
  if (environment !== "production") {
    return `${slug}.localhost`;
  }
  if (!publicStorefrontUrl?.trim()) return null;
  try {
    const parsed = new URL(publicStorefrontUrl.trim());
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".localhost")) {
      return null;
    }
    return buildTenantSubdomainHostname(publicStorefrontUrl, slug);
  } catch {
    return null;
  }
}

export function createAfterCreateOrganizationHook(
  pool: OrganizationTenantLinkQuery,
  environment: string,
  publicStorefrontUrl?: string,
): (input: { organization: AuthOrganization }) => Promise<void> {
  return async ({ organization }) => {
    const slug = organization.slug?.trim();
    const tenantId = await linkOrganizationToTenant(pool, organization);

    const hostname = slug ? resolvePreviewHostname(slug, environment, publicStorefrontUrl) : null;
    if (hostname) {
      const result = await pool.query(
        `INSERT INTO public.tenant_domains (tenant_id, hostname, status, verified_at)
         VALUES ($1, $2, 'active', now())
         ON CONFLICT (hostname) DO UPDATE
           SET hostname = EXCLUDED.hostname
           WHERE public.tenant_domains.tenant_id = EXCLUDED.tenant_id
         RETURNING tenant_id`,
        [tenantId, hostname],
      );
      if (result.rowCount !== 1 || result.rows[0]?.tenant_id !== tenantId) {
        throw new Error("The tenant preview hostname is already assigned to another tenant.");
      }
    }
  };
}
