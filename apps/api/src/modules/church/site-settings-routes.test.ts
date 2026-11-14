import { describe, expect, it, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerChurchSiteSettingsVersionsRoutes } from "./site-settings-routes.js";

const mocks = vi.hoisted(() => ({
  isTenantModuleEnabled: vi.fn(),
  requireActiveTenantPermission: vi.fn(),
  withTenantTransaction: vi.fn(),
}));

vi.mock("../../lib/tenant-modules.js", () => ({
  isTenantModuleEnabled: mocks.isTenantModuleEnabled,
}));

vi.mock("@bazion/auth", () => ({
  requireActiveTenantPermission: mocks.requireActiveTenantPermission,
}));

vi.mock("../../lib/database.js", () => ({
  withTenantTransaction: mocks.withTenantTransaction,
}));

describe("Church Site Settings Versions & Rollback Routes", () => {
  const tenantId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isTenantModuleEnabled.mockResolvedValue(true);
    mocks.requireActiveTenantPermission.mockResolvedValue({
      tenantId,
      userId: "user-admin",
      email: "admin@church.org",
      roles: ["admin"],
    });
  });

  async function buildApp() {
    const app = Fastify();
    await registerChurchSiteSettingsVersionsRoutes(app);
    return app;
  }

  it("lists version history", async () => {
    mocks.withTenantTransaction.mockImplementation(async (_id: string, cb: any) => {
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => Promise.resolve([
                { id: "v2", versionNumber: 2, status: "published", publishedAt: "2026-11-14T00:00:00Z" },
                { id: "v1", versionNumber: 1, status: "superseded", publishedAt: "2026-11-01T00:00:00Z" },
              ])),
            })),
          })),
        })),
      };
      return cb(tx);
    });

    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/admin/church/site-settings/versions",
      headers: { host: "gmfc.test", authorization: "Bearer mock" },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.versions).toHaveLength(2);
    expect(json.versions[0].versionNumber).toBe(2);
  });

  it("discards draft when active draft exists", async () => {
    mocks.withTenantTransaction.mockImplementation(async (_id: string, cb: any) => {
      const tx = {
        delete: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([{ id: "draft-1" }])),
          })),
        })),
      };
      return cb(tx);
    });

    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/admin/church/site-settings/draft",
      headers: { host: "gmfc.test", authorization: "Bearer mock" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });
});

