import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { signMachineBearerToken } from "./auth.js";
import {
  CommercialProvisioningTelemetry,
  evaluateSloAlerts,
  fastifySensitiveRedactionPaths,
  ProvisioningSloService,
  redactSensitiveString,
  redactStructuredContext,
  resolveCorrelationId,
} from "./observability.js";
import {
  assertCommandAllowedByCohortPolicy,
  CutoverReadinessService,
  getEffectiveOfferBindingsForMode,
  getProvisioningCatalogForPolicy,
  resolvePilotCohortPolicy,
  stagingPilotOfferBindings,
} from "./pilot-cutover.js";
import { platformProvisioningOfferBindings } from "./offer-resolution.js";
import { CrossEntityReconciliationService } from "./reconciliation-service.js";
import { commercialProvisioningRoutes, type CommercialProvisioningRuntime } from "./routes.js";
import { CommercialProvisioningService, type CommercialSqlPool, type SqlResult } from "./service.js";
import { PlatformStatusOutboxDispatcher } from "./status-outbox-worker.js";

const mocks = vi.hoisted(() => ({
  appendAuditEvent: vi.fn(async () => undefined),
  requirePlatformRole: vi.fn(async () => ({
    userId: "owner-1",
    email: "owner@bazion.example",
    role: "platform_owner" as const,
  })),
}));

vi.mock("@bazion/audit", async () => {
  const actual = await vi.importActual<typeof import("@bazion/audit")>("@bazion/audit");
  return {
    ...actual,
    PostgresAuditEventWriter: class {
      append = mocks.appendAuditEvent;
    },
  };
});

vi.mock("@bazion/auth", () => ({ requirePlatformRole: mocks.requirePlatformRole }));
vi.mock("../../lib/database.js", () => ({ pool: { query: vi.fn() } }));

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "../../../../..");

function loadJson(relativePath: string): Record<string, any> {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8")) as Record<string, any>;
}

function makeMockPool(queryHandler: (sql: string, params?: unknown[]) => Promise<SqlResult<any>>): CommercialSqlPool {
  const client = {
    query: queryHandler,
    release: vi.fn(),
  };
  return {
    connect: vi.fn(async () => client),
    query: queryHandler,
  };
}

describe("Phase 7 pilot cohort policy and manifest contract alignment", () => {
  it("keeps production allowlist closed and aligns staging pilot binding with real catalog and manifests", () => {
    expect(platformProvisioningOfferBindings).toEqual([]);
    expect(stagingPilotOfferBindings).toHaveLength(1);

    const pilot = stagingPilotOfferBindings[0]!;
    const commercialOffers = loadJson("products/commercial-offerings.json");
    const productManifest = loadJson(`products/${pilot.composition.product.id}/manifest.json`);
    const solutionManifest = loadJson(`solutions/${pilot.composition.solution.id}/manifest.json`);
    const templateManifest = loadJson(`templates/${pilot.composition.template.id}/manifest.json`);

    expect(commercialOffers.offerings.some((o: any) => o.id === pilot.offer.id)).toBe(true);
    expect(productManifest.version).toBe(pilot.composition.product.version);
    expect(solutionManifest.version).toBe(pilot.composition.solution.version);
    expect(solutionManifest.readiness).toBe("buildable");
    expect(templateManifest.version).toBe(pilot.composition.template.version);
    expect(pilot.distributionMode).toBe("shared-managed");
    expect(pilot.releaseState.product).toBe("partial");
  });

  it("blocks staging_pilot and open canary in production while isolating non-prod staging pilot customer cohorts", () => {
    expect(() =>
      resolvePilotCohortPolicy({
        pilotMode: "staging_pilot",
        nodeEnv: "production",
        hostingMutationsEnabled: false,
        legacyFallbackEnabled: true,
        dualReadReconciliationEnabled: true,
      }),
    ).toThrow(/staging_pilot is forbidden in production/i);

    expect(() =>
      resolvePilotCohortPolicy({
        pilotMode: "canary",
        nodeEnv: "production",
        hostingMutationsEnabled: false,
        legacyFallbackEnabled: true,
        dualReadReconciliationEnabled: true,
        allowedOffers: ["website-launch@1.0.0"],
        allowedCustomerIds: [],
      }),
    ).toThrow(/COMMERCIAL_PROVISIONING_CANARY_CUSTOMERS/i);

    const stagingPolicy = resolvePilotCohortPolicy({
      pilotMode: "staging_pilot",
      nodeEnv: "staging",
      hostingMutationsEnabled: false,
      legacyFallbackEnabled: true,
      dualReadReconciliationEnabled: true,
      allowedCustomerIds: ["cust-pilot-staging-1"],
    });

    expect(stagingPolicy.productionAllowlistClosed).toBe(true);
    expect(stagingPolicy.hostingMutationsEnabled).toBe(false);
    expect(getEffectiveOfferBindingsForMode(stagingPolicy.pilotMode)).toHaveLength(1);
    expect(getProvisioningCatalogForPolicy(stagingPolicy).bindings[0]?.offer.id).toBe("website-launch");

    const baseReq = {
      schemaVersion: "1.0.0" as const,
      eventId: "11111111-1111-4111-8111-111111111111",
      correlationId: "22222222-2222-4222-8222-222222222222",
      idempotencyKey: "bazionweb:order:pilot:line:0:v1",
      occurredAt: "2026-11-12T00:00:00.000Z",
      source: "bazionweb" as const,
      customer: {
        externalCustomerId: "cust-other-tenant",
        displayName: "Other Customer",
        primaryContact: { name: "Bob", email: "bob@example.test" },
      },
      order: {
        externalOrderId: "order-other-1",
        offerId: "website-launch",
        offerVersion: "1.0.0",
      },
      composition: stagingPilotOfferBindings[0]!.composition,
    };

    expect(() => assertCommandAllowedByCohortPolicy(baseReq, stagingPolicy)).toThrow(/not enrolled/i);
    expect(() =>
      assertCommandAllowedByCohortPolicy(
        { ...baseReq, customer: { ...baseReq.customer, externalCustomerId: "cust-pilot-staging-1" } },
        stagingPolicy,
      ),
    ).not.toThrow();
  });
});

describe("Phase 7 observability, redaction, SLOs, reconciliation & cutover gates", () => {
  it("redacts secrets, credentials, payment fields, auth claims, and email PII", () => {
    const sanitized = redactStructuredContext({
      correlationId: "22222222-2222-4222-8222-222222222222",
      email: "customer@example.com",
      primaryContact: { name: "Alice", email: "alice@example.com" },
      paymentSecret: "sk_live_secret_value",
      authClaims: { sub: "svc-1" },
      databaseUrl: "postgres://user:pass@localhost:5432/db",
      summary: "Contact admin@example.com with Bearer secret_token_12345 or postgres://u:p@host:5432/x",
    }) as Record<string, unknown>;

    expect(sanitized.email).toBe("[REDACTED]");
    expect(sanitized.primaryContact).toBe("[REDACTED]");
    expect(sanitized.paymentSecret).toBe("[REDACTED]");
    expect(sanitized.authClaims).toBe("[REDACTED]");
    expect(sanitized.databaseUrl).toBe("[REDACTED]");
    expect(String(sanitized.summary)).not.toContain("admin@example.com");
    expect(String(sanitized.summary)).not.toContain("secret_token_12345");
    expect(String(sanitized.summary)).not.toContain("postgres://");
    expect(redactSensitiveString("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig123456789")).toBe("[REDACTED_JWT]");
    expect(fastifySensitiveRedactionPaths).toContain("req.body.customer.primaryContact");
  });

  it("propagates correlation IDs on outgoing status webhook deliveries", async () => {
    const claimedId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const opId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const corrId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const eventId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

    const pool = makeMockPool(async (sql) => {
      if (sql.includes("FROM public.product_provisioning_status_outbox") && sql.includes("FOR UPDATE SKIP LOCKED")) {
        return {
          rows: [
            {
              id: claimedId,
              operation_id: opId,
              event_id: eventId,
              correlation_id: corrId,
              payload: {
                schemaVersion: "1.0.0",
                eventType: "product.provisioning.status.v1",
                eventId,
                correlationId: corrId,
                occurredAt: "2026-11-12T00:00:00.000Z",
                source: "bazion-platform",
                operation: {
                  schemaVersion: "1.0.0",
                  operationId: opId,
                  correlationId: corrId,
                  externalOrderId: "order-1",
                  status: "ready",
                  currentStep: "finalize",
                  tenantId: null,
                  installationId: null,
                  failure: null,
                  updatedAt: "2026-11-12T00:00:00.000Z",
                },
              },
              attempt_count: 1,
              max_attempts: 8,
            },
          ],
          rowCount: 1,
        };
      }
      if (sql.includes("SET status = 'processing'") && sql.includes("RETURNING id, attempt_count")) {
        return { rows: [{ id: claimedId, attempt_count: 1 }], rowCount: 1 };
      }
      if (sql.includes("SET status = 'delivered'")) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    let capturedHeaders: Record<string, string> = {};
    const dispatcher = new PlatformStatusOutboxDispatcher(pool, async (_url, init) => {
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
      return new Response("{}", { status: 202 });
    });

    const batch = await dispatcher.processDueBatch({
      callbackUrl: "https://bazionweb.example.test/webhooks/provisioning",
      signingSecret: "test-signing-secret-at-least-32-chars",
    });

    expect(batch.delivered).toBe(1);
    expect(capturedHeaders["X-Correlation-Id"]).toBe(corrId);
    expect(capturedHeaders["X-Bazion-Correlation-Id"]).toBe(corrId);
  });

  it("reconciles 5 entities with owner and age attribution for every drift class", async () => {
    const opReadyId = "11111111-1111-4111-8111-111111111111";
    const opCompId = "22222222-2222-4222-8222-222222222222";
    const tenant1 = "33333333-3333-4333-8333-333333333333";
    const inst1 = "44444444-4444-4444-8444-444444444444";
    const dep1 = "55555555-5555-4555-8555-555555555555";
    const deadOutboxId = "66666666-6666-4666-8666-666666666666";
    const oldTime = new Date(Date.now() - 600_000).toISOString();

    const provisionerPool = makeMockPool(async (sql) => {
      if (sql.includes("FROM public.product_provisioning_operations")) {
        return {
          rows: [
            {
              id: opReadyId,
              external_customer_id: "cust-pilot-1",
              external_order_id: "order-drift-1",
              offer_id: "website-launch",
              offer_version: "1.0.0",
              product_id: "church-ministry",
              product_version: "1.0.0",
              solution_id: "church-ministry",
              solution_version: "1.0.0",
              template_id: "church-ministry",
              template_version: "1.0.0",
              status: "ready",
              failure_code: null,
              failure_disposition: null,
              tenant_id: tenant1,
              installation_id: inst1,
              lease_token: null,
              lease_expires_at: null,
              accepted_at: oldTime,
              updated_at: oldTime,
            },
            {
              id: opCompId,
              external_customer_id: "cust-pilot-2",
              external_order_id: "order-comp-1",
              offer_id: "website-launch",
              offer_version: "1.0.0",
              product_id: "church-ministry",
              product_version: "1.0.0",
              solution_id: "church-ministry",
              solution_version: "1.0.0",
              template_id: "church-ministry",
              template_version: "1.0.0",
              status: "compensation_required",
              failure_code: "AMBIGUOUS_EXTERNAL_STATE",
              failure_disposition: "unknown",
              tenant_id: null,
              installation_id: null,
              lease_token: null,
              lease_expires_at: null,
              accepted_at: oldTime,
              updated_at: oldTime,
            },
          ],
          rowCount: 2,
        };
      }
      if (sql.includes("FROM public.product_provisioning_inbox")) {
        return {
          rows: [{ operation_id: opReadyId, external_order_id: "order-drift-1" }],
          rowCount: 1,
        };
      }
      if (sql.includes("FROM public.product_provisioning_status_outbox")) {
        return {
          rows: [{ id: deadOutboxId, operation_id: opCompId, dead_lettered_at: oldTime, updated_at: oldTime }],
          rowCount: 1,
        };
      }
      if (sql.includes("FROM public.product_subscription_lifecycle_outbox")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("FROM public.product_installations")) {
        return {
          rows: [
            {
              id: inst1,
              tenant_id: tenant1,
              external_order_id: "order-drift-1",
              distribution_mode: "shared-managed",
              status: "ready",
              updated_at: oldTime,
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const tenantControlPlanePool = makeMockPool(async (sql) => {
      if (sql.includes("FROM public.tenants")) {
        return { rows: [{ id: tenant1, status: "active", updated_at: oldTime }], rowCount: 1 };
      }
      if (sql.includes("FROM public.tenant_module_entitlements")) {
        // Missing "church-ministry" and "media-storage" entitlements
        return { rows: [{ tenant_id: tenant1, module_id: "platform-identity", enabled: true }], rowCount: 1 };
      }
      if (sql.includes("FROM public.tenant_hosting_deployments")) {
        // Shared-managed unexpectedly created a Dokploy hosting deployment
        return { rows: [{ id: dep1, tenant_id: tenant1, state: "ready", error_code: null, updated_at: oldTime }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const reconService = new CrossEntityReconciliationService(
      provisionerPool,
      tenantControlPlanePool,
      stagingPilotOfferBindings,
    );

    const report = await reconService.reconcile([
      {
        externalOrderId: "order-drift-1",
        externalCustomerId: "cust-pilot-1",
        offerId: "website-launch",
        offerVersion: "1.0.0",
        paymentStatus: "paid",
        paidAt: oldTime,
        operationId: opReadyId,
        provisioningStatus: "ready",
        legacyFallbackUsed: true,
        legacyTenantId: "99999999-9999-4999-8999-999999999999",
      },
      {
        externalOrderId: "order-missing-op",
        externalCustomerId: "cust-pilot-3",
        offerId: "website-launch",
        offerVersion: "1.0.0",
        paymentStatus: "paid",
        paidAt: oldTime,
        provisioningStatus: "accepted",
        legacyFallbackUsed: false,
      },
    ]);

    const types = new Set(report.exceptions.map((e) => e.mismatchType));
    expect(types.has("paid_order_missing_operation")).toBe(true);
    expect(types.has("dual_read_legacy_mismatch")).toBe(true);
    expect(types.has("shared_managed_unexpected_hosting_deployment")).toBe(true);
    expect(types.has("installation_missing_module_entitlements")).toBe(true);
    expect(types.has("compensation_required_pending")).toBe(true);
    expect(types.has("outbox_dead_letter")).toBe(true);
    expect(report.exceptions.every((e) => e.ageSeconds >= 500)).toBe(true);

    const billingException = report.exceptions.find((e) => e.mismatchType === "paid_order_missing_operation");
    const hostingException = report.exceptions.find((e) => e.mismatchType === "shared_managed_unexpected_hosting_deployment");
    expect(billingException?.owner).toBe("commercial_billing");
    expect(hostingException?.owner).toBe("hosting_control");
  });

  it("evaluates SLO alerts and enforces blocking cutover gates until drills and zero drift pass", async () => {
    const telemetry = new CommercialProvisioningTelemetry();
    telemetry.recordCommandAcceptance({ durationMs: 42, succeeded: true });
    telemetry.recordCommandAcceptance({ durationMs: 2100, succeeded: false }); // 50% acceptance rate -> critical alert

    const stats = telemetry.getCommandAcceptanceStats();
    const alerts = evaluateSloAlerts(
      {
        commandAcceptanceCount: stats.count,
        commandAcceptanceSuccessRate: stats.successRate,
        commandAcceptanceP95Ms: stats.p95Ms,
        provisionReadyCount: 1,
        provisionReadyP95Seconds: 12,
        provisionReadyMaxSeconds: 12,
        callbackPendingCount: 0,
        callbackOverdueCount: 0,
        callbackMaxLagSeconds: 0,
        deadLetterCount: 0,
        deadLetterMaxAgeSeconds: 0,
        activeOperationLeaseCount: 0,
        maxOperationLeaseAgeSeconds: 0,
        compensationRequiredCount: 0,
        reconciliationDriftCount: 0,
      },
      {
        commandAcceptanceSuccessRateMin: 0.99,
        commandAcceptanceP95MsMax: 1500,
        provisionReadyP95SecondsMax: 300,
        callbackMaxLagSecondsMax: 120,
        deadLetterCountMax: 0,
        deadLetterMaxAgeSecondsMax: 300,
        operationLeaseAgeSecondsMax: 180,
        compensationRequiredCountMax: 0,
        reconciliationDriftCountMax: 0,
      },
    );
    expect(alerts.some((a) => a.id === "command_acceptance_success_rate" && a.severity === "critical")).toBe(true);
    expect(alerts.some((a) => a.id === "command_acceptance_latency_p95" && a.severity === "warning")).toBe(true);

    const healthyPool = makeMockPool(async () => ({
      rows: [
        {
          ready_count: 5,
          ready_p95_seconds: 18,
          ready_max_seconds: 25,
          callback_pending_count: 0,
          callback_overdue_count: 0,
          callback_max_lag_seconds: 0,
          dead_letter_count: 0,
          dead_letter_max_age_seconds: 0,
          active_lease_count: 0,
          max_lease_age_seconds: 0,
          compensation_required_count: 0,
        },
      ],
      rowCount: 1,
    }));
    const healthyTelemetry = new CommercialProvisioningTelemetry();
    healthyTelemetry.recordCommandAcceptance({ durationMs: 35, succeeded: true });

    const cleanRecon = {
      reconcile: vi.fn(async () => ({
        schemaVersion: "1.0.0" as const,
        generatedAt: new Date().toISOString(),
        scope: "platform_only" as const,
        correlationId: resolveCorrelationId(),
        summary: {
          ordersChecked: 0,
          operationsChecked: 5,
          installationsChecked: 5,
          entitlementsChecked: 15,
          deploymentsChecked: 0,
          totalExceptions: 0,
          criticalExceptions: 0,
          unresolvedDriftCount: 0,
        },
        exceptions: [],
      })),
    };
    const sloService = new ProvisioningSloService(healthyPool, cleanRecon as any, healthyTelemetry);

    const policy = resolvePilotCohortPolicy({
      pilotMode: "staging_pilot",
      nodeEnv: "staging",
      hostingMutationsEnabled: false,
      legacyFallbackEnabled: true,
      dualReadReconciliationEnabled: true,
    });

    const recordedAt = new Date().toISOString();
    const auditPoolNoDrills = { query: async <T = Record<string, unknown>>() => ({ rows: [] as T[], rowCount: 0 }) };
    const blockedCutover = new CutoverReadinessService(policy, sloService, cleanRecon as any, auditPoolNoDrills);
    const reportBlocked = await blockedCutover.evaluate();
    expect(reportBlocked.readyForStagingPilot).toBe(true);
    expect(reportBlocked.readyForCanary).toBe(false);
    expect(reportBlocked.readyToRemoveLegacyProvisioning).toBe(false);

    const auditPoolAllDrills = {
      query: async <T = Record<string, unknown>>() => ({
        rows: [
          { action: "commercial_provisioning.drill.staging_pilot_signoff", occurred_at: recordedAt },
          { action: "commercial_provisioning.drill.database_restore", occurred_at: recordedAt },
          { action: "commercial_provisioning.drill.archive_restore", occurred_at: recordedAt },
          { action: "commercial_provisioning.drill.canary_cohort_signoff", occurred_at: recordedAt },
          { action: "commercial_provisioning.drill.rollback_window", occurred_at: recordedAt },
        ] as unknown as T[],
        rowCount: 5,
      }),
    };
    const readyCutover = new CutoverReadinessService(policy, sloService, cleanRecon as any, auditPoolAllDrills);
    const reportReady = await readyCutover.evaluate();
    expect(reportReady.readyForCanary).toBe(true);
    expect(reportReady.readyToRemoveLegacyProvisioning).toBe(true);
  });

  it("exposes Phase 7 HTTP admin and internal routes with strict validation, correlation headers, and telemetry", async () => {
    mocks.appendAuditEvent.mockClear();
    const secret = "test-command-secret-at-least-32-chars";
    const telemetry = new CommercialProvisioningTelemetry();
    const reconService = {
      reconcile: vi.fn(async (orders: any[]) => ({
        schemaVersion: "1.0.0" as const,
        generatedAt: "2026-11-12T00:00:00.000Z",
        scope: orders.length > 0 ? ("cross_repo_five_way" as const) : ("platform_only" as const),
        correlationId: "22222222-2222-4222-8222-222222222222",
        summary: {
          ordersChecked: orders.length,
          operationsChecked: 1,
          installationsChecked: 1,
          entitlementsChecked: 3,
          deploymentsChecked: 0,
          totalExceptions: 0,
          criticalExceptions: 0,
          unresolvedDriftCount: 0,
        },
        exceptions: [],
      })),
    };

    const policy = resolvePilotCohortPolicy({
      pilotMode: "staging_pilot",
      nodeEnv: "staging",
      hostingMutationsEnabled: false,
      legacyFallbackEnabled: true,
      dualReadReconciliationEnabled: true,
    });

    const runtime: CommercialProvisioningRuntime = {
      commandAuth: { secret, issuer: "bazionweb", audience: "bazion-platform:commercial-provisioning" },
      service: {
        acceptCommand: vi.fn(async () => ({
          deduplicated: false,
          operation: {
            schemaVersion: "1.0.0" as const,
            operationId: "11111111-1111-4111-8111-111111111111",
            correlationId: "22222222-2222-4222-8222-222222222222",
            externalOrderId: "order-pilot-1",
            status: "accepted" as const,
            currentStep: "accept_command",
            tenantId: null,
            installationId: null,
            failure: null,
            updatedAt: "2026-11-12T00:00:00.000Z",
          },
        })),
        getOperation: vi.fn(),
        reconcile: vi.fn(),
      },
      dispatcher: { replayOutboxEntry: vi.fn() },
      pilotPolicy: policy,
      telemetry,
      reconciliationService: reconService as any,
      sloService: {
        evaluate: vi.fn(async () => ({
          schemaVersion: "1.0.0" as const,
          generatedAt: "2026-11-12T00:00:00.000Z",
          status: "healthy" as const,
          metrics: {
            commandAcceptanceCount: 1,
            commandAcceptanceSuccessRate: 1,
            commandAcceptanceP95Ms: 12,
            provisionReadyCount: 1,
            provisionReadyP95Seconds: 10,
            provisionReadyMaxSeconds: 10,
            callbackPendingCount: 0,
            callbackOverdueCount: 0,
            callbackMaxLagSeconds: 0,
            deadLetterCount: 0,
            deadLetterMaxAgeSeconds: 0,
            activeOperationLeaseCount: 0,
            maxOperationLeaseAgeSeconds: 0,
            compensationRequiredCount: 0,
            reconciliationDriftCount: 0,
          },
          thresholds: {
            commandAcceptanceSuccessRateMin: 0.99,
            commandAcceptanceP95MsMax: 1500,
            provisionReadyP95SecondsMax: 300,
            callbackMaxLagSecondsMax: 120,
            deadLetterCountMax: 0,
            deadLetterMaxAgeSecondsMax: 300,
            operationLeaseAgeSecondsMax: 180,
            compensationRequiredCountMax: 0,
            reconciliationDriftCountMax: 0,
          },
          alerts: [],
        })),
      } as any,
      cutoverService: {
        evaluate: vi.fn(async () => ({
          schemaVersion: "1.0.0" as const,
          evaluatedAt: "2026-11-12T00:00:00.000Z",
          pilotPolicy: policy,
          readyForStagingPilot: true,
          readyForCanary: false,
          readyToRemoveLegacyProvisioning: false,
          gates: [],
        })),
        recordDrill: vi.fn(async () => undefined),
      } as any,
      close: vi.fn(async () => undefined),
    };

    const app = Fastify();
    await app.register(commercialProvisioningRoutes, { prefix: "/v1", runtime });
    try {
      const mintToken = () =>
        signMachineBearerToken(
          {
            subject: "bazionweb-api",
            issuer: "bazionweb",
            audience: "bazion-platform:commercial-provisioning",
            scopes: ["commercial:provisioning:read", "commercial:provisioning:write"],
          },
          secret,
        );

      const catalogRes = await app.inject({
        method: "GET",
        url: "/v1/internal/commercial/provisioning-catalog",
        headers: { authorization: `Bearer ${mintToken()}` },
      });
      expect(catalogRes.statusCode).toBe(200);
      expect(catalogRes.json().bindings[0].offer.id).toBe("website-launch");

      const correlationId = "77777777-7777-4777-8777-777777777777";
      const acceptRes = await app.inject({
        method: "POST",
        url: "/v1/internal/commercial/provisioning-requests",
        headers: {
          authorization: `Bearer ${mintToken()}`,
          "x-correlation-id": correlationId,
        },
        payload: { correlationId },
      });
      expect(acceptRes.statusCode).toBe(202);
      expect(acceptRes.headers["x-correlation-id"]).toBe(correlationId);
      expect(telemetry.getCommandAcceptanceStats().count).toBe(1);

      const sloRes = await app.inject({
        method: "GET",
        url: "/v1/admin/platform/commercial-provisioning/slo-alerts",
        headers: { "x-correlation-id": correlationId },
      });
      expect(sloRes.statusCode).toBe(200);
      expect(sloRes.headers["x-correlation-id"]).toBe(correlationId);
      expect(sloRes.json().status).toBe("healthy");

      // Strict schema rejects PII email in commercial reconciliation feed
      const invalidRecon = await app.inject({
        method: "POST",
        url: "/v1/internal/commercial/reconciliation/report",
        headers: { authorization: `Bearer ${mintToken()}` },
        payload: {
          schemaVersion: "1.0.0",
          paidOrders: [
            {
              externalOrderId: "ord-1",
              externalCustomerId: "alice@example.com",
              offerId: "website-launch",
              offerVersion: "1.0.0",
              paymentStatus: "paid",
              paidAt: "2026-11-12T00:00:00.000Z",
              provisioningStatus: "ready",
            },
          ],
        },
      });
      expect(invalidRecon.statusCode).toBe(400);

      const drillRes = await app.inject({
        method: "POST",
        url: "/v1/admin/platform/commercial-provisioning/drills",
        payload: {
          drillType: "database_restore",
          evidenceRef: "drill-db-01",
          summary: "Restored backup in staging recovery database.",
        },
      });
      expect(drillRes.statusCode).toBe(201);
      expect(runtime.cutoverService?.recordDrill).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });

  it("paginates operations with keyset cursors and falls back to provisionerPool for hosting deployments", async () => {
    const operationQueries: Array<{ sql: string; params: unknown[] | undefined }> = [];
    const tenantUuid = "11111111-1111-4111-8111-111111111111";
    const installationUuid = "22222222-2222-4222-8222-222222222222";
    const deploymentUuid = "33333333-3333-4333-8333-333333333333";
    const page1 = Array.from({ length: 500 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      external_customer_id: "cust-pag",
      external_order_id: `ord-pag-${index + 1}`,
      offer_id: "website-launch",
      offer_version: "1.0.0",
      product_id: "bazion-site",
      product_version: "1.0.0",
      solution_id: "website",
      solution_version: "1.0.0",
      template_id: "node-nextjs",
      template_version: "1.0.0",
      status: index === 0 ? "ready" : "accepted",
      failure_code: null,
      failure_disposition: null,
      tenant_id: index === 0 ? tenantUuid : null,
      installation_id: index === 0 ? installationUuid : null,
      lease_token: null,
      lease_expires_at: null,
      accepted_at: `2026-11-12T00:00:${String(Math.floor(index / 10)).padStart(2, "0")}.000Z`,
      updated_at: "2026-11-12T00:00:00.000Z",
    }));
    const page2 = [
      {
        ...page1[0]!,
        id: "00000000-0000-4000-8000-999999999999",
        external_order_id: "ord-pag-501",
        status: "accepted",
        tenant_id: null,
        installation_id: null,
        accepted_at: "2026-11-11T23:00:00.000Z",
      },
    ];
    const allOps = [...page1, ...page2];

    const provisionerPool = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes("FROM public.product_provisioning_operations")) {
          operationQueries.push({ sql, params });
          return { rows: params && params.length === 3 ? page2 : page1, rowCount: params && params.length === 3 ? 1 : 500 };
        }
        if (sql.includes("FROM public.product_provisioning_inbox")) {
          return {
            rows: allOps.map((op) => ({ operation_id: op.id, external_order_id: op.external_order_id })),
            rowCount: allOps.length,
          };
        }
        if (
          sql.includes("FROM public.product_provisioning_status_outbox") ||
          sql.includes("FROM public.product_subscription_lifecycle_outbox")
        ) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes("FROM public.tenant_hosting_deployments")) {
          return {
            rows: [
              {
                id: deploymentUuid,
                tenant_id: tenantUuid,
                state: "failed",
                error_code: "IMAGE_PULL_FAILED",
                updated_at: "2026-11-12T00:00:00.000Z",
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }),
      connect: vi.fn(async () => ({
        query: vi.fn(async (sql: string) => {
          if (sql.includes("FROM public.product_installations")) {
            return {
              rows: [
                {
                  id: installationUuid,
                  tenant_id: tenantUuid,
                  external_order_id: "ord-pag-1",
                  distribution_mode: "dedicated",
                  status: "ready",
                  updated_at: "2026-11-12T00:00:00.000Z",
                },
              ],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        }),
        release: vi.fn(),
      })),
    };

    const tenantControlPlanePool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("FROM public.tenants")) {
          return { rows: [{ id: tenantUuid, status: "active", updated_at: "2026-11-12T00:00:00.000Z" }], rowCount: 1 };
        }
        if (sql.includes("FROM public.tenant_module_entitlements")) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes("FROM public.tenant_hosting_deployments")) {
          throw new Error("permission denied for table tenant_hosting_deployments");
        }
        return { rows: [], rowCount: 0 };
      }),
    };

    const service = new CrossEntityReconciliationService(provisionerPool as any, tenantControlPlanePool as any, []);
    const report = await service.reconcile([], "88888888-8888-4888-8888-888888888888");
    expect(operationQueries).toHaveLength(2);
    expect(operationQueries[1]!.params).toEqual([page1[499]!.accepted_at, page1[499]!.id, 500]);
    expect(report.summary.operationsChecked).toBe(501);
    expect(report.summary.deploymentsChecked).toBe(1);
    expect(report.exceptions.some((ex) => ex.id === `dedicated_hosting_drift:${installationUuid}:${deploymentUuid}`)).toBe(true);
  });
});
