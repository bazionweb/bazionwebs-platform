import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { commerceAdminRoutes } from "./admin-routes.js";

const mocks = vi.hoisted(() => ({
  requireActiveTenantPermission: vi.fn(),
  isTenantModuleEnabled: vi.fn(),
  withTenantTransaction: vi.fn(),
  appendAudit: vi.fn(),
}));

vi.mock("@bazion/auth", () => ({
  requireActiveTenantPermission: mocks.requireActiveTenantPermission,
}));
vi.mock("../../lib/tenant-modules.js", () => ({
  isTenantModuleEnabled: mocks.isTenantModuleEnabled,
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

describe("commerce admin routes", () => {
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const productId = "22222222-2222-4222-8222-222222222222";
  const orderId = "33333333-3333-4333-8333-333333333333";

  beforeEach(() => {
    vi.clearAllMocks();
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
    await app.register(commerceAdminRoutes, { prefix: "/v1" });
    return app;
  }

  it("archives ordered products cleanly and blocks deleting products with active reservations", async () => {
    mocks.withTenantTransaction
      .mockResolvedValueOnce({ kind: "reserved" })
      .mockResolvedValueOnce({ kind: "archived", product: { id: productId, active: false } })
      .mockResolvedValueOnce({ kind: "deleted" });

    const app = await createApp();
    try {
      const reservedRes = await app.inject({ method: "DELETE", url: `/v1/admin/commerce/products/${productId}` });
      expect(reservedRes.statusCode).toBe(409);
      expect(reservedRes.json().error).toBe("PRODUCT_HAS_ACTIVE_RESERVATIONS");

      const archivedRes = await app.inject({ method: "DELETE", url: `/v1/admin/commerce/products/${productId}` });
      expect(archivedRes.statusCode).toBe(200);
      expect(archivedRes.json().kind).toBe("archived");

      const deletedRes = await app.inject({ method: "DELETE", url: `/v1/admin/commerce/products/${productId}` });
      expect(deletedRes.statusCode).toBe(200);
      expect(deletedRes.json().kind).toBe("deleted");
      expect(mocks.requireActiveTenantPermission).toHaveBeenCalledWith(expect.any(Object), { product: ["delete"] });
    } finally {
      await app.close();
    }
  });

  it("requires order:refund permission for refunds and rejects invalid transitions", async () => {
    mocks.withTenantTransaction
      .mockResolvedValueOnce({ kind: "updated", order: { id: orderId, status: "refunded" } })
      .mockResolvedValueOnce({ kind: "invalid_state", order: { id: orderId, status: "pending_payment" }, reason: "Only paid or fulfilled orders can be refunded." });

    const app = await createApp();
    try {
      const refundRes = await app.inject({
        method: "PATCH",
        url: `/v1/admin/commerce/orders/${orderId}`,
        payload: { status: "refunded", restock: true, reason: "Customer returned item" },
      });
      expect(refundRes.statusCode).toBe(200);
      expect(refundRes.json().order.status).toBe("refunded");
      expect(mocks.requireActiveTenantPermission).toHaveBeenCalledWith(expect.any(Object), { order: ["refund"] });

      const conflictRes = await app.inject({
        method: "PATCH",
        url: `/v1/admin/commerce/orders/${orderId}`,
        payload: { status: "refunded" },
      });
      expect(conflictRes.statusCode).toBe(409);
      expect(conflictRes.json().error).toBe("ORDER_INVALID_STATE_TRANSITION");
    } finally {
      await app.close();
    }
  });

  it("returns explicit unavailable state when reconciling without Daraja credentials", async () => {
    mocks.withTenantTransaction.mockResolvedValueOnce({
      kind: "pending",
      order: { id: orderId, status: "pending_payment" },
      attempt: null,
    });
    const app = await createApp();
    try {
      const res = await app.inject({
        method: "POST",
        url: `/v1/admin/commerce/orders/${orderId}/reconcile-payment`,
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error).toBe("PAYMENT_RECONCILIATION_UNAVAILABLE");
    } finally {
      await app.close();
    }
  });
});
