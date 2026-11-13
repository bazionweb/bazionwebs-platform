import { describe, expect, it, vi } from "vitest";
import {
  runProvisioningSaga,
  type ProvisioningSagaJournal,
  type ProvisioningSagaStepName,
  type ProvisioningStepEffect,
} from "@bazion/product-installations";
import { buildProductInitialConfiguration } from "./product-configuration.js";
import {
  buildProvisioningSagaSteps,
  createDefaultProvisioningStepAdapters,
  type PostgresPoolLike,
  type ProvisioningOperationMetadata,
} from "./saga-orchestrator.js";
import { stagingPilotOfferBindings } from "./pilot-cutover.js";

function makeOperation(overrides: Partial<ProvisioningOperationMetadata> = {}): ProvisioningOperationMetadata {
  return {
    operationId: "11111111-1111-4111-8111-111111111111",
    correlationId: "22222222-2222-4222-8222-222222222222",
    externalCustomerId: "cust-unit-01",
    externalOrderId: "INV-UNIT-100:line:0",
    offerId: "website-launch",
    offerVersion: "1.0.0",
    productId: "church-ministry",
    productVersion: "1.0.0",
    solutionId: "church-ministry",
    solutionVersion: "1.0.0",
    templateId: "church-ministry",
    templateVersion: "1.0.0",
    requestedDomain: null,
    distributionMode: "shared-managed",
    attemptCount: 1,
    ...overrides,
  };
}

function makeMockPool(handler: (sql: string, values?: readonly unknown[]) => Promise<{ rows: any[]; rowCount?: number }>) {
  const client = {
    query: vi.fn(handler),
    release: vi.fn(),
  };
  const pool: PostgresPoolLike = {
    query: vi.fn(handler),
    connect: vi.fn(async () => client as any),
  };
  return { pool, client };
}

describe("product-specific initial configuration and shared-managed isolation", () => {
  it("builds distinct deterministic secret-free configurations per product", () => {
    const churchConfig = buildProductInitialConfiguration(
      makeOperation({ productId: "church-ministry" }),
      stagingPilotOfferBindings[0],
    );
    expect(churchConfig.requiredModules).toEqual(["platform-identity", "church-ministry", "media-storage"]);
    expect(churchConfig.configuration.productSettings).toMatchObject({
      profileMode: "church-ministry",
      siteKey: "public_site",
      storageQuotaMb: 2048,
    });

    const ecommerceConfig = buildProductInitialConfiguration(
      makeOperation({ productId: "ecommerce", solutionId: "ecommerce-storefront", templateId: "ecommerce" }),
    );
    expect(ecommerceConfig.requiredModules).toEqual(["platform-identity", "commerce", "media-storage"]);
    expect(ecommerceConfig.configuration.productSettings).toMatchObject({
      profileMode: "commerce-storefront",
      storeDefaults: { defaultCountryCode: "KE", defaultCurrency: "KES" },
    });

    const siteConfig = buildProductInitialConfiguration(
      makeOperation({ productId: "bazion-site", solutionId: "website-business", templateId: "node-nextjs" }),
    );
    expect(siteConfig.requiredModules).toEqual(["platform-identity", "website-content", "media-storage"]);
    expect(siteConfig.configuration.productSettings).toMatchObject({
      profileMode: "managed-website",
    });
  });

  it("idempotently applies product config, required module entitlements, and tenant settings and detects partial retry state", async () => {
    const insertedModules: string[] = [];
    const insertedSettings: string[] = [];
    const configVersions = new Map<string, string>();
    let presentModules: string[] = ["platform-identity", "church-ministry", "media-storage"];

    const provisioner = makeMockPool(async (sql, values) => {
      if (sql.includes("INSERT INTO public.installation_configuration_versions")) {
        const installationId = String(values?.[1]);
        const checksum = String(values?.[5]);
        if (configVersions.has(installationId)) {
          return { rows: [], rowCount: 0 };
        }
        configVersions.set(installationId, checksum);
        return { rows: [{ checksum }], rowCount: 1 };
      }
      if (sql.includes("SELECT checksum") && sql.includes("installation_configuration_versions")) {
        const checksum = configVersions.get(String(values?.[1]));
        return checksum ? { rows: [{ checksum }], rowCount: 1 } : { rows: [], rowCount: 0 };
      }
      if (sql.includes("SELECT version, checksum") && sql.includes("installation_configuration_versions")) {
        const checksum = configVersions.get(String(values?.[1]));
        return checksum ? { rows: [{ version: 1, checksum }], rowCount: 1 } : { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 1 };
    });

    const platform = makeMockPool(async (sql, values) => {
      if (sql.includes("INSERT INTO public.tenant_module_entitlements")) {
        insertedModules.push(String(values?.[1]));
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO public.tenant_platform_settings")) {
        insertedSettings.push(String(values?.[0]));
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("FROM public.tenant_module_entitlements")) {
        return { rows: presentModules.map((m) => ({ module_id: m })), rowCount: presentModules.length };
      }
      return { rows: [], rowCount: 1 };
    });

    const adapters = createDefaultProvisioningStepAdapters({
      provisionerPool: provisioner.pool,
      platformPool: platform.pool,
      offerBindings: stagingPilotOfferBindings,
    });
    const operation = makeOperation();
    const context = {
      operationId: operation.operationId,
      correlationId: operation.correlationId,
      externalOrderId: operation.externalOrderId,
      tenantId: "33333333-3333-4333-8333-333333333333",
      installationId: "44444444-4444-4444-8444-444444444444",
    };

    const first = await adapters.configureInstallation({
      operation,
      context,
      idempotencyKey: "cfg-key-1",
    });
    const replay = await adapters.configureInstallation({
      operation,
      context,
      idempotencyKey: "cfg-key-1",
    });

    expect(first.configurationVersion).toBe(1);
    expect(replay).toEqual(first);
    expect(insertedModules).toEqual([
      "platform-identity",
      "church-ministry",
      "media-storage",
      "platform-identity",
      "church-ministry",
      "media-storage",
    ]);
    expect(insertedSettings).toHaveLength(2);

    // Inspect confirms completed when both config version and entitlements exist
    await expect(
      adapters.inspectConfiguration?.({ operation, context, idempotencyKey: "cfg-key-1" }),
    ).resolves.toEqual(first);

    // Partial entitlement failure triggers safe re-apply instead of skipping configuration
    presentModules = ["platform-identity"];
    await expect(
      adapters.inspectConfiguration?.({ operation, context, idempotencyKey: "cfg-key-1" }),
    ).resolves.toBeNull();
  });

  it("proves shared-managed saga completes via shared DB only and never invokes hostingRuntime/Dokploy", async () => {
    const hostingSpy = {
      providerId: "dokploy",
      provision: vi.fn(async () => {
        throw new Error("Dokploy must never be called for shared-managed provisioning");
      }),
      inspect: vi.fn(async () => ({ status: "ready" })),
      stop: vi.fn(async () => undefined),
    };

    const provisioner = makeMockPool(async (sql) => {
      if (sql.includes("request_fingerprint") && sql.includes("FROM public.product_provisioning_operations")) {
        return { rows: [{ request_fingerprint: "a".repeat(64) }], rowCount: 1 };
      }
      if (sql.includes("FROM public.product_provisioning_operations")) {
        return { rows: [{ tenant_id: null }], rowCount: 0 };
      }
      if (sql.includes("SELECT id::text, status FROM public.product_installations")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("INSERT INTO public.product_installations")) {
        return { rows: [{ id: "44444444-4444-4444-8444-444444444444" }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO public.installation_configuration_versions")) {
        return { rows: [{ checksum: "a".repeat(64) }], rowCount: 1 };
      }
      if (sql.includes("UPDATE public.product_installations")) {
        return { rows: [{ status: "ready" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });

    const platform = makeMockPool(async (sql) => {
      if (sql.includes("SELECT id::text, slug FROM public.tenants")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("INSERT INTO public.tenants")) {
        return { rows: [{ id: "33333333-3333-4333-8333-333333333333", slug: "org-cust-unit-01" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });

    const adapters = createDefaultProvisioningStepAdapters({
      provisionerPool: provisioner.pool,
      platformPool: platform.pool,
      hostingRuntime: hostingSpy,
      offerBindings: stagingPilotOfferBindings,
    });

    const operation = makeOperation({ distributionMode: "shared-managed" });
    const steps = buildProvisioningSagaSteps(operation, adapters);

    const completedSteps: Array<{ name: ProvisioningSagaStepName; effect: ProvisioningStepEffect }> = [];
    const journal: ProvisioningSagaJournal = {
      load: vi.fn(async () => ({
        status: "accepted" as const,
        completedSteps: [...completedSteps],
        compensatedSteps: [],
        failure: null,
      })),
      setStatus: vi.fn(async () => undefined),
      startStep: vi.fn(async () => 1),
      completeStep: vi.fn(async (_operationId, step, effect) => {
        completedSteps.push({ name: step, effect });
      }),
      failStep: vi.fn(async () => undefined),
      startCompensation: vi.fn(async () => 1),
      completeCompensation: vi.fn(async () => undefined),
      failCompensation: vi.fn(async () => undefined),
    };

    const result = await runProvisioningSaga({
      steps,
      journal,
      context: {
        operationId: operation.operationId,
        correlationId: operation.correlationId,
        externalOrderId: operation.externalOrderId,
        tenantId: null,
        installationId: null,
      },
    });

    expect(result.status).toBe("ready");
    expect(hostingSpy.provision).not.toHaveBeenCalled();
    expect(hostingSpy.inspect).not.toHaveBeenCalled();
    expect(hostingSpy.stop).not.toHaveBeenCalled();
    expect(journal.completeStep).toHaveBeenCalledWith(
      operation.operationId,
      "provision_hosting",
      { hosting_mode: "shared_managed", isolation_tier: "shared" },
      undefined,
    );
  });
});
