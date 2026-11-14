import { describe, expect, it, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerChurchOperationsRoutes } from "./operations-routes.js";
import type { AppConfig } from "../../config.js";

const mocks = vi.hoisted(() => ({
  resolveTenantId: vi.fn(),
  isTenantModuleEnabled: vi.fn(),
  assertTenantNotInMaintenance: vi.fn(),
  requireActiveTenantPermission: vi.fn(),
  withTenantTransaction: vi.fn(),
}));

vi.mock("../../lib/tenant-resolution.js", () => ({
  resolveTenantId: mocks.resolveTenantId,
}));

vi.mock("../../lib/tenant-modules.js", () => ({
  isTenantModuleEnabled: mocks.isTenantModuleEnabled,
}));

vi.mock("../../lib/tenant-maintenance.js", () => ({
  assertTenantNotInMaintenance: mocks.assertTenantNotInMaintenance,
}));

vi.mock("@bazion/auth", () => ({
  requireActiveTenantPermission: mocks.requireActiveTenantPermission,
}));

vi.mock("../../lib/database.js", () => ({
  withTenantTransaction: mocks.withTenantTransaction,
}));

describe("Church Operations Routes", () => {
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const testConfig = {
    PORT: 4000,
    mediaStorage: { driver: "local", localDirectory: "./test-uploads" },
  } as unknown as AppConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveTenantId.mockResolvedValue(tenantId);
    mocks.isTenantModuleEnabled.mockResolvedValue(true);
    mocks.assertTenantNotInMaintenance.mockResolvedValue(undefined);
  });

  async function buildApp() {
    const app = Fastify();
    await registerChurchOperationsRoutes(app, { config: testConfig });
    return app;
  }

  describe("Public Directory & Join Requests", () => {
    it("returns public directory with safe fields only (no inventory or private addresses)", async () => {
      mocks.withTenantTransaction.mockImplementation(async (_id: string, cb: any) => {
        let callCount = 0;
        const tx = {
          select: vi.fn((fields: any) => {
            callCount++;
            const data = callCount === 1
              ? [{ id: "d1", name: "Music", slug: "music", description: "Choir", icon: "🎵" }]
              : callCount === 2
                ? [{ id: "g1", name: "Central", slug: "central", category: "Cell", leaderName: "Mwangi", meetingSchedule: "Wed 6pm", publicLocationLabel: "Kiamariga Town", acceptingMembers: true }]
                : [{ id: "v1", name: "Media Crew", slug: "media", description: "Camera team", acceptingApplications: true }];
            const builder: any = {
              from: vi.fn(() => builder),
              where: vi.fn(() => builder),
              orderBy: vi.fn(() => Promise.resolve(data)),
              then: (resolve: any) => resolve(data),
            };
            return builder;
          }),
        };
        return cb(tx);
      });

      const app = await buildApp();
      const res = await app.inject({
        method: "GET",
        url: "/public/church/directory",
        headers: { host: "gmfc.test" },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.departments).toHaveLength(1);
      expect(json.smallGroups).toHaveLength(1);
      expect(json.volunteerTeams).toHaveLength(1);
      // Ensures private addresses or inventory are not leaked in directory
      expect(json.inventoryAssets).toBeUndefined();
      expect(json.smallGroups[0].privateAddress).toBeUndefined();
      expect(json.smallGroups[0].publicLocationLabel).toBe("Kiamariga Town");
    });

    it("rejects public group join request when privacy consent is false", async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/public/church/groups/g1/join-requests",
        headers: { host: "gmfc.test" },
        payload: {
          fullName: "Jane Doe",
          email: "jane@test.org",
          telephone: "+254712345678",
          privacyConsent: false,
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("VALIDATION_ERROR");
    });

    it("accepts public volunteer application with privacy consent", async () => {
      mocks.withTenantTransaction.mockImplementation(async (_id: string, cb: any) => {
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve([{ id: "t1", acceptingApplications: true, isPublic: true, status: "active" }])),
              })),
            })),
          })),
          insert: vi.fn(() => ({
            values: vi.fn(() => ({
              returning: vi.fn(() => Promise.resolve([{ id: "app-123" }])),
            })),
          })),
        };
        return cb(tx);
      });

      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/public/church/volunteer-teams/t1/applications",
        headers: { host: "gmfc.test" },
        payload: {
          fullName: "Kamau John",
          email: "kamau@test.org",
          telephone: "+254722123456",
          availability: "Sunday morning",
          privacyConsent: true,
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().success).toBe(true);
      expect(res.json().applicationId).toBe("app-123");
    });
  });

  describe("Admin Physical Inventory Operations", () => {
    it("creates inventory equipment and logs asset event", async () => {
      mocks.requireActiveTenantPermission.mockResolvedValue({
        tenantId,
        userId: "user-1",
        email: "staff@gmfc.org",
        roles: ["admin"],
      });

      const writes: any[] = [];
      mocks.withTenantTransaction.mockImplementation(async (_id: string, cb: any) => {
        const tx = {
          insert: vi.fn(() => ({
            values: vi.fn((vals: any) => {
              writes.push(vals);
              return {
                returning: vi.fn(() => Promise.resolve([{ id: "asset-1", ...vals }])),
              };
            }),
          })),
        };
        return cb(tx);
      });

      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/admin/church/inventory-assets",
        headers: { host: "gmfc.test", authorization: "Bearer mock" },
        payload: {
          name: "Mobile PA System",
          assetTag: "SOUND-01",
          category: "Audio",
          location: "Kiamariga Grounds",
          condition: "good",
          status: "available",
        },
      });

      expect(res.statusCode).toBe(201);
      expect(writes).toHaveLength(2); // 1 for asset insert, 1 for asset creation event log
      expect(writes[0].assetTag).toBe("SOUND-01");
      expect(writes[1].eventType).toBe("assignment");
      expect(writes[1].recordedBy).toBe("staff@gmfc.org");
    });
  });
});
