import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { troubleshootingRoutes } from "./troubleshooting-routes.js";

const mocks = vi.hoisted(() => ({
  requirePlatformRole: vi.fn(),
  appendAuditEvent: vi.fn(),
  query: vi.fn(),
  connect: vi.fn(),
  listPlatformUsers: vi.fn(),
  forceVerifyPlatformUserEmail: vi.fn(),
  revokePlatformUserSessions: vi.fn(),
  generateEmergencyPasswordResetUrl: vi.fn(),
  diagnoseTenantDomainDns: vi.fn(),
}));

vi.mock("@bazion/audit", () => ({
  PostgresAuditEventWriter: class {
    append(event: unknown) {
      return mocks.appendAuditEvent(event);
    }
  },
}));

vi.mock("@bazion/auth", () => ({
  requirePlatformRole: mocks.requirePlatformRole,
}));

vi.mock("@bazion/auth/server", () => ({
  requirePlatformRole: mocks.requirePlatformRole,
  listPlatformUsers: mocks.listPlatformUsers,
  forceVerifyPlatformUserEmail: mocks.forceVerifyPlatformUserEmail,
  revokePlatformUserSessions: mocks.revokePlatformUserSessions,
  generateEmergencyPasswordResetUrl: mocks.generateEmergencyPasswordResetUrl,
}));

vi.mock("./domain-verification.js", () => ({
  diagnoseTenantDomainDns: mocks.diagnoseTenantDomainDns,
}));

vi.mock("../../lib/database.js", () => ({
  pool: {
    query: mocks.query,
    connect: mocks.connect,
  },
}));

describe("Superadmin Troubleshooting Routes", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.requirePlatformRole.mockResolvedValue({
      userId: "operator-1",
      email: "operator@bazion.test",
      role: "platform_owner",
    });
    mocks.appendAuditEvent.mockResolvedValue(undefined);

    app = Fastify();
    await app.register(troubleshootingRoutes);
  });

  describe("Outbox Troubleshooting", () => {
    it("lists notification outbox items and summary", async () => {
      mocks.query
        .mockResolvedValueOnce({ rows: [{ total: "1" }] }) // count
        .mockResolvedValueOnce({ rows: [{ status: "dead", count: "1" }] }) // summary
        .mockResolvedValueOnce({
          rows: [
            {
              id: "outbox-1",
              tenant_id: "tenant-1",
              tenant_name: "Tenant 1",
              channel: "email",
              payload_ciphertext: "mock_cipher",
              idempotency_key: "idem-1",
              status: "dead",
              attempts: 8,
              max_attempts: 8,
              available_at: new Date().toISOString(),
              locked_at: null,
              sent_at: null,
              last_error_code: "SMTP_TIMEOUT",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        });

      const response = await app.inject({
        method: "GET",
        url: "/admin/platform/troubleshoot/outbox",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.items).toHaveLength(1);
      expect(body.items[0].lastErrorCode).toBe("SMTP_TIMEOUT");
      expect(body.summary.dead).toBe(1);
    });

    it("retries a dead notification outbox item", async () => {
      mocks.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "outbox-1", status: "pending" }],
      });

      const response = await app.inject({
        method: "POST",
        url: "/admin/platform/troubleshoot/outbox/outbox-1/retry",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ success: true, item: { id: "outbox-1", status: "pending" } });
      expect(mocks.appendAuditEvent).toHaveBeenCalled();
    });

    it("batch retries dead notifications", async () => {
      mocks.query.mockResolvedValueOnce({
        rowCount: 4,
        rows: [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }],
      });

      const response = await app.inject({
        method: "POST",
        url: "/admin/platform/troubleshoot/outbox/batch-retry-dead",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ success: true, requeuedCount: 4 });
    });

    it("cancels a stuck notification", async () => {
      mocks.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "outbox-1", status: "dead" }],
      });

      const response = await app.inject({
        method: "POST",
        url: "/admin/platform/troubleshoot/outbox/outbox-1/cancel",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().success).toBe(true);
    });
  });

  describe("Payments & Reconciliation", () => {
    it("lists payment transactions", async () => {
      mocks.query.mockResolvedValueOnce({
        rows: [
          {
            id: "tx-1",
            tenant_id: "tenant-1",
            tenant_name: "Grace Church",
            donation_id: "don-1",
            provider: "mpesa-daraja",
            provider_reference: "QGH12345",
            checkout_request_id: "ws_CO_1234",
            merchant_request_id: "MR_1234",
            amount_minor: "50000",
            currency: "KES",
            transaction_status: "pending",
            verified_at: null,
            raw_callback_json: null,
            created_at: new Date().toISOString(),
            donor_name: "Jane Doe",
            donor_phone: "254712345678",
            donor_email: "jane@test.com",
          },
        ],
      });

      const response = await app.inject({
        method: "GET",
        url: "/admin/platform/troubleshoot/payments",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.items).toHaveLength(1);
      expect(body.items[0].providerReference).toBe("QGH12345");
      expect(body.items[0].amountMinor).toBe(50000);
    });

    it("reconciles payment transaction to succeeded", async () => {
      const client = {
        query: vi.fn(),
        release: vi.fn(),
      };
      mocks.connect.mockResolvedValueOnce(client);

      client.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ id: "tx-1", tenant_id: "tenant-1", donation_id: "don-1", transaction_status: "pending" }],
        })
        .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE church_payment_transactions
        .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE church_donations
        .mockResolvedValueOnce(undefined); // COMMIT

      const response = await app.inject({
        method: "POST",
        url: "/admin/platform/troubleshoot/payments/tx-1/reconcile",
        payload: {
          source: "church_donation",
          action: "mark_succeeded",
          providerReference: "QGH889900",
          reason: "Customer verified with Safaricom M-Pesa receipt",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ success: true, status: "succeeded" });
      expect(mocks.appendAuditEvent).toHaveBeenCalled();
    });
  });

  describe("DNS Diagnostics & Custom Domains", () => {
    it("runs DNS diagnostics for a hostname", async () => {
      mocks.diagnoseTenantDomainDns.mockResolvedValueOnce({
        hostname: "church.org",
        challengeHostname: "_bazionweb-challenge.church.org",
        tokenMatched: true,
        dnsReachable: true,
        challengeTxtRecords: ["bazionweb-verification=token123"],
        rootTxtRecords: [],
        aRecords: ["192.0.2.1"],
        cnameRecords: [],
        issues: [],
        recommendations: [],
      });

      const response = await app.inject({
        method: "POST",
        url: "/admin/platform/troubleshoot/domains/diagnose",
        payload: { hostname: "church.org" },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.tokenMatched).toBe(true);
      expect(body.aRecords).toContain("192.0.2.1");
    });

    it("forces domain verification by superadmin override", async () => {
      mocks.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "dom-1", hostname: "church.org", status: "active" }],
      });

      const response = await app.inject({
        method: "POST",
        url: "/admin/platform/troubleshoot/domains/dom-1/force-verify",
        payload: { reason: "Customer DNS verified manually via cloud flare" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().success).toBe(true);
      expect(response.json().domain.status).toBe("active");
    });
  });

  describe("User & Auth Rescue", () => {
    it("lists platform users with organization memberships", async () => {
      mocks.listPlatformUsers.mockResolvedValueOnce({
        items: [
          {
            id: "user-1",
            email: "pastor@church.org",
            name: "Pastor John",
            emailVerified: false,
            createdAt: new Date().toISOString(),
            memberships: [{ organizationId: "org-1", organizationName: "Grace Church", organizationSlug: "grace", role: "admin" }],
            activeSessionsCount: 2,
          },
        ],
        total: 1,
        limit: 25,
        offset: 0,
      });

      const response = await app.inject({
        method: "GET",
        url: "/admin/platform/troubleshoot/users",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.items).toHaveLength(1);
      expect(body.items[0].emailVerified).toBe(false);
    });

    it("forces user email verification", async () => {
      mocks.forceVerifyPlatformUserEmail.mockResolvedValueOnce(true);

      const response = await app.inject({
        method: "POST",
        url: "/admin/platform/troubleshoot/users/user-1/force-verify-email",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ success: true, userId: "user-1" });
    });

    it("generates emergency password reset link", async () => {
      mocks.generateEmergencyPasswordResetUrl.mockResolvedValueOnce({
        resetUrl: "http://localhost:3000/reset-password?token=secret123",
        email: "pastor@church.org",
      });

      const response = await app.inject({
        method: "POST",
        url: "/admin/platform/troubleshoot/users/user-1/emergency-reset-link",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        success: true,
        resetUrl: "http://localhost:3000/reset-password?token=secret123",
      });
    });

    it("revokes user active sessions", async () => {
      mocks.revokePlatformUserSessions.mockResolvedValueOnce(3);

      const response = await app.inject({
        method: "POST",
        url: "/admin/platform/troubleshoot/users/user-1/revoke-sessions",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ success: true, revokedSessions: 3 });
    });
  });

  describe("Tenant Maintenance & Overrides", () => {
    it("retrieves tenant health and maintenance status", async () => {
      mocks.query
        .mockResolvedValueOnce({ rows: [{ id: "tenant-1", slug: "grace", name: "Grace Church", status: "active" }] })
        .mockResolvedValueOnce({ rows: [{ tier: "shared", state: "shared", schema_version: "2026-11" }] })
        .mockResolvedValueOnce({ rows: [{ setting_key: "maintenance_mode", setting_value: JSON.stringify({ enabled: true, message: "Server upgrades" }) }] })
        .mockResolvedValueOnce({ rows: [{ total: "10", raised: "500000" }] });

      const response = await app.inject({
        method: "GET",
        url: "/admin/platform/troubleshoot/tenants/tenant-1/health",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.tenant.name).toBe("Grace Church");
      expect(body.maintenance.enabled).toBe(true);
      expect(body.donations.count).toBe(10);
    });

    it("toggles tenant maintenance mode", async () => {
      mocks.query.mockResolvedValueOnce({ rowCount: 1 });

      const response = await app.inject({
        method: "POST",
        url: "/admin/platform/troubleshoot/tenants/tenant-1/maintenance",
        payload: {
          enabled: true,
          message: "System undergoing upgrade",
          reason: "Database index maintenance",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ success: true, enabled: true });
    });

    it("force overrides tenant module entitlement", async () => {
      mocks.query.mockResolvedValueOnce({ rowCount: 1 });

      const response = await app.inject({
        method: "POST",
        url: "/admin/platform/troubleshoot/tenants/tenant-1/modules/force-override",
        payload: {
          moduleId: "analytics",
          enabled: true,
          reason: "Customer pilot program exemption",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ success: true, moduleId: "analytics", enabled: true });
    });

    it("overrides tenant status to suspended or active", async () => {
      mocks.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "tenant-1", name: "Grace Church", slug: "grace", status: "suspended" }],
      });

      const response = await app.inject({
        method: "POST",
        url: "/admin/platform/troubleshoot/tenants/tenant-1/status",
        payload: {
          status: "suspended",
          reason: "Payment default investigation",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().success).toBe(true);
      expect(response.json().tenant.status).toBe("suspended");
      expect(mocks.appendAuditEvent).toHaveBeenCalled();
    });

    it("retrieves catalog modules with tenant entitlement states", async () => {
      mocks.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "tenant-1", name: "Grace Church", slug: "grace" }] })
        .mockResolvedValueOnce({
          rows: [{ module_id: "analytics", enabled: true, updated_at: new Date().toISOString() }],
        });

      const response = await app.inject({
        method: "GET",
        url: "/admin/platform/troubleshoot/tenants/tenant-1/modules",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.tenantId).toBe("tenant-1");
      expect(Array.isArray(body.modules)).toBe(true);
      const analytics = body.modules.find((m: any) => m.id === "analytics");
      expect(analytics).toBeDefined();
      expect(analytics.effectiveEnabled).toBe(true);
    });

    it("generates tenant recovery disaster snapshot export", async () => {
      mocks.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "tenant-1", name: "Grace Church", slug: "grace" }] })
        .mockResolvedValueOnce({ rows: [{ id: "dom-1", hostname: "grace.church" }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ tier: "shared", state: "shared", schema_version: "0015" }] });

      const response = await app.inject({
        method: "GET",
        url: "/admin/platform/troubleshoot/tenants/tenant-1/recovery-export",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.tenant.name).toBe("Grace Church");
      expect(body.domains).toHaveLength(1);
    });
  });

  describe("Commerce Payment Reconciler & Daraja Query", () => {
    it("reconciles commerce order payment attempt", async () => {
      const client = {
        query: vi.fn(),
        release: vi.fn(),
      };
      mocks.connect.mockResolvedValueOnce(client);

      client.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ id: "pa-1", tenant_id: "tenant-1", order_id: "ord-1", status: "processing" }],
        })
        .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE payment_attempts
        .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE orders
        .mockResolvedValueOnce(undefined); // COMMIT

      const response = await app.inject({
        method: "POST",
        url: "/admin/platform/troubleshoot/payments/pa-1/reconcile",
        payload: {
          source: "commerce_order",
          action: "mark_succeeded",
          providerReference: "QK12345678",
          reason: "Bank statement verified manually",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ success: true, status: "succeeded" });
    });

    it("queries Daraja STK status for a checkout request id", async () => {
      mocks.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: "pa-1", checkout_request_id: "ws_CO_test", status: "succeeded" }] });

      const response = await app.inject({
        method: "POST",
        url: "/admin/platform/troubleshoot/payments/query-stk",
        payload: { checkoutRequestId: "ws_CO_test" },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.result.checkoutRequestId).toBe("ws_CO_test");
    });
  });

  describe("Database Migrations & Schema Inspector", () => {
    it("inspects platform database migration status", async () => {
      mocks.query
        .mockResolvedValueOnce({
          rows: [
            { version: "0001_initial.sql", applied_at: new Date().toISOString() },
            { version: "0002_auth_tenant_registry.sql", applied_at: new Date().toISOString() },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ schema_version: "0015_commerce_inventory_reservation_guard.sql", count: "3" }],
        });

      const response = await app.inject({
        method: "GET",
        url: "/admin/platform/troubleshoot/database/migrations",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.totalRequired).toBeGreaterThanOrEqual(15);
      expect(body.migrations).toBeInstanceOf(Array);
      expect(body.migrations[0].version).toBe("0001_initial.sql");
      expect(body.migrations[0].applied).toBe(true);
    });

    it("syncs tenant database bindings to current platform schema version", async () => {
      mocks.query.mockResolvedValueOnce({
        rowCount: 2,
        rows: [
          { tenant_id: "t1", schema_version: "0015_commerce_inventory_reservation_guard.sql" },
          { tenant_id: "t2", schema_version: "0015_commerce_inventory_reservation_guard.sql" },
        ],
      });

      const response = await app.inject({
        method: "POST",
        url: "/admin/platform/troubleshoot/database/sync-tenant-bindings",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().success).toBe(true);
      expect(response.json().synchronizedCount).toBe(2);
    });
  });

  describe("Storage Usage & Quota Overrides", () => {
    it("inspects tenant media storage usage and quotas", async () => {
      mocks.query
        .mockResolvedValueOnce({
          rows: [
            {
              tenant_id: "tenant-1",
              tenant_name: "Grace Church",
              tenant_slug: "grace",
              product_images_count: "5",
              has_logo: true,
              leaders_with_photo: "4",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ tenant_id: "tenant-1", setting_value: "1000" }],
        });

      const response = await app.inject({
        method: "GET",
        url: "/admin/platform/troubleshoot/storage/usage",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.driver).toBeDefined();
      expect(body.items).toHaveLength(1);
      expect(body.items[0].assetCount).toBe(10); // 5 + 1 + 4
      expect(body.items[0].quotaMb).toBe(1000);
    });

    it("overrides tenant storage quota", async () => {
      mocks.query.mockResolvedValueOnce({ rowCount: 1 });

      const response = await app.inject({
        method: "POST",
        url: "/admin/platform/troubleshoot/storage/tenants/tenant-1/quota-override",
        payload: {
          quotaMb: 2048,
          reason: "Media production upgrade tier",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ success: true, tenantId: "tenant-1", quotaMb: 2048 });
    });
  });

  describe("Rate Limit Status & Unblock", () => {
    it("inspects platform rate limit rules", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/admin/platform/troubleshoot/rate-limits",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.policies).toHaveLength(5);
      expect(body.status).toBe("active");
      expect(body.resetSupported).toBe(false);
    });

    it("does not claim to reset counters when the configured stores lack reset support", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/admin/platform/troubleshoot/rate-limits/reset",
        payload: {
          target: "192.168.1.100",
          scope: "all",
          reason: "Customer IP lockout resolved",
        },
      });

      expect(response.statusCode).toBe(501);
      expect(response.json().message).toBe("The configured rate-limit stores do not support targeted counter resets.");
      expect(mocks.appendAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
        action: "ratelimit.troubleshoot.reset.failed",
        outcome: "failed",
      }));
    });
  });

  describe("Global Platform Audit Logs", () => {
    it("searches and filters global audit logs", async () => {
      mocks.query
        .mockResolvedValueOnce({ rows: [{ total: "1" }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: "audit-1",
              tenant_id: "tenant-1",
              tenant_name: "Grace Church",
              actor_type: "user",
              actor_id: "operator-1",
              actor_role: "platform_owner",
              action: "payment.troubleshoot.reconcile.completed",
              resource_type: "payment_transaction",
              resource_id: "tx-1",
              outcome: "succeeded",
              request_id: "req-1",
              metadata: { actionTaken: "mark_succeeded" },
              occurred_at: new Date().toISOString(),
            },
          ],
        });

      const response = await app.inject({
        method: "GET",
        url: "/admin/platform/audit?outcome=succeeded",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.total).toBe(1);
      expect(body.items[0].action).toBe("payment.troubleshoot.reconcile.completed");
    });
  });
});
