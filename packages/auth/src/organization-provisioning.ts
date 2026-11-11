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

export function createAfterCreateOrganizationHook(
  pool: OrganizationTenantLinkQuery,
  environment: string,
): (input: { organization: AuthOrganization }) => Promise<void> {
  return async ({ organization }) => {
    const slug = organization.slug?.trim();
    const tenantId = await linkOrganizationToTenant(pool, organization);

    // Local tenant hosts are a development convenience, never a production domain.
    if (environment !== "production" && slug) {
      const hostname = `${slug}.localhost`;
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
        throw new Error("The development tenant hostname is already assigned to another tenant.");
      }
    }
  };
}
