import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyticsRoutes } from "./routes.js";

const mocks = vi.hoisted(() => ({
  resolveRequestTenantId: vi.fn(),
  isTenantModuleEnabled: vi.fn(),
  requireActiveTenantPermission: vi.fn(),
  withTenantTransaction: vi.fn(),
  appendAudit: vi.fn(),
}));

vi.mock("../../lib/tenant-resolution.js", () => ({
  resolveRequestTenantId: mocks.resolveRequestTenantId,
}));
vi.mock("../../lib/tenant-modules.js", () => ({
  isTenantModuleEnabled: mocks.isTenantModuleEnabled,
}));
vi.mock("@bazion/auth", () => ({
  requireActiveTenantPermission: mocks.requireActiveTenantPermission,
}));
vi.mock("@bazion/audit", () => ({
  PostgresAuditEventWriter: class {
    append(event: unknown) {
      return mocks.appendAudit(event);
    }
  },
}));
vi.mock("../../lib/database.js", () => ({
  pool: { query: vi.fn() },
  withTenantTransaction: mocks.withTenantTransaction,
}));

describe("analytics module routes", () => {
  const tenantId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestTenantId.mockResolvedValue(tenantId);
    mocks.isTenantModuleEnabled.mockResolvedValue(true);
    mocks.requireActiveTenantPermission.mockResolvedValue({
      userId: "owner-1",
      email: "owner@example.test",
      name: "Owner",
      organizationId: "org-1",
      tenantId,
      tenantSlug: "alpha",
      tenantName: "Alpha",
      currency: "KES",
      roles: ["owner"],
    });
    mocks.appendAudit.mockResolvedValue(undefined);
  });

  async function createApp() {
    const app = Fastify();
    await app.register(analyticsRoutes, {
      prefix: "/v1",
      config: { NODE_ENV: "test", TENANT_RESOLUTION_MODE: "dynamic" } as never,
    });
    return app;
  }

  it("enforces module entitlement on public ingestion and admin summary", async () => {
    mocks.isTenantModuleEnabled.mockResolvedValue(false);
    const app = await createApp();
    try {
      const pubRes = await app.inject({
        method: "POST",
        url: "/v1/public/analytics/events",
        payload: { name: "page_view", path: "/" },
      });
      expect(pubRes.statusCode).toBe(404);

      const adminRes = await app.inject({ method: "GET", url: "/v1/admin/analytics/summary" });
      expect(adminRes.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("summarizes events, computes conversions, and purges tenant analytics with audit", async () => {
    mocks.withTenantTransaction
      .mockResolvedValueOnce({
        rows: [
          { eventName: "page_view", path: "/" },
          { eventName: "order_paid", path: "/shop" },
        ],
        policy: { tenantId, enabled: true, retentionDays: 90, updatedAt: null },
      })
      .mockResolvedValueOnce([{ id: "evt-1" }, { id: "evt-2" }]);

    const app = await createApp();
    try {
      const summaryRes = await app.inject({ method: "GET", url: "/v1/admin/analytics/summary?days=30" });
      expect(summaryRes.statusCode).toBe(200);
      expect(summaryRes.json()).toMatchObject({
        summary: { totalEvents: 2, pageViews: 1, conversions: 1, conversionRatePercent: 100 },
      });

      const purgeRes = await app.inject({ method: "DELETE", url: "/v1/admin/analytics/events" });
      expect(purgeRes.statusCode).toBe(200);
      expect(purgeRes.json()).toEqual({ purged: true, deletedCount: 2 });
      expect(mocks.appendAudit).toHaveBeenCalledWith(expect.objectContaining({
        action: "analytics.events.purged",
        metadata: { deletedCount: 2 },
      }));
    } finally {
      await app.close();
    }
  });
});
