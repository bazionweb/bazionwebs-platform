import { describe, expect, it, vi } from "vitest";
import {
  createAfterCreateOrganizationHook,
  linkOrganizationToTenant,
  type OrganizationTenantLinkQuery,
} from "./organization-provisioning.js";

describe("auth organization to platform tenant mapping", () => {
  it("links the reserved tenant without seeding product modules or content", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [{ id: "tenant-1" }] });
    const tenantId = await linkOrganizationToTenant(
      { query } as unknown as OrganizationTenantLinkQuery,
      { id: "org-1", slug: "global-mission", name: "Global Mission" },
    );

    expect(tenantId).toBe("tenant-1");
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("UPDATE public.tenants"), [
      "org-1", "Global Mission", "global-mission",
    ]);
    expect(query.mock.calls[0]?.[0]).not.toMatch(/ministry_|tenant_module_entitlements|tenant_domains/);
  });

  it("rejects missing organization mapping fields before writing", async () => {
    const query = vi.fn();

    await expect(linkOrganizationToTenant(
      { query } as unknown as OrganizationTenantLinkQuery,
      { id: "org-1", slug: " ", name: "Global Mission" },
    )).rejects.toThrow("Organization was created without the required Bazion tenant mapping fields.");
    expect(query).not.toHaveBeenCalled();
  });

  it("fails when the reserved tenant cannot be linked exactly once", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });

    await expect(linkOrganizationToTenant(
      { query } as unknown as OrganizationTenantLinkQuery,
      { id: "org-1", slug: "global-mission", name: "Global Mission" },
    )).rejects.toThrow("Organization was created but its Bazion tenant mapping needs reconciliation.");
  });

  it("creates a local tenant hostname only outside production", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "tenant-1" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ tenant_id: "tenant-1" }] });
    const hook = createAfterCreateOrganizationHook(
      { query } as unknown as OrganizationTenantLinkQuery,
      "development",
    );

    await hook({ organization: { id: "org-1", slug: "global-mission", name: "Global Mission" } });

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1]?.[0]).toContain("INSERT INTO public.tenant_domains");
    expect(query.mock.calls[1]?.[1]).toEqual(["tenant-1", "global-mission.localhost"]);
  });

  it("never creates an unverified local hostname in production", async () => {
    const query = vi.fn().mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "tenant-1" }] });
    const hook = createAfterCreateOrganizationHook(
      { query } as unknown as OrganizationTenantLinkQuery,
      "production",
    );

    await hook({ organization: { id: "org-1", slug: "global-mission", name: "Global Mission" } });

    expect(query).toHaveBeenCalledTimes(1);
  });

  it("provisions a server-based preview subdomain in production when PUBLIC_STOREFRONT_URL is configured", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "tenant-1" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ tenant_id: "tenant-1" }] });
    const hook = createAfterCreateOrganizationHook(
      { query } as unknown as OrganizationTenantLinkQuery,
      "production",
      "https://sites.bazion.example",
    );

    await hook({ organization: { id: "org-1", slug: "global-mission", name: "Global Mission" } });

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1]?.[0]).toContain("INSERT INTO public.tenant_domains");
    expect(query.mock.calls[1]?.[1]).toEqual(["tenant-1", "global-mission.sites.bazion.example"]);
  });
});
