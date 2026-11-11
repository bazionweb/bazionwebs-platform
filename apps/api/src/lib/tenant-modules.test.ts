import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("./database.js", () => ({ pool: { query: mocks.query } }));

import { isTenantModuleEnabled } from "./tenant-modules.js";

describe("tenant module entitlement resolution", () => {
  beforeEach(() => mocks.query.mockReset());

  it("keeps optional product modules disabled until provisioning grants an entitlement", async () => {
    for (const moduleId of ["commerce", "analytics", "church-ministry"]) {
      mocks.query.mockResolvedValueOnce({ rows: [{ status: "active", enabled: null }] });
      await expect(isTenantModuleEnabled("tenant-a", moduleId)).resolves.toBe(false);
    }
  });

  it("keeps planned modules disabled by default", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ status: "active", enabled: null }] });
    await expect(isTenantModuleEnabled("tenant-a", "contacts-crm")).resolves.toBe(false);
  });

  it("honors explicit tenant overrides and denies inactive or unknown tenants", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ status: "active", enabled: true }] });
    await expect(isTenantModuleEnabled("tenant-a", "commerce")).resolves.toBe(true);

    mocks.query.mockResolvedValueOnce({ rows: [{ status: "active", enabled: false }] });
    await expect(isTenantModuleEnabled("tenant-a", "commerce")).resolves.toBe(false);

    mocks.query.mockResolvedValueOnce({ rows: [{ status: "suspended", enabled: true }] });
    await expect(isTenantModuleEnabled("tenant-a", "commerce")).resolves.toBe(false);

    mocks.query.mockResolvedValueOnce({ rows: [] });
    await expect(isTenantModuleEnabled("missing-tenant", "commerce")).resolves.toBe(false);
  });
});
