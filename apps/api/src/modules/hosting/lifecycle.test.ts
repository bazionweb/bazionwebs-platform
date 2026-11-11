import { describe, expect, it, vi } from "vitest";
import type { TenantHostingDeploymentReference, TenantHostingProvider } from "@bazion/platform-contracts";
import {
  TenantHostingLifecycleService,
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
