import { describe, expect, it, vi } from "vitest";
import {
  reconcileTenantProvisioning,
  type TenantProvisioningReconciliationStore,
} from "./tenant-reconciliation.js";

function makeStore(
  candidates: Awaited<ReturnType<TenantProvisioningReconciliationStore["findStaleProvisioningTenants"]>>,
  organizations: Awaited<ReturnType<TenantProvisioningReconciliationStore["findOrganizationsBySlugs"]>>,
  activationResults: boolean[] = [],
): TenantProvisioningReconciliationStore {
  let activationIndex = 0;
  return {
    findStaleProvisioningTenants: vi.fn().mockResolvedValue(candidates),
    findOrganizationsBySlugs: vi.fn().mockResolvedValue(organizations),
    activateTenant: vi.fn().mockImplementation(async () => {
      const result = activationResults[activationIndex] ?? true;
      activationIndex += 1;
      return result;
    }),
  };
}

describe("tenant provisioning reconciliation", () => {
  it("activates only a matching organization and tenant slug", async () => {
    const store = makeStore(
      [{ id: "tenant-a", slug: "alpha", authOrganizationId: null }],
      [{ id: "org-a", slug: "alpha", name: "Alpha Client" }],
    );
    const result = await reconcileTenantProvisioning(store);
    expect(result).toEqual({ scanned: 1, activated: 1, unmatched: [], conflicted: [] });
    expect(store.activateTenant).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      organizationId: "org-a",
      organizationName: "Alpha Client",
    });
  });

  it("leaves a tenant untouched when no matching organization exists", async () => {
    const store = makeStore(
      [{ id: "tenant-a", slug: "alpha", authOrganizationId: null }],
      [],
    );
    const result = await reconcileTenantProvisioning(store);
    expect(result.activated).toBe(0);
    expect(result.unmatched).toEqual([{ tenantId: "tenant-a", slug: "alpha" }]);
    expect(store.activateTenant).not.toHaveBeenCalled();
  });

  it("does not overwrite an existing mapping to a different organization", async () => {
    const store = makeStore(
      [{ id: "tenant-a", slug: "alpha", authOrganizationId: "org-old" }],
      [{ id: "org-new", slug: "alpha", name: "Alpha Client" }],
    );
    const result = await reconcileTenantProvisioning(store);
    expect(result.conflicted).toEqual([{
      tenantId: "tenant-a",
      slug: "alpha",
      reason: "ORGANIZATION_MAPPING_MISMATCH",
    }]);
    expect(store.activateTenant).not.toHaveBeenCalled();
  });

  it("reports a conditional activation race without overwriting changed tenant state", async () => {
    const store = makeStore(
      [{ id: "tenant-a", slug: "alpha", authOrganizationId: null }],
      [{ id: "org-a", slug: "alpha", name: "Alpha Client" }],
      [false],
    );
    const result = await reconcileTenantProvisioning(store);
    expect(result.conflicted[0]?.reason).toBe("TENANT_CHANGED_DURING_RECONCILIATION");
  });

  it("does not call the stores for invalid operator limits", async () => {
    const store = makeStore([], []);
    await expect(reconcileTenantProvisioning(store, { staleMinutes: 1 })).rejects.toThrow(/staleMinutes/);
    await expect(reconcileTenantProvisioning(store, { limit: 501 })).rejects.toThrow(/limit/);
    expect(store.findStaleProvisioningTenants).not.toHaveBeenCalled();
  });
});
