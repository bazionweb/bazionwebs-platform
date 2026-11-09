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

    it("returns validated tenant-editable website settings", async () => {
      const results = [
        [{ slug: "harbour-church", name: "Harbour Church" }],
        [{ ministryName: "Harbour Church", description: "A local community of faith." }],
        [{ id: "leader-1", name: "Grace Njeri", position: "Pastor", status: "active" }],
        [{ settingValue: JSON.stringify({ hero: { title: "Come as you are" } }) }],
      ];
      let selectIndex = 0;
      mocks.withTenantTransaction.mockImplementation(async (_id: string, cb: any) => {
        const tx = {
          select: vi.fn(() => {
            const rows = results[selectIndex++] ?? [];
            const builder: any = {};
            builder.from = vi.fn(() => builder);
            builder.where = vi.fn(() => builder);
            builder.limit = vi.fn(async () => rows);
            builder.orderBy = vi.fn(async () => rows);
            return builder;
          }),
        };
        return cb(tx);
      });

      const app = await buildTestApp();
      const res = await app.inject({ method: "GET", url: "/v1/public/church/site", headers: { host: "harbour.test" } });

      expect(res.statusCode).toBe(200);
      expect(res.json().siteSettings.hero.title).toBe("Come as you are");
      expect(res.json().siteSettings.serviceTimes).toEqual([]);
    });

    it("registers for an event and returns a confirmation ref code", async () => {
      let registrationValues: Record<string, unknown> | undefined;
      mocks.withTenantTransaction.mockImplementation(async (_id: string, cb: any) => {
        const tx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                  for: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                      {
                        id: "evt-123",
                        title: "Annual Revival Conference 2026",
                        registrationEnabled: true,
                        registrationCapacity: null,
                        status: "upcoming",
                        startsAt: new Date(Date.now() + 60_000),
                      },
                    ]),
                  }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn((values: Record<string, unknown>) => {
              registrationValues = values;
              return { returning: vi.fn().mockResolvedValue([{ id: "reg-1", registrationReference: "REG-TEST12" }]) };
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
          privacyConsent: true,
        },
      });

      expect(res.statusCode).toBe(201);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.registrationReference).toBe("REG-TEST12");
      expect(json.eventTitle).toBe("Annual Revival Conference 2026");
      expect(registrationValues?.consentAt).toBeInstanceOf(Date);
    });

    it("reports unavailable when M-Pesa is not configured", async () => {
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
          privacyConsent: true,
        },
      });

      expect(res.statusCode).toBe(503);
      const json = res.json();
      expect(json.error).toBe("PAYMENT_PROVIDER_UNAVAILABLE");
      expect(mocks.withTenantTransaction).not.toHaveBeenCalled();
    });

    it("submits contact enquiries and prayer requests", async () => {
      const insertedValues: Array<Record<string, unknown>> = [];
      mocks.withTenantTransaction.mockImplementation(async (_id: string, cb: any) => {
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn((values: Record<string, unknown>) => { insertedValues.push(values); return Promise.resolve([]); }),
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
          privacyConsent: true,
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
          privacyConsent: true,
        },
      });
      expect(prayerRes.statusCode).toBe(201);
      expect(insertedValues).toHaveLength(2);
      expect(insertedValues.every((values) => values.consentAt instanceof Date)).toBe(true);
    });

    it.each([
      ["contact enquiry", "/v1/public/church/contact", { fullName: "Faith Njeri", email: "faith@example.com", subject: "A question", message: "I would like to learn more." }],
      ["prayer request", "/v1/public/church/prayer-requests", { fullName: "Peter Kimani", requestText: "Please pray for my family this week." }],
      ["event registration", "/v1/public/church/events/event-id/register", { fullName: "Miriam Wanjiku", email: "miriam@example.org", telephone: "+254712345678" }],
      ["newsletter opt-in", "/v1/public/church/newsletter", { email: "miriam@example.org" }],
    ])("requires consent for a %s", async (_name, url, payload) => {
      const app = await buildTestApp();
      const response = await app.inject({ method: "POST", url, headers: { host: "gmfc.test" }, payload });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe("VALIDATION_ERROR");
      expect(mocks.withTenantTransaction).not.toHaveBeenCalled();
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

    it("saves profile and site settings in the tenant transaction", async () => {
      mocks.requireActiveTenantPermission.mockResolvedValue({ tenantId, userId: "user-admin", roles: ["admin"] });
      const writes: Array<Record<string, unknown>> = [];
      mocks.withTenantTransaction.mockImplementation(async (_id: string, cb: any) => {
        const tx = {
          insert: vi.fn(() => {
            const builder: any = {};
            builder.values = vi.fn((values: Record<string, unknown>) => { writes.push(values); return builder; });
            builder.onConflictDoUpdate = vi.fn(async () => []);
            return builder;
          }),
        };
        return cb(tx);
      });

      const app = await buildTestApp();
      const response = await app.inject({
        method: "PUT",
        url: "/v1/admin/church/site-settings",
        headers: { host: "gmfc.test", authorization: "Bearer mock-token" },
        payload: {
          profile: { ministryName: "Harbour Church", logoUrl: "/images/logo.svg" },
          settings: { hero: { title: "Come as you are" } },
        },
      });

      expect(response.statusCode).toBe(200);
      expect(writes).toHaveLength(2);
      expect(writes[0]?.logoAssetUrl).toBe("/images/logo.svg");
      expect(JSON.parse(String(writes[1]?.settingValue)).hero.title).toBe("Come as you are");
      expect(mocks.withTenantTransaction).toHaveBeenCalledTimes(1);
    });

    it("rejects an inaccessible theme color without writing settings", async () => {
      mocks.requireActiveTenantPermission.mockResolvedValue({ tenantId, userId: "user-admin", roles: ["admin"] });
      const app = await buildTestApp();
      const response = await app.inject({
        method: "PUT",
        url: "/v1/admin/church/site-settings",
        headers: { host: "gmfc.test", authorization: "Bearer mock-token" },
        payload: { profile: { ministryName: "Harbour Church" }, settings: { branding: { primaryColor: "#ffffff" } } },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe("VALIDATION_ERROR");
      expect(mocks.withTenantTransaction).not.toHaveBeenCalled();
    });

    it.each([
      ["sermon", "/v1/admin/church/sermons", { title: "Sunday message", slug: "sunday-message", speaker: "Pastor Grace" }, "SERMON_SLUG_EXISTS"],
      ["event", "/v1/admin/church/events", { title: "Community gathering", slug: "community-gathering", startsAt: "2026-12-10T12:00:00.000Z" }, "EVENT_SLUG_EXISTS"],
      ["campaign", "/v1/admin/church/campaigns", { title: "Community hall", slug: "community-hall", targetAmountKsh: 100_000 }, "CAMPAIGN_SLUG_EXISTS"],
    ])("returns a clear conflict for duplicate %s slugs", async (_name, url, payload, expectedError) => {
      mocks.requireActiveTenantPermission.mockResolvedValue({ tenantId, userId: "user-admin", roles: ["admin"] });
      const postgresError = Object.assign(new Error("duplicate slug"), { code: "23505" });
      mocks.withTenantTransaction.mockRejectedValue(Object.assign(new Error("query failed"), { cause: postgresError }));

      const app = await buildTestApp();
      const response = await app.inject({ method: "POST", url, headers: { host: "gmfc.test" }, payload });

      expect(response.statusCode).toBe(409);
      expect(response.json().error).toBe(expectedError);
    });
  });
});
