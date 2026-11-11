import { describe, expect, it, vi } from "vitest";
import type { TenantHostingDeploymentReference, TenantHostingProvider } from "@bazion/platform-contracts";
import {
  PostgresHostingLifecycleStore,
  TenantHostingLifecycleService,
  type HostingLifecyclePool,
  type HostingLifecycleClaim,
  type HostingLifecycleClaimResult,
  type HostingLifecycleStore,
} from "./lifecycle.js";

const reference: TenantHostingDeploymentReference = {
  provider: "dokploy",
  resourceId: "compose-123",
  tenantId: "11111111-1111-4111-8111-111111111111" as never,
  createdAt: "2026-11-11T00:00:00.000Z",
};
const claim: HostingLifecycleClaim = {
  deploymentId: "22222222-2222-4222-8222-222222222222",
  leaseToken: "lease-1",
  reference,
  previousState: "stopped",
};

function setup(result: HostingLifecycleClaimResult = { kind: "claimed", claim }) {
  const store: HostingLifecycleStore = {
    claim: vi.fn(async () => result),
    complete: vi.fn(async () => true),
    fail: vi.fn(async () => undefined),
  };
  const provider: TenantHostingProvider = {
    provision: vi.fn(async () => reference),
    deploy: vi.fn(async () => undefined),
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    redeploy: vi.fn(async () => undefined),
    inspect: vi.fn(async () => ({ reference, state: "running" as const, lastDeployedAt: null })),
    remove: vi.fn(async () => undefined),
  };
  return { service: new TenantHostingLifecycleService(store, provider, "dokploy"), store, provider };
}
const input = {
  tenantId: reference.tenantId as string,
  deploymentId: claim.deploymentId,
  action: "start" as const,
  actorId: "platform-owner",
  requestId: "req-1",
};

describe("PostgresHostingLifecycleStore", () => {
  it("claims only matching provider resources and records events against the deployment UUID", async () => {
    const statements: string[] = [];
    const parameters: unknown[][] = [];
    const pool = {
      async connect() {
        return {
          async query(statement: string, values: unknown[] = []) {
            statements.push(statement);
            parameters.push(values);
            if (statement.startsWith("SELECT d.id::text")) return {
              rows: [{
                id: claim.deploymentId, tenant_id: reference.tenantId, provider: "dokploy",
                provider_resource_id: reference.resourceId, state: "stopped",
                created_at: new Date(reference.createdAt), tenant_status: "active", lease_expires_at: null,
              }],
              rowCount: 1,
            };
            if (statement.startsWith("UPDATE public.tenant_hosting_deployments")) return { rows: [], rowCount: 1 };
            return { rows: [], rowCount: 1 };
          },
          release() {},
        };
      },
    } as HostingLifecyclePool;
    const store = new PostgresHostingLifecycleStore(pool);
    const result = await store.claim({ ...input, action: "start", expectedProvider: "dokploy" });
    expect(result.kind).toBe("claimed");
    if (result.kind !== "claimed") return;
    expect(result.claim).toMatchObject({ deploymentId: claim.deploymentId, reference });
    expect(statements.some((statement) => statement.includes("FOR UPDATE OF d,t"))).toBe(true);
    expect(parameters.some((values) => values[0] === claim.deploymentId && values[1] === reference.tenantId)).toBe(true);
    expect(parameters.some((values) => values[0] === claim.deploymentId && values[5] === "platform-owner")).toBe(true);
  });

  it("rejects a provider mismatch before leasing or mutating a foreign resource", async () => {
    const statements: string[] = [];
    const pool = {
      async connect() {
        return {
          async query(statement: string) {
            statements.push(statement);
            if (statement.startsWith("SELECT d.id::text")) return {
              rows: [{
                id: claim.deploymentId, tenant_id: reference.tenantId, provider: "another-provider",
                provider_resource_id: reference.resourceId, state: "stopped",
                created_at: new Date(reference.createdAt), tenant_status: "active", lease_expires_at: null,
              }],
              rowCount: 1,
            };
            return { rows: [], rowCount: 1 };
          },
          release() {},
        };
      },
    } as HostingLifecyclePool;
    const result = await new PostgresHostingLifecycleStore(pool).claim({
      ...input, action: "start", expectedProvider: "dokploy",
    });
    expect(result).toEqual({ kind: "provider_mismatch" });
    expect(statements.some((statement) => statement.startsWith("UPDATE"))).toBe(false);
    expect(statements).toContain("ROLLBACK");
  });

  it("requires closed tenants and stopped deployments before resource removal", async () => {
    const pool = {
      async connect() {
        return {
          async query(statement: string) {
            if (statement.startsWith("SELECT d.id::text")) return {
              rows: [{
                id: claim.deploymentId, tenant_id: reference.tenantId, provider: "dokploy",
                provider_resource_id: reference.resourceId, state: "running",
                created_at: new Date(reference.createdAt), tenant_status: "active", lease_expires_at: null,
              }],
              rowCount: 1,
            };
            return { rows: [], rowCount: 1 };
          },
          release() {},
        };
      },
    } as HostingLifecyclePool;
    const result = await new PostgresHostingLifecycleStore(pool).claim({
      ...input, action: "remove", expectedProvider: "dokploy",
    });
    expect(result).toEqual({ kind: "tenant_not_closed" });
  });
});

describe("TenantHostingLifecycleService", () => {
  it("starts an existing resource and persists provider-confirmed state", async () => {
    const { service, store, provider } = setup();
    const result = await service.execute(input);
    expect(provider.start).toHaveBeenCalledWith(reference);
    expect(provider.inspect).toHaveBeenCalledWith(reference);
    expect(store.complete).toHaveBeenCalledWith(expect.objectContaining({
      claim, action: "start", state: "running", confirmed: true,
    }));
    expect(result).toEqual({ action: "start", state: "running", confirmed: true, already: false });
  });

  it("uses the dedicated stop operation and verifies stopped state", async () => {
    const { service, store, provider } = setup();
    vi.mocked(provider.inspect).mockResolvedValueOnce({ reference, state: "stopped", lastDeployedAt: null });
    const result = await service.execute({ ...input, action: "stop" });
    expect(provider.stop).toHaveBeenCalledWith(reference);
    expect(store.complete).toHaveBeenCalledWith(expect.objectContaining({
      action: "stop", state: "stopped", confirmed: true,
    }));
    expect(result.confirmed).toBe(true);
  });

  it("uses redeploy without requesting fresh persistent volumes", async () => {
    const { service, provider } = setup();
    await service.execute({ ...input, action: "redeploy" });
    expect(provider.redeploy).toHaveBeenCalledWith(reference);
  });

  it("removes only through the store's closed-tenant claim and records removed state", async () => {
    const { service, store, provider } = setup();
    const result = await service.execute({ ...input, action: "remove" });
    expect(provider.remove).toHaveBeenCalledWith(reference);
    expect(provider.inspect).not.toHaveBeenCalled();
    expect(store.complete).toHaveBeenCalledWith(expect.objectContaining({
      action: "remove", state: "removed", confirmed: true,
    }));
    expect(result.state).toBe("removed");
  });

  it("does not call the provider when the action is already satisfied", async () => {
    const { service, provider } = setup({ kind: "already", state: "running" });
    const result = await service.execute(input);
    expect(result).toEqual({ action: "start", state: "running", confirmed: true, already: true });
    expect(provider.start).not.toHaveBeenCalled();
  });

  it("does not replay a failed mutating operation and sends the state to reconciliation", async () => {
    const { service, store, provider } = setup();
    vi.mocked(provider.start).mockRejectedValueOnce(new Error("DOKPLOY_HTTP_503"));
    await expect(service.execute(input)).rejects.toThrow("HOSTING_PROVIDER_ACTION_FAILED");
    expect(store.fail).toHaveBeenCalledWith(expect.objectContaining({
      claim, action: "start", errorCode: "DOKPLOY_HTTP_503",
    }));
    expect(provider.start).toHaveBeenCalledTimes(1);
  });

  it("records uncertain state when inspection fails after an accepted action", async () => {
    const { service, store, provider } = setup();
    vi.mocked(provider.inspect).mockRejectedValueOnce(new Error("inspection unavailable"));
    const result = await service.execute(input);
    expect(result.state).toBe("unknown");
    expect(result.confirmed).toBe(false);
    expect(store.complete).toHaveBeenCalledWith(expect.objectContaining({
      state: "unknown", confirmed: false,
    }));
  });
});
