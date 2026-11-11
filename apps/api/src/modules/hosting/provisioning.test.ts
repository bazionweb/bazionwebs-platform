import { describe, expect, it, vi } from "vitest";
import type { TenantHostingDeploymentReference, TenantHostingProvider } from "@bazion/platform-contracts";
import {
  TenantHostingProvisioningService,
  type BeginHostingProvisionResult,
  type HostingProvisioningStore,
} from "./provisioning.js";

const tenantId = "11111111-1111-4111-8111-111111111111";
const reference: TenantHostingDeploymentReference = {
  provider: "dokploy",
  resourceId: "compose-123",
  tenantId: tenantId as TenantHostingDeploymentReference["tenantId"],
  createdAt: "2026-11-11T00:00:00.000Z",
};

function setup(beginResult?: BeginHostingProvisionResult) {
  const store: HostingProvisioningStore = {
    begin: vi.fn(async (_input: Parameters<HostingProvisioningStore["begin"]>[0]): Promise<BeginHostingProvisionResult> => beginResult ?? ({
      kind: "claimed", deploymentId: "deployment-1", tenantSlug: "acme",
      leaseToken: "lease-1", attemptCount: 1, reference: null,
    })),
    attachReference: vi.fn(async () => true),
    markRunning: vi.fn(async () => true),
    markFailed: vi.fn(async () => undefined),
  };
  const provider: TenantHostingProvider = {
    provision: vi.fn(async () => reference),
    deploy: vi.fn(async () => undefined),
    inspect: vi.fn(async () => ({ reference, state: "running" as const, lastDeployedAt: null })),
    stop: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
  };
  return { service: new TenantHostingProvisioningService(store, provider, "dokploy"), store, provider };
}

const input = {
  tenantId,
  template: "wordpress" as const,
  templateVersion: "wordpress-2026-11-01",
  idempotencyKey: "request-12345678",
  composeFile: "services: {}",
  environmentSecretRef: "secret://tenant-1/wordpress",
  actorType: "user" as const,
  actorId: "platform-owner",
  requestId: "request-id-1",
};

describe("TenantHostingProvisioningService", () => {
  it("persists the provider reference before deploying and marks the deployment running", async () => {
    const { service, store, provider } = setup();
    const result = await service.provision(input);

    expect(provider.provision).toHaveBeenCalledWith(expect.objectContaining({
      tenantId, tenantSlug: "acme", template: "wordpress",
    }));
    expect(store.attachReference).toHaveBeenCalledWith(expect.objectContaining({
      deploymentId: "deployment-1", leaseToken: "lease-1", reference,
    }));
    expect(provider.deploy).toHaveBeenCalledWith(reference);
    expect(store.markRunning).toHaveBeenCalledWith(expect.objectContaining({
      deploymentId: "deployment-1", leaseToken: "lease-1",
    }));
    expect(result).toEqual({ reference, state: "running", attemptCount: 1, reused: false });
  });

  it("retries a known provider resource by deploying it instead of creating a duplicate", async () => {
    const { service, provider, store } = setup({
      kind: "claimed", deploymentId: "deployment-1", tenantSlug: "acme",
      leaseToken: "lease-2", attemptCount: 2, reference,
    });
    const result = await service.provision(input);

    expect(provider.provision).not.toHaveBeenCalled();
    expect(provider.deploy).toHaveBeenCalledWith(reference);
    expect(store.attachReference).not.toHaveBeenCalled();
    expect(result.reused).toBe(true);
    expect(result.attemptCount).toBe(2);
  });

  it("returns an existing running deployment without contacting the provider", async () => {
    const { service, provider } = setup({ kind: "already_running", reference, attemptCount: 1 });
    const result = await service.provision(input);

    expect(provider.provision).not.toHaveBeenCalled();
    expect(provider.deploy).not.toHaveBeenCalled();
    expect(result.reused).toBe(true);
    expect(result.state).toBe("running");
  });

  it("does not retry an ambiguous create when the provider fails before returning a reference", async () => {
    const { service, store, provider } = setup();
    vi.mocked(provider.provision).mockRejectedValueOnce(new Error("network timeout"));
    await expect(service.provision(input)).rejects.toThrow("HOSTING_DEPLOYMENT_FAILED");
    expect(store.markFailed).toHaveBeenCalledWith(expect.objectContaining({
      errorCode: "HOSTING_PROVIDER_ERROR",
    }));
    expect(provider.provision).toHaveBeenCalledTimes(1);
  });

  it("rejects idempotency-key reuse with a different template before provider calls", async () => {
    const { service, provider } = setup({ kind: "idempotency_conflict" });
    await expect(service.provision(input)).rejects.toThrow("HOSTING_IDEMPOTENCY_CONFLICT");
    expect(provider.provision).not.toHaveBeenCalled();
  });

  it("rejects malformed tenant IDs and short idempotency keys", async () => {
    const { service, store } = setup();
    await expect(service.provision({ ...input, tenantId: "not-a-uuid" })).rejects.toThrow("HOSTING_PROVISION_INPUT_INVALID");
    await expect(service.provision({ ...input, idempotencyKey: "short" })).rejects.toThrow("HOSTING_PROVISION_INPUT_INVALID");
    expect(store.begin).not.toHaveBeenCalled();
  });
});
