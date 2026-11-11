import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hostingRoutes } from "./routes.js";
import type { TenantHostingTemplate } from "@bazion/platform-contracts";
import type { HostingProvisioningRuntime } from "./runtime.js";
import type { LoadedTenantHostingTemplate } from "./templates.js";

const mocks = vi.hoisted(() => ({
  requirePlatformRole: vi.fn(),
  getPlatformTenant: vi.fn(),
  appendAuditEvent: vi.fn(),
}));

vi.mock("@bazion/audit", () => ({
  PostgresAuditEventWriter: class {
    append(event: unknown) { return mocks.appendAuditEvent(event); }
  },
}));
vi.mock("@bazion/auth", () => ({ requirePlatformRole: mocks.requirePlatformRole }));
vi.mock("@bazion/auth/server", () => ({ getPlatformTenant: mocks.getPlatformTenant }));
vi.mock("../../lib/database.js", () => ({ pool: { query: vi.fn() } }));

const tenantId = "11111111-1111-4111-8111-111111111111";
const reference = {
  provider: "dokploy",
  resourceId: "compose-123",
  tenantId: tenantId as never,
  createdAt: "2026-11-11T00:00:00.000Z",
};

function makeRuntime(): HostingProvisioningRuntime {
  return {
    providerId: "dokploy",
    loadTemplate: vi.fn(async (_template: TenantHostingTemplate): Promise<LoadedTenantHostingTemplate> => ({
      template: "node-nextjs",
      composeFile: "services:\n  app:\n    image: ${APP_IMAGE:?required}\n",
      templateVersion: "sha256:" + "a".repeat(64),
    })),
    provision: vi.fn(async () => ({
      reference,
      state: "deploying" as const,
      attemptCount: 1,
      reused: false,
    })),
  };
}

async function makeApp(runtime: HostingProvisioningRuntime | null = makeRuntime()) {
  const app = Fastify();
  await app.register(hostingRoutes, { prefix: "/v1", runtime });
  await app.ready();
  return app;
}

beforeEach(() => {
  mocks.requirePlatformRole.mockReset();
  mocks.getPlatformTenant.mockReset();
  mocks.appendAuditEvent.mockReset();
  mocks.requirePlatformRole.mockResolvedValue({
    userId: "platform-owner",
    email: "owner@bazion.test",
    role: "platform_owner",
  });
  mocks.getPlatformTenant.mockResolvedValue({ id: tenantId, slug: "alpha", name: "Alpha", status: "active" });
  mocks.appendAuditEvent.mockResolvedValue(undefined);
});

describe("platform tenant hosting route", () => {
  it("requires the platform-owner role, records audit intent, and provisions from a versioned template", async () => {
    const runtime = makeRuntime();
    const app = await makeApp(runtime);
    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/admin/platform/tenants/" + tenantId + "/hosting/provision",
        headers: { "idempotency-key": "host-alpha-node-0001" },
        payload: { template: "node-nextjs" },
      });

      expect(response.statusCode).toBe(202);
      expect(mocks.requirePlatformRole).toHaveBeenCalledWith(expect.any(Object), ["platform_owner"]);
      expect(runtime.loadTemplate).toHaveBeenCalledWith("node-nextjs");
      expect(runtime.provision).toHaveBeenCalledWith(expect.objectContaining({
        tenantId,
        template: "node-nextjs",
        templateVersion: "sha256:" + "a".repeat(64),
        idempotencyKey: "host-alpha-node-0001",
        environmentSecretRef: "docker-secret://bazion-hosting-" + tenantId + "-node-nextjs",
        actorType: "user",
        actorId: "platform-owner",
      }));
      expect(mocks.appendAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
        action: "tenant.hosting.provision.requested",
        tenantId,
        outcome: "succeeded",
      }));
      expect(mocks.appendAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
        action: "tenant.hosting.provision.completed",
        resourceId: "compose-123",
        outcome: "succeeded",
      }));
      expect(response.json().deployment.state).toBe("deploying");
      expect(JSON.stringify(response.json())).not.toContain("environmentSecretRef");
    } finally {
      await app.close();
    }
  });

  it("rejects non-owner platform identities before loading tenant or provider data", async () => {
    const runtime = makeRuntime();
    const app = await makeApp(runtime);
    try {
      mocks.requirePlatformRole.mockRejectedValue(Object.assign(new Error("Forbidden"), {
        statusCode: 403, code: "PLATFORM_PERMISSION_DENIED",
      }));
      const response = await app.inject({
        method: "POST",
        url: "/v1/admin/platform/tenants/" + tenantId + "/hosting/provision",
        headers: { "idempotency-key": "host-alpha-node-0001" },
        payload: { template: "node-nextjs" },
      });
      expect(response.statusCode).toBe(403);
      expect(mocks.getPlatformTenant).not.toHaveBeenCalled();
      expect(runtime.provision).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("rejects missing idempotency keys and malformed request fields", async () => {
    const runtime = makeRuntime();
    const app = await makeApp(runtime);
    try {
      const missingKey = await app.inject({
        method: "POST",
        url: "/v1/admin/platform/tenants/" + tenantId + "/hosting/provision",
        payload: { template: "node-nextjs" },
      });
      const extraField = await app.inject({
        method: "POST",
        url: "/v1/admin/platform/tenants/" + tenantId + "/hosting/provision",
        headers: { "idempotency-key": "host-alpha-node-0001" },
        payload: { template: "node-nextjs", composeFile: "untrusted" },
      });
      expect(missingKey.statusCode).toBe(400);
      expect(extraField.statusCode).toBe(400);
      expect(runtime.provision).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("does not attempt provisioning when the tenant is inactive or the provider is disabled", async () => {
    const runtime = makeRuntime();
    const app = await makeApp(runtime);
    try {
      mocks.getPlatformTenant.mockResolvedValueOnce({ id: tenantId, slug: "alpha", status: "suspended" });
      const response = await app.inject({
        method: "POST",
        url: "/v1/admin/platform/tenants/" + tenantId + "/hosting/provision",
        headers: { "idempotency-key": "host-alpha-node-0001" },
        payload: { template: "node-nextjs" },
      });
      expect(response.statusCode).toBe(409);
      expect(runtime.provision).not.toHaveBeenCalled();
      expect(mocks.appendAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
        action: "tenant.hosting.provision.denied",
        outcome: "denied",
      }));
    } finally {
      await app.close();
    }

    const disabledApp = await makeApp(null);
    try {
      const response = await disabledApp.inject({
        method: "POST",
        url: "/v1/admin/platform/tenants/" + tenantId + "/hosting/provision",
        headers: { "idempotency-key": "host-alpha-node-0001" },
        payload: { template: "node-nextjs" },
      });
      expect(response.statusCode).toBe(503);
      expect(response.json().error).toBe("HOSTING_NOT_CONFIGURED");
    } finally {
      await disabledApp.close();
    }
  });

  it("maps idempotency conflicts without disclosing provider errors", async () => {
    const runtime = makeRuntime();
    vi.mocked(runtime.provision).mockRejectedValueOnce(new Error("HOSTING_IDEMPOTENCY_CONFLICT"));
    const app = await makeApp(runtime);
    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/admin/platform/tenants/" + tenantId + "/hosting/provision",
        headers: { "idempotency-key": "host-alpha-node-0001" },
        payload: { template: "node-nextjs" },
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({
        error: "HOSTING_IDEMPOTENCY_CONFLICT",
        message: "The hosting provisioning request could not be completed.",
      });
    } finally {
      await app.close();
    }
  });
});
