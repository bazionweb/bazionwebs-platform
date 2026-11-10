export interface ProvisioningTenantCandidate {
  id: string;
  slug: string;
  authOrganizationId: string | null;
}

export interface AuthOrganizationRecord {
  id: string;
  slug: string;
  name: string;
}

/** Persistence boundary for reconciling tenant reservations with auth organizations. */
export interface TenantProvisioningReconciliationPort {
  findStaleProvisioningTenants(staleMinutes: number, limit: number): Promise<ProvisioningTenantCandidate[]>;
  findOrganizationsBySlugs(slugs: string[]): Promise<AuthOrganizationRecord[]>;
  /** Must update only a tenant still provisioning with no mapping or the same organization mapping. */
  activateTenant(input: {
    tenantId: string;
    organizationId: string;
    organizationName: string;
  }): Promise<boolean>;
}

/** @deprecated Use TenantProvisioningReconciliationPort. */
export type TenantProvisioningReconciliationStore = TenantProvisioningReconciliationPort;

export interface TenantProvisioningReconciliationResult {
  scanned: number;
  activated: number;
  unmatched: Array<{ tenantId: string; slug: string }>;
  conflicted: Array<{
    tenantId: string;
    slug: string;
    reason: "ORGANIZATION_MAPPING_MISMATCH" | "TENANT_CHANGED_DURING_RECONCILIATION";
  }>;
}

/**
 * Reconciles stale tenant reservations against identity-provider organizations.
 * It never deletes reservations or overwrites conflicting mappings.
 */
export async function reconcileTenantProvisioning(
  port: TenantProvisioningReconciliationPort,
  options: { staleMinutes?: number; limit?: number } = {},
): Promise<TenantProvisioningReconciliationResult> {
  const staleMinutes = options.staleMinutes ?? 10;
  const limit = options.limit ?? 100;
  if (!Number.isInteger(staleMinutes) || staleMinutes < 5 || staleMinutes > 1_440) {
    throw new Error("staleMinutes must be an integer between 5 and 1440.");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new Error("limit must be an integer between 1 and 500.");
  }

  const candidates = await port.findStaleProvisioningTenants(staleMinutes, limit);
  const slugs = [...new Set(candidates.map((candidate) => candidate.slug))];
  const organizations = slugs.length ? await port.findOrganizationsBySlugs(slugs) : [];
  const organizationsBySlug = new Map(organizations.map((organization) => [organization.slug, organization]));

  const result: TenantProvisioningReconciliationResult = {
    scanned: candidates.length,
    activated: 0,
    unmatched: [],
    conflicted: [],
  };

  for (const candidate of candidates) {
    const organization = organizationsBySlug.get(candidate.slug);
    if (!organization) {
      result.unmatched.push({ tenantId: candidate.id, slug: candidate.slug });
      continue;
    }
    if (candidate.authOrganizationId && candidate.authOrganizationId !== organization.id) {
      result.conflicted.push({
        tenantId: candidate.id,
        slug: candidate.slug,
        reason: "ORGANIZATION_MAPPING_MISMATCH",
      });
      continue;
    }

    const activated = await port.activateTenant({
      tenantId: candidate.id,
      organizationId: organization.id,
      organizationName: organization.name,
    });
    if (activated) {
      result.activated += 1;
    } else {
      result.conflicted.push({
        tenantId: candidate.id,
        slug: candidate.slug,
        reason: "TENANT_CHANGED_DURING_RECONCILIATION",
      });
    }
  }

  return result;
}
