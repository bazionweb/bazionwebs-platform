import { describe, expect, it, vi } from "vitest";
import type { TenantHostingDeploymentReference, TenantHostingProvider } from "@bazion/platform-contracts";
import {
  PostgresHostingReconciliationStore,
  TenantHostingDeploymentReconciler,
  type HostingReconciliationPool,
  type HostingReconciliationStore,
} from "./reconciler.js";

const tenantId = "11111111-1111-4111-8111-111111111111";
const reference: TenantHostingDeploymentReference = {
  provider: "dokploy",
  resourceId: "compose-123",
  tenantId: tenantId as TenantHostingDeploymentReference["tenantId"],
  createdAt: "2026-11-11T08:00:00.000Z",
};

function fakePool(
  handler: (statement: string, values?: unknown[]) => Promise<{ rows?: unknown[]; rowCount?: number }> | { rows?: unknown[]; rowCount?: number },
  statements: string[] = [],
  parameters: unknown[][] = [],
): HostingReconciliationPool {
  return {
    async connect() {
      return {
        async query<T = Record<string, unknown>>(statement: string, values: unknown[] = []) {
          statements.push(statement);
          parameters.push(values);
          const result = await handler(statement, values);
          const rows = result.rows ?? [];
          return { rows: rows as T[], rowCount: result.rowCount ?? rows.length };
        },
        release() {},
      };
    },
  };
}

function provider(overrides: Partial<TenantHostingProvider> = {}): TenantHostingProvider {
  return {
    provision: vi.fn(async () => reference),
    deploy: vi.fn(async () => undefined),
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    redeploy: vi.fn(async () => undefined),
    inspect: vi.fn(async () => ({ reference, state: "running" as const, lastDeployedAt: "2026-11-11T09:00:00.000Z" })),
    remove: vi.fn(async () => undefined),
    ...overrides,
  };
}

const options = {
  providerId: "dokploy",
  batchSize: 5,
  leaseSeconds: 180,
  intervalSeconds: 60,
  retryBaseSeconds: 30,
  retryMaxSeconds: 1800,
};

describe("PostgresHostingReconciliationStore", () => {
  it("claims due provider resources with SKIP LOCKED and unique renewable leases", async () => {
    const statements: string[] = [];
    const parameters: unknown[][] = [];
    const pool = fakePool((statement) => {
      if (statement.startsWith("SELECT id::text,tenant_id::text")) {
        return { rows: [{
          id: "deployment-1", tenant_id: tenantId, provider: "dokploy",
          provider_resource_id: "compose-123", created_at: new Date("2026-11-11T08:00:00.000Z"),
        }] };
      }
      if (statement.startsWith("UPDATE public.tenant_hosting_deployments")) return { rows: [{ id: "deployment-1" }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    }, statements, parameters);

    const claimed = await new PostgresHostingReconciliationStore(pool).claimBatch({
      provider: "dokploy", limit: 5, leaseSeconds: 180,
    });

    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toMatchObject({
      deploymentId: "deployment-1",
      reference: { provider: "dokploy", resourceId: "compose-123", tenantId },
    });
    expect(claimed[0]?.leaseToken).toMatch(/^[0-9a-f-]{36}$/i);
    expect(statements.some((statement) => statement.includes("FOR UPDATE SKIP LOCKED"))).toBe(true);
    expect(parameters.some((values) => values[0] === "dokploy" && values[1] === 5)).toBe(true);
  });

  it("records only state transitions and releases the claim lease", async () => {
    const statements: string[] = [];
    const parameters: unknown[][] = [];
    const pool = fakePool((statement) => {
      if (statement.startsWith("SELECT tenant_id::text,state")) return { rows: [{ tenant_id: tenantId, state: "deploying" }] };
      if (statement.startsWith("UPDATE public.tenant_hosting_deployments")) return { rows: [], rowCount: 1 };
      if (statement.startsWith("INSERT INTO public.tenant_hosting_deployment_events")) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    }, statements, parameters);

    const result = await new PostgresHostingReconciliationStore(pool).recordInspection({
      deploymentId: "deployment-1", leaseToken: "lease-1", state: "running",
      lastDeployedAt: "2026-11-11T09:00:00.000Z", intervalSeconds: 60, actorId: "hosting-reconciler",
    });

    expect(result).toEqual({ changed: true, state: "running" });
    expect(statements.some((statement) => statement.includes("lease_token=NULL,lease_expires_at=NULL"))).toBe(true);
    expect(statements.some((statement) => statement.includes("hosting.reconciliation.state_changed"))).toBe(true);
    const eventMetadata = parameters.find((values) =>
      typeof values[5] === "string" && values[5].includes('"providerState":"running"'),
    )?.[5];
    expect(eventMetadata).toContain('"providerState":"running"');
  });

  it("does not append a transition event when the provider state is unchanged", async () => {
    const statements: string[] = [];
    const pool = fakePool((statement) => {
      if (statement.startsWith("SELECT tenant_id::text,state")) return { rows: [{ tenant_id: tenantId, state: "running" }] };
      if (statement.startsWith("UPDATE public.tenant_hosting_deployments")) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    }, statements);

    const result = await new PostgresHostingReconciliationStore(pool).recordInspection({
      deploymentId: "deployment-1", leaseToken: "lease-1", state: "running",
      lastDeployedAt: null, intervalSeconds: 60, actorId: "hosting-reconciler",
    });
    expect(result).toEqual({ changed: false, state: "running" });
    expect(statements.some((statement) => statement.includes("INSERT INTO public.tenant_hosting_deployment_events"))).toBe(false);
  });

  it("backs off exponentially and samples repeated failure events", async () => {
    const statements: string[] = [];
    const parameters: unknown[][] = [];
    const pool = fakePool((statement) => {
      if (statement.startsWith("SELECT tenant_id::text,state,reconcile_failure_count")) {
        return { rows: [{ tenant_id: tenantId, state: "deploying", reconcile_failure_count: 3 }] };
      }
      if (statement.startsWith("UPDATE public.tenant_hosting_deployments")) return { rows: [], rowCount: 1 };
      if (statement.startsWith("INSERT INTO public.tenant_hosting_deployment_events")) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    }, statements, parameters);

    const result = await new PostgresHostingReconciliationStore(pool).recordInspectionFailure({
      deploymentId: "deployment-1", leaseToken: "lease-1", errorCode: "DOKPLOY_HTTP_503",
      retryBaseSeconds: 30, retryMaxSeconds: 1800, actorId: "hosting-reconciler",
    });
    expect(result).toEqual({ failureCount: 4, retryInSeconds: 240 });
    expect(statements.some((statement) => statement.includes("hosting.reconciliation.inspection_failed"))).toBe(true);
    expect(parameters.some((values) => values.includes(240) && values.includes(4))).toBe(true);
  });
});

describe("TenantHostingDeploymentReconciler", () => {
  function setup(providerPort: TenantHostingProvider) {
    const store: HostingReconciliationStore = {
      claimBatch: vi.fn(async () => [{
        deploymentId: "deployment-1", reference, leaseToken: "lease-1",
      }]),
      recordInspection: vi.fn(async () => ({ changed: true, state: "running" })),
      recordInspectionFailure: vi.fn(async () => ({ failureCount: 1, retryInSeconds: 30 })),
    };
    return { reconciler: new TenantHostingDeploymentReconciler(store, providerPort, options), store };
  }

  it("inspects existing provider resources and persists the observed state", async () => {
    const port = provider();
    const { reconciler, store } = setup(port);
    const result = await reconciler.runBatch();

    expect(port.inspect).toHaveBeenCalledWith(reference);
    expect(port.provision).not.toHaveBeenCalled();
    expect(port.deploy).not.toHaveBeenCalled();
    expect(store.recordInspection).toHaveBeenCalledWith(expect.objectContaining({
      deploymentId: "deployment-1", leaseToken: "lease-1", state: "running",
      intervalSeconds: 60, actorId: "hosting-reconciler",
    }));
    expect(result).toEqual({ claimed: 1, inspected: 1, changed: 1, failed: 0, leaseLost: 0 });
  });

  it("backs off an unknown provider state without overwriting the last known deployment state", async () => {
    const port = provider({
      inspect: vi.fn(async () => ({ reference, state: "unknown" as const, lastDeployedAt: null })),
    });
    const { reconciler, store } = setup(port);
    const result = await reconciler.runBatch();

    expect(store.recordInspection).not.toHaveBeenCalled();
    expect(store.recordInspectionFailure).toHaveBeenCalledWith(expect.objectContaining({
      errorCode: "HOSTING_PROVIDER_STATE_UNKNOWN",
    }));
    expect(result).toEqual({ claimed: 1, inspected: 0, changed: 0, failed: 1, leaseLost: 0 });
  });

  it("does not persist untrusted provider error text", async () => {
    const port = provider({
      inspect: vi.fn(async () => { throw new Error("token=private-secret"); }),
    });
    const { reconciler, store } = setup(port);
    await reconciler.runBatch();

    expect(store.recordInspectionFailure).toHaveBeenCalledWith(expect.objectContaining({
      errorCode: "HOSTING_PROVIDER_INSPECTION_FAILED",
    }));
  });
});
