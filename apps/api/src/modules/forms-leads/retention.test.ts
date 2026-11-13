import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listTenantIdsForMaintenance: vi.fn(),
  withTenantMaintenanceTransaction: vi.fn(),
  deleteBatches: new Map<string, Array<Array<{ id: string }>>>(),
  batchIndexes: new Map<string, number>(),
  tenantIds: [] as string[],
}));

vi.mock("../../lib/database.js", () => ({
  listTenantIdsForMaintenance: mocks.listTenantIdsForMaintenance,
  withTenantMaintenanceTransaction: mocks.withTenantMaintenanceTransaction,
}));

describe("site enquiry retention job", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tenantIds = [];
    mocks.deleteBatches = new Map();
    mocks.batchIndexes = new Map();
    mocks.listTenantIdsForMaintenance.mockImplementation(async () => mocks.tenantIds);
    mocks.withTenantMaintenanceTransaction.mockImplementation(async (tenantId: string, callback: (tx: unknown) => Promise<unknown>) => {
      const batches = mocks.deleteBatches.get(tenantId) ?? [];
      const index = mocks.batchIndexes.get(tenantId) ?? 0;
      mocks.batchIndexes.set(tenantId, index + 1);
      return callback({ execute: vi.fn(async () => ({ rows: batches[index] ?? [] })) });
    });
  });

  it("deletes expired records sequentially for all tenants, including inactive tenants", async () => {
    const activeTenantId = "11111111-1111-4111-8111-111111111111";
    const suspendedTenantId = "22222222-2222-4222-8222-222222222222";
    mocks.tenantIds = [activeTenantId, suspendedTenantId];
    mocks.deleteBatches.set(activeTenantId, [
      Array.from({ length: 500 }, (_value, index) => ({ id: `active-${index}` })),
      [{ id: "active-last" }],
    ]);
    mocks.deleteBatches.set(suspendedTenantId, [[{ id: "suspended" }]]);
    const asOf = new Date("2026-11-11T10:00:00.000Z");
    const { runSiteEnquiryRetentionCleanup } = await import("./retention.js");

    await expect(runSiteEnquiryRetentionCleanup(asOf)).resolves.toEqual({
      tenantsProcessed: 2,
      enquiriesDeleted: 502,
    });
    expect(mocks.withTenantMaintenanceTransaction.mock.calls.map(([tenantId]) => tenantId))
      .toEqual([activeTenantId, activeTenantId, suspendedTenantId]);
  });

  it("performs no database writes when there are no tenants", async () => {
    const { runSiteEnquiryRetentionCleanup } = await import("./retention.js");

    await expect(runSiteEnquiryRetentionCleanup()).resolves.toEqual({ tenantsProcessed: 0, enquiriesDeleted: 0 });
    expect(mocks.withTenantMaintenanceTransaction).not.toHaveBeenCalled();
  });
});
