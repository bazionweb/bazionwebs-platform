import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ObjectStorage } from "@bazion/storage";
import { mediaRoutes } from "./routes.js";

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

describe("media-storage module routes", () => {
  const tenantId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestTenantId.mockResolvedValue(tenantId);
    mocks.isTenantModuleEnabled.mockResolvedValue(true);
    mocks.requireActiveTenantPermission.mockResolvedValue({
      userId: "user-1",
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

  function createMockStorage(): ObjectStorage {
    return {
      putObject: vi.fn(async () => undefined),
      listObjects: vi.fn(async () => []),
      listObjectsPage: vi.fn(async () => ({ objects: [], nextCursor: null })),
      getObject: vi.fn(async () => null),
      deleteObject: vi.fn(async () => undefined),
      publicUrl: vi.fn((key) => `/v1/public/media/${key}`),
    };
  }

  async function createApp(storage = createMockStorage()) {
    const app = Fastify();
    await app.register(mediaRoutes, {
      prefix: "/v1",
      storage,
      config: {
        NODE_ENV: "test",
        storage: { driver: "local", localDir: "/tmp/bazion-test-media" },
      } as never,
    });
    return app;
  }

  it("enforces media-storage module entitlement gate", async () => {
    mocks.isTenantModuleEnabled.mockResolvedValue(false);
    const app = await createApp();
    try {
      const response = await app.inject({ method: "GET", url: "/v1/admin/media" });
      expect(response.statusCode).toBe(404);
      expect(response.json().error).toBe("MEDIA_MODULE_DISABLED");
    } finally {
      await app.close();
    }
  });

  it("returns persisted media assets and storage usage metrics", async () => {
    mocks.withTenantTransaction.mockResolvedValueOnce({
      rows: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          objectKey: `${tenantId}/abc/hero.webp`,
          publicUrl: `/v1/public/media/${tenantId}/abc/hero.webp`,
          filename: "hero.webp",
          contentType: "image/webp",
          sizeBytes: 4096,
          originalSizeBytes: 8192,
          width: 1200,
          height: 800,
          optimized: true,
          createdAt: new Date("2026-11-18T10:00:00.000Z"),
        },
      ],
      totalBytes: 4096,
      assetCount: 1,
    });

    const app = await createApp();
    try {
      const response = await app.inject({ method: "GET", url: "/v1/admin/media" });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        items: [{ filename: "hero.webp", sizeBytes: 4096 }],
        usage: { assetCount: 1, totalBytes: 4096 },
      });
    } finally {
      await app.close();
    }
  });

  it("blocks deletion with 409 MEDIA_ASSET_IN_USE when asset is referenced", async () => {
    mocks.withTenantTransaction.mockResolvedValueOnce({
      kind: "in_use",
      references: ["products"],
    });
    const storage = createMockStorage();
    const app = await createApp(storage);
    try {
      const response = await app.inject({
        method: "DELETE",
        url: "/v1/admin/media/22222222-2222-4222-8222-222222222222",
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        error: "MEDIA_ASSET_IN_USE",
        references: ["products"],
      });
      expect(storage.deleteObject).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("deletes unreferenced assets from database and object storage", async () => {
    mocks.withTenantTransaction.mockResolvedValueOnce({
      kind: "deleted",
      asset: {
        id: "22222222-2222-4222-8222-222222222222",
        objectKey: `${tenantId}/abc/hero.webp`,
        sizeBytes: 4096,
      },
    });
    const storage = createMockStorage();
    const app = await createApp(storage);
    try {
      const response = await app.inject({
        method: "DELETE",
        url: "/v1/admin/media/22222222-2222-4222-8222-222222222222",
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ deleted: true, id: "22222222-2222-4222-8222-222222222222" });
      expect(storage.deleteObject).toHaveBeenCalledWith({ tenantId, key: `${tenantId}/abc/hero.webp` });
      expect(mocks.appendAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "media.asset.deleted" }));
    } finally {
      await app.close();
    }
  });
});
