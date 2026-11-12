import { describe, expect, it, vi } from "vitest";
import type { HostingProvisioningRuntime } from "./runtime.js";
import { HostingLifecycleError, HostingLifecycleService, type HostingLifecyclePool } from "./lifecycle.js";

const tenantId = "11111111-1111-4111-8111-111111111111";
const deploymentId = "22222222-2222-4222-8222-222222222222";
const resourceId = "compose-123";
const createdAt = new Date("2026-11-11T08:00:00.000Z");

function deployment(overrides: Record<string, unknown> = {}) {
  return {
    id: deploymentId,
    tenant_id: tenantId,
    provider: "dokploy",
    template: "node-nextjs",
    state: "running",
    provider_resource_id: resourceId,
    created_at: createdAt,
    lease_expires_at: null,
    ...overrides,
  };
}

function makePool(row = deployment(), events: ReadonlySet<string> = new Set(), tenantStatus = "suspended") {
  const statements: Array<{ sql: string; values?: unknown[] }> = [];
  const client = {
    query: vi.fn(async (sql: string, values?: unknown[]) => {
      statements.push(values === undefined ? { sql } : { sql, values });
      if (sql.includes("SELECT status FROM public.tenants")) return { rows: [{ status: tenantStatus }], rowCount: 1 };
      if (sql.includes("SELECT id::text,tenant_id::text,provider,template,state")) return { rows: [row], rowCount: 1 };
      if (sql.includes("SELECT EXISTS")) {
        const eventType = sql.match(/event_type='([^']+)'/)?.[1] ?? String(values?.[2] ?? "");
        return { rows: [{ exists: events.has(eventType) }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    }),
    release: vi.fn(),
  };
  const pool = { connect: vi.fn(async () => client) } as unknown as HostingLifecyclePool;
  return { pool, client, statements };
}

function makeRuntime(): HostingProvisioningRuntime {
  const reference = {
    provider: "dokploy",
    resourceId,
    tenantId: tenantId as never,
    createdAt: createdAt.toISOString(),
  };
  return {
    providerId: "dokploy",
    environmentId: "environment-1",
    loadTemplate: vi.fn(),
    provision: vi.fn(),
    inspect: vi.fn(async () => ({
      reference,
      state: "running" as const,
      lastDeployedAt: null,
      providerResourceName: "alpha-node-nextjs",
      providerEnvironmentId: "environment-1",
    })),
    stop: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
  };
}

function observed(state: "running" | "stopped" = "running") {
  return {
    reference: {
      provider: "dokploy",
      resourceId,
      tenantId: tenantId as never,
      createdAt: createdAt.toISOString(),
    },
    state,
    lastDeployedAt: null,
    providerResourceName: "alpha-node-nextjs",
    providerEnvironmentId: "environment-1",
  };
}

const request = {
  tenantId,
  tenantSlug: "alpha",
  deploymentId,
  actorId: "platform-owner",
  requestId: "request-1",
  reason: "Approved customer hosting pause",
};

describe("platform hosting lifecycle operations", () => {
  it("inspects a provider resource only after verifying its stored tenant and template identity", async () => {
    const { pool } = makePool();
    const runtime = makeRuntime();
    const service = new HostingLifecycleService(pool, runtime);

    await expect(service.inspect({ tenantId, tenantSlug: "alpha", deploymentId })).resolves.toMatchObject({
      deploymentId,
      provider: "dokploy",
      resourceId,
      deploymentState: "running",
      providerState: "running",
      inspectedAt: expect.any(String),
    });
    expect(runtime.inspect).toHaveBeenCalledWith(expect.objectContaining({ resourceId, tenantId }));
  });

  it("does not report provider state when resource identity does not match the Platform tenant", async () => {
    const { pool } = makePool();
    const runtime = makeRuntime();
    vi.mocked(runtime.inspect).mockResolvedValue({
      ...observed(),
      providerResourceName: "another-tenant-node-nextjs",
    });
    const service = new HostingLifecycleService(pool, runtime);

    await expect(service.inspect({ tenantId, tenantSlug: "alpha", deploymentId })).rejects.toMatchObject({
      code: "HOSTING_PROVIDER_IDENTITY_MISMATCH",
      statusCode: 409,
    });
  });

  it("reports a missing provider resource for reconciliation without mutating provider state", async () => {
    const { pool } = makePool();
    const runtime = makeRuntime();
    vi.mocked(runtime.inspect).mockRejectedValue(new Error("HOSTING_RESOURCE_NOT_FOUND"));
    const service = new HostingLifecycleService(pool, runtime);

    await expect(service.inspect({ tenantId, tenantSlug: "alpha", deploymentId })).resolves.toMatchObject({
      deploymentId,
      providerState: "missing",
    });
    expect(runtime.stop).not.toHaveBeenCalled();
    expect(runtime.remove).not.toHaveBeenCalled();
  });

  it("stops only the verified provider resource and records the fenced transition", async () => {
    const { pool, client, statements } = makePool();
    const runtime = makeRuntime();
    vi.mocked(runtime.inspect)
      .mockResolvedValueOnce(observed("running"))
      .mockResolvedValueOnce(observed("stopped"));

    const service = new HostingLifecycleService(pool, runtime);
    const result = await service.stop(request);

    expect(result).toEqual({ deploymentId, state: "stopped", removed: false, alreadyApplied: false });
    expect(runtime.stop).toHaveBeenCalledWith(expect.objectContaining({ resourceId, tenantId }));
    expect(runtime.inspect).toHaveBeenCalledTimes(2);
    expect(statements.some(({ values }) => values?.includes("hosting.deployment.stop_requested"))).toBe(true);
    expect(statements.some(({ values }) => values?.includes("hosting.deployment.stopped"))).toBe(true);
    expect(client.release).toHaveBeenCalledTimes(2);
  });

  it("does not stop a resource whose provider metadata does not match its stored tenant/template", async () => {
    const { pool, statements } = makePool();
    const runtime = makeRuntime();
    vi.mocked(runtime.inspect).mockResolvedValue({
      ...observed(),
      providerResourceName: "another-tenant-node-nextjs",
    });
    const service = new HostingLifecycleService(pool, runtime);

    await expect(service.stop(request)).rejects.toMatchObject({
      code: "HOSTING_PROVIDER_IDENTITY_MISMATCH",
      statusCode: 409,
    } satisfies Partial<HostingLifecycleError>);
    expect(runtime.stop).not.toHaveBeenCalled();
    expect(statements.some(({ values }) => values?.includes("hosting.deployment.stop_failed"))).toBe(true);
  });

  it("allows an unknown stop to reconcile only after an earlier stop request", async () => {
    const { pool } = makePool(
      deployment({ state: "unknown" }),
      new Set(["hosting.deployment.stop_requested"]),
    );
    const runtime = makeRuntime();
    vi.mocked(runtime.inspect).mockResolvedValue(observed("stopped"));
    const service = new HostingLifecycleService(pool, runtime);

    await expect(service.stop(request)).resolves.toEqual({
      deploymentId,
      state: "stopped",
      removed: false,
      alreadyApplied: true,
    });
    expect(runtime.stop).not.toHaveBeenCalled();
  });

  it("does not allow an unrelated unknown deployment to be stopped", async () => {
    const { pool } = makePool(deployment({ state: "unknown" }));
    const runtime = makeRuntime();
    const service = new HostingLifecycleService(pool, runtime);

    await expect(service.stop(request)).rejects.toMatchObject({
      code: "HOSTING_DEPLOYMENT_NOT_STOPPABLE",
      statusCode: 409,
    });
    expect(runtime.inspect).not.toHaveBeenCalled();
  });

  it("removes only a stopped resource, verifies absence, and retains persistent volumes", async () => {
    const { pool, statements } = makePool(deployment({ state: "stopped" }));
    const runtime = makeRuntime();
    vi.mocked(runtime.inspect)
      .mockResolvedValueOnce(observed("stopped"))
      .mockRejectedValueOnce(new Error("HOSTING_RESOURCE_NOT_FOUND"));
    const service = new HostingLifecycleService(pool, runtime);

    const result = await service.remove(request);

    expect(result).toEqual({ deploymentId, state: "stopped", removed: true, alreadyApplied: false });
    expect(runtime.remove).toHaveBeenCalledWith(expect.objectContaining({ resourceId, tenantId }));
    expect(statements.some(({ sql, values }) => sql.includes("provider_resource_id=CASE WHEN $5") && values?.[4] === true)).toBe(true);
    expect(statements.some(({ values }) => values?.includes("hosting.deployment.removed"))).toBe(true);
  });

  it("refuses to remove a running deployment before contacting its provider", async () => {
    const { pool } = makePool(deployment({ state: "running" }));
    const runtime = makeRuntime();
    const service = new HostingLifecycleService(pool, runtime);

    await expect(service.remove(request)).rejects.toMatchObject({
      code: "HOSTING_REMOVE_REQUIRES_STOPPED_RESOURCE",
      statusCode: 409,
    });
    expect(runtime.inspect).not.toHaveBeenCalled();
    expect(runtime.remove).not.toHaveBeenCalled();
  });

  it("rechecks suspension under a tenant row lock before destructive removal", async () => {
    const { pool, statements } = makePool(deployment({ state: "stopped" }), new Set(), "active");
    const runtime = makeRuntime();
    const service = new HostingLifecycleService(pool, runtime);

    await expect(service.remove(request)).rejects.toMatchObject({
      code: "HOSTING_TENANT_MUST_BE_SUSPENDED",
      statusCode: 409,
    });
    expect(statements.some(({ sql }) => sql.includes("FROM public.tenants WHERE id=$1 FOR UPDATE"))).toBe(true);
    expect(runtime.inspect).not.toHaveBeenCalled();
    expect(runtime.remove).not.toHaveBeenCalled();
  });

  it("treats a repeated removal as idempotent after the live provider reference is cleared", async () => {
    const { pool } = makePool(
      deployment({ state: "stopped", provider_resource_id: null }),
      new Set(["hosting.deployment.removed"]),
    );
    const runtime = makeRuntime();
    const service = new HostingLifecycleService(pool, runtime);

    await expect(service.remove(request)).resolves.toEqual({
      deploymentId,
      state: "stopped",
      removed: true,
      alreadyApplied: true,
    });
    expect(runtime.inspect).not.toHaveBeenCalled();
    expect(runtime.remove).not.toHaveBeenCalled();
  });
});
