import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ withTenantTransaction: vi.fn() }));

vi.mock("./database.js", () => ({ withTenantTransaction: mocks.withTenantTransaction }));

import { getTenantMaintenanceStatus } from "./tenant-maintenance.js";

describe("tenant maintenance status", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns disabled when no tenant setting exists", async () => {
    mocks.withTenantTransaction.mockResolvedValue(null);
    await expect(getTenantMaintenanceStatus("tenant-a")).resolves.toEqual({ enabled: false, message: "" });
  });

  it("returns an enabled notice with control characters removed and a bounded message", async () => {
    const message = "Update\r\n" + "x".repeat(600);
    mocks.withTenantTransaction.mockResolvedValue(JSON.stringify({ enabled: true, message }));

    const result = await getTenantMaintenanceStatus("tenant-a");

    expect(result.enabled).toBe(true);
    expect(result.message).toBe(`Update ${"x".repeat(493)}`);
    expect(result.message).toHaveLength(500);
  });

  it("fails closed when the stored maintenance value is malformed", async () => {
    mocks.withTenantTransaction.mockResolvedValue("not-json");

    await expect(getTenantMaintenanceStatus("tenant-a")).rejects.toMatchObject({
      statusCode: 503,
      code: "MAINTENANCE_STATUS_UNAVAILABLE",
    });
  });

  it("fails closed when tenant settings cannot be read", async () => {
    mocks.withTenantTransaction.mockRejectedValue(new Error("database unavailable"));

    await expect(getTenantMaintenanceStatus("tenant-a")).rejects.toMatchObject({
      statusCode: 503,
      code: "MAINTENANCE_STATUS_UNAVAILABLE",
    });
  });
});
