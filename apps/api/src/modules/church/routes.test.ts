import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { churchRoutes } from "./routes.js";

const mocks = vi.hoisted(() => ({
  resolveTenantId: vi.fn(),
  isTenantModuleEnabled: vi.fn(),
  requireActiveTenantPermission: vi.fn(),
  withTenantTransaction: vi.fn(),
}));

vi.mock("../../lib/tenant-resolution.js", () => ({
  resolveTenantId: mocks.resolveTenantId,
}));

vi.mock("../../lib/tenant-modules.js", () => ({
  isTenantModuleEnabled: mocks.isTenantModuleEnabled,
}));

vi.mock("@bazion/auth", () => ({
  requireActiveTenantPermission: mocks.requireActiveTenantPermission,
}));

vi.mock("../../lib/database.js", () => ({
  pool: { query: vi.fn() },
  withTenantTransaction: mocks.withTenantTransaction,
}));

describe("Church & Ministry Module Routes", () => {
  const tenantId = "11111111-1111-1111-1111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveTenantId.mockResolvedValue(tenantId);
    mocks.isTenantModuleEnabled.mockResolvedValue(true);
  });

  async function buildTestApp() {
    const app = Fastify();
    await app.register(churchRoutes, {
      prefix: "/v1",
      config: {
        NODE_ENV: "test",
        TENANT_RESOLUTION_MODE: "dynamic",
      } as any,
    });
    return app;
  }

  describe("Public Routes", () => {
    it("returns public site profile and active leaders", async () => {
      const mockProfile = {
        ministryName: "Global Mission for Christ International",
        description: "Propagating revival across Kenya and the nations.",
      };
      const mockLeaders = [
        { name: "Rev. Anthony Githui", position: "General Director & Founder" },
      ];

      mocks.withTenantTransaction.mockImplementation(async (_id: string, cb: any) => {
        const tx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockProfile]),
                orderBy: vi.fn().mockResolvedValue(mockLeaders),
              }),
            }),
          }),
        };
        return cb(tx);
      });

      const app = await buildTestApp();
      const res = await app.inject({
        method: "GET",
        url: "/v1/public/church/site",
        headers: { host: "gmfc.test" },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.profile.ministryName).toBe("Global Mission for Christ International");
      expect(json.leaders).toHaveLength(1);
    });

    it("registers for an event and returns a confirmation ref code", async () => {
      mocks.withTenantTransaction.mockImplementation(async (_id: string, cb: any) => {
        const tx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  {
                    id: "evt-123",
                    title: "Annual Revival Conference 2026",
                    registrationEnabled: true,
                  },
                ]),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                {
                  id: "reg-1",
                  registrationReference: "GMFC-REG-TEST12",
                },
              ]),
            }),
          }),
        };
        return cb(tx);
      });

      const app = await buildTestApp();
      const res = await app.inject({
        method: "POST",
        url: "/v1/public/church/events/evt-123/register",
        headers: { host: "gmfc.test" },
        payload: {
          fullName: "James Mwangi",
          email: "james@example.com",
          telephone: "+254712345678",
        },
      });

      expect(res.statusCode).toBe(201);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.registrationReference).toBe("GMFC-REG-TEST12");
      expect(json.eventTitle).toBe("Annual Revival Conference 2026");
    });

    it("initiates M-Pesa STK push for donations", async () => {
      mocks.withTenantTransaction.mockImplementation(async (_id: string, cb: any) => {
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: "don-999" }]),
            }),
          }),
        };
        return cb(tx);
      });

      const app = await buildTestApp();
      const res = await app.inject({
        method: "POST",
        url: "/v1/public/church/donations/mpesa-stk",
        headers: { host: "gmfc.test" },
        payload: {
          amount: 2500,
          phoneNumber: "+254712345678",
          givingCategory: "Missions & Evangelism Crusades",
          donorName: "Hannah Wanjiku",
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.status).toBe("pending");
      expect(json.checkoutRequestId).toMatch(/^ws_CO_/);
    });

    it("submits contact enquiries and prayer requests", async () => {
      mocks.withTenantTransaction.mockImplementation(async (_id: string, cb: any) => {
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue([]),
          }),
        };
        return cb(tx);
      });

      const app = await buildTestApp();

      // Contact
      const contactRes = await app.inject({
        method: "POST",
        url: "/v1/public/church/contact",
        headers: { host: "gmfc.test" },
        payload: {
          fullName: "Faith Njeri",
          email: "faith@example.com",
          subject: "Medical camp enquiry",
          message: "Inquiry about upcoming medical camp venues.",
        },
      });
      expect(contactRes.statusCode).toBe(201);

      // Prayer request
      const prayerRes = await app.inject({
        method: "POST",
        url: "/v1/public/church/prayer-requests",
        headers: { host: "gmfc.test" },
        payload: {
          fullName: "Peter Kimani",
          requestText: "Praying for full recovery and family restoration.",
          privacyPreference: "confidential",
        },
      });
      expect(prayerRes.statusCode).toBe(201);
    });
  });

  describe("Admin Church Routes", () => {
    it("returns church overview metrics for authorized users", async () => {
      mocks.requireActiveTenantPermission.mockResolvedValue({
        tenantId,
        userId: "user-admin",
        roles: ["admin"],
      });

      mocks.withTenantTransaction.mockImplementation(async (_id: string, cb: any) => {
        const tx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                {
                  sermonCount: 24,
                  eventCount: 8,
                  registrationCount: 156,
                  donationCount: 89,
                  totalRaisedMinor: 45000000,
                  pendingPrayers: 12,
                  newMessages: 5,
                },
              ]),
            }),
          }),
        };
        return cb(tx);
      });

      const app = await buildTestApp();
      const res = await app.inject({
        method: "GET",
        url: "/v1/admin/church/overview",
        headers: {
          host: "gmfc.test",
          authorization: "Bearer mock-token",
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.sermonCount).toBe(24);
      expect(json.donationCount).toBe(89);
    });
  });
});
