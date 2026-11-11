import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hostingRecoveryRoutes } from "./recovery-routes.js";
import type { HostingProvisioningRuntime } from "./runtime.js";

const mocks = vi.hoisted(() => ({
  requirePlatformRole: vi.fn(),
  getPlatformTenant: vi.fn(),
  auditAppend: vi.fn(),
  connect: vi.fn(),
  query: vi.fn(),
}));

vi.mock("@bazion/audit", () => ({
  PostgresAuditEventWriter: class {
    append(event: unknown) { return mocks.auditAppend(event); }
  },
}));
vi.mock("@bazion/auth", () => ({ requirePlatformRole: mocks.requirePlatformRole }));
vi.mock("@bazion/auth/server", () => ({ getPlatformTenant: mocks.getPlatformTenant }));
vi.mock("../../lib/database.js", () => ({ pool: { connect: mocks.connect } }));

const tenantId = "11111111-1111-4111-8111-111111111111";
const deploymentId = "22222222-2222-4222-8222-222222222222";
const resourceId = "dokploy-compose-123";
const createdAt = new Date("2026-11-11T08:00:00.000Z");

function makeRuntime(): HostingProvisioningRuntime {
  return {
    providerId: "dokploy",
    loadTemplate: vi.fn(async () => ({
      template: "node-nextjs" as const, composeFile: "services: {}", templateVersion: "sha256:" + "a".repeat(64),
    })),
    provision: vi.fn(async () => ({
      reference: { provider: "dokploy", resourceId, tenantId: tenantId as never, createdAt: createdAt.toISOString() },
      state: "deploying" as const, attemptCount: 1, reused: false,
    })),
    inspect: vi.fn(async (reference) => ({
      reference, state: "running" as const, lastDeployedAt: "2026-11-11T08:05:00.000Z",
      providerResourceName: "alpha-node-nextjs",
    })),
  };
}

function makeClient() {
  return {
    query: mocks.query,
    release: vi.fn(),
  };
}

async function makeApp(runtime: HostingProvisioningRuntime | null = makeRuntime()) {
  const app = Fastify();
  await app.register(hostingRecoveryRoutes, { prefix: "/v1", runtime });
  await app.ready();
  return app;
}

beforeEach(() => {
  mocks.requirePlatformRole.mockReset().mockResolvedValue({
    userId: "platform-owner", email: "owner@bazion.test", role: "platform_owner",
  });
  mocks.getPlatformTenant.mockReset().mockResolvedValue({
    id: tenantId, slug: "alpha", name: "Alpha", status: "active",
  });
  mocks.auditAppend.mockReset().mockResolvedValue(undefined);
  mocks.connect.mockReset();
  mocks.query.mockReset();
});

describe("operator-assisted hosting recovery", () => {
  it("inspects and atomically attaches an operator-verified existing Dokploy resource", async () => {
    const readClient = makeClient();
    const writeClient = makeClient();
    mocks.connect.mockResolvedValueOnce(readClient).mockResolvedValueOnce(writeClient);
    mocks.query
      .mockResolvedValueOnce({ rows: [{
        id: deploymentId, provider: "dokploy", template: "node-nextjs", state: "unknown",
        provider_resource_id: null, created_at: createdAt, lease_expires_at: null,
      }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: null }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: deploymentId }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // append event
      .mockResolvedValueOnce({ rows: [], rowCount: null }); // COMMIT

    const runtime = makeRuntime();
    const app = await makeApp(runtime);
    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/admin/platform/tenants/${tenantId}/hosting/deployments/${deploymentId}/recover`,
        payload: { resourceId, resourceName: "alpha-node-nextjs" },
      });
      expect(response.statusCode).toBe(200);
      expect(runtime.inspect).toHaveBeenCalledWith(expect.objectContaining({
        provider: "dokploy", resourceId, tenantId, createdAt: createdAt.toISOString(),
      }));
      expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("state='unknown'"), [
        deploymentId, tenantId, resourceId, "running",
      ]);
      expect(response.json().deployment).toMatchObject({
        id: deploymentId, resourceId, template: "node-nextjs", state: "running", recovered: true,
      });
      expect(mocks.auditAppend).toHaveBeenCalledWith(expect.objectContaining({
        action: "tenant.hosting.recovery.completed", outcome: "succeeded",
      }));
    } finally {
      await app.close();
    }
  });

  it("rejects a resource name that does not match the tenant/template before provider inspection", async () => {
    const client = makeClient();
    mocks.connect.mockResolvedValueOnce(client);
    mocks.query.mockResolvedValueOnce({ rows: [{
      id: deploymentId, provider: "dokploy", template: "node-nextjs", state: "unknown",
      provider_resource_id: null, created_at: createdAt, lease_expires_at: null,
    }], rowCount: 1 });
    const runtime = makeRuntime();
    const app = await makeApp(runtime);
    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/admin/platform/tenants/${tenantId}/hosting/deployments/${deploymentId}/recover`,
        payload: { resourceId, resourceName: "another-tenant-node-nextjs" },
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({ error: "HOSTING_RECOVERY_NAME_MISMATCH" });
      expect(runtime.inspect).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("does not expose recovery to non-owner platform roles", async () => {
    mocks.requirePlatformRole.mockRejectedValue(Object.assign(new Error("Forbidden"), {
      statusCode: 403, code: "PLATFORM_PERMISSION_DENIED",
    }));
    const app = await makeApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/admin/platform/tenants/${tenantId}/hosting/deployments/${deploymentId}/recover`,
        payload: { resourceId, resourceName: "alpha-node-nextjs" },
      });
      expect(response.statusCode).toBe(403);
      expect(mocks.connect).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
