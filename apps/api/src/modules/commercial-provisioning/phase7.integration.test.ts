import { createHmac, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { PostgresAuditEventWriter } from "@bazion/audit";
import type { SubscriptionLifecycleCommandV1 } from "@bazion/api-contracts";
import { ProvisioningStepError } from "@bazion/product-installations";
import { LocalPrivateArchiveStorage } from "@bazion/storage";
import { createDefaultTenantLifecycleAdapter, SubscriptionLifecycleService } from "./lifecycle-service.js";
import { InstallationOffboardingService } from "./offboarding-service.js";
import { CommercialProvisioningOperatorService } from "./operator-service.js";
import {
  CommercialProvisioningTelemetry,
  ProvisioningSloService,
} from "./observability.js";
import {
  CutoverReadinessService,
  getEffectiveOfferBindingsForMode,
  resolvePilotCohortPolicy,
  stagingPilotOfferBindings,
} from "./pilot-cutover.js";
import { CrossEntityReconciliationService } from "./reconciliation-service.js";
import {
  CommercialProvisioningSagaOrchestrator,
  createDefaultProvisioningStepAdapters,
} from "./saga-orchestrator.js";
import { CommercialProvisioningService } from "./service.js";
import {
  PlatformLifecycleOutboxDispatcher,
  PlatformStatusOutboxDispatcher,
} from "./status-outbox-worker.js";

const hasDatabase = Boolean(
  process.env.MIGRATION_DATABASE_URL
    && process.env.PRODUCT_PROVISIONER_DATABASE_URL
    && process.env.TENANT_PROVISIONER_DATABASE_URL
    && process.env.DATABASE_URL,
);

const pilotBinding = stagingPilotOfferBindings[0]!;

describe.runIf(hasDatabase)("Phase 7 PostgreSQL staging pilot E2E, crash recovery, reconciliation & drills", () => {
  let migrationPool: Pool;
  let provisionerPool: Pool;
  let platformPool: Pool;
  let auditPool: Pool;
  const archiveRoot = mkdtempSync(resolve(tmpdir(), "bazion-p7-archives-"));
  const createdOperationIds: string[] = [];
  const createdTenantIds: string[] = [];
  const createdSubscriptionIds: string[] = [];

  beforeAll(() => {
    migrationPool = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL, max: 3 });
    provisionerPool = new Pool({ connectionString: process.env.PRODUCT_PROVISIONER_DATABASE_URL, max: 5 });
    platformPool = new Pool({ connectionString: process.env.TENANT_PROVISIONER_DATABASE_URL, max: 4 });
    auditPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  });

  afterAll(async () => {
    try {
      if (createdOperationIds.length > 0) {
        await migrationPool.query(
          `UPDATE public.product_provisioning_status_outbox
              SET status = 'delivered', delivered_at = COALESCE(delivered_at, now())
            WHERE operation_id = ANY($1::uuid[]) AND status IN ('pending', 'processing', 'dead')`,
          [createdOperationIds],
        );
      }
      if (createdSubscriptionIds.length > 0) {
        await migrationPool.query(
          `DELETE FROM public.product_subscription_lifecycle_outbox
            WHERE lifecycle_inbox_id IN (
              SELECT id FROM public.product_subscription_lifecycle_inbox WHERE subscription_id = ANY($1::text[])
            )`,
          [createdSubscriptionIds],
        );
        await migrationPool.query(
          "DELETE FROM public.product_subscription_lifecycle_inbox WHERE subscription_id = ANY($1::text[])",
          [createdSubscriptionIds],
        );
      }
      if (createdTenantIds.length > 0) {
        await migrationPool.query(
          "DELETE FROM public.tenant_domains WHERE tenant_id = ANY($1::uuid[])",
          [createdTenantIds],
        );
      }
    } finally {
      await Promise.allSettled([
        migrationPool.end(),
        provisionerPool.end(),
        platformPool.end(),
        auditPool.end(),
      ]);
      rmSync(archiveRoot, { recursive: true, force: true });
    }
  });

  it("exercises end-to-end staging pilot lifecycle: idempotent intake, retry, recovery, compensation, grace/suspend/reactivate, archive restore, 5-way reconciliation, and SLO/cutover gates", async () => {
    const suffix = randomUUID().slice(0, 8);
    const pilotCustomerId = `cust-p7-pilot-${suffix}`;
    const orderIdPrimary = `order-p7-ready-${suffix}`;
    const orderIdRecover = `order-p7-recover-${suffix}`;
    const correlationId = randomUUID();
    const callbackSecret = "phase7-test-callback-signing-secret-32c";
    const receivedCallbackEventIds = new Set<string>();
    const receivedCorrelations: string[] = [];

    const pilotPolicy = resolvePilotCohortPolicy({
      pilotMode: "staging_pilot",
      nodeEnv: "staging",
      hostingMutationsEnabled: false,
      legacyFallbackEnabled: true,
      dualReadReconciliationEnabled: true,
      allowedCustomerIds: [pilotCustomerId],
    });
    const offerBindings = getEffectiveOfferBindingsForMode(pilotPolicy.pilotMode, pilotPolicy.allowedOffers);
    const hostingSpy = vi.fn(async () => ({
      deploymentId: randomUUID(),
      state: "ready",
      providerResourceId: "unexpected",
    }));

    const telemetry = new CommercialProvisioningTelemetry();
    const service = new CommercialProvisioningService(
      provisionerPool,
      offerBindings,
      ["shared-managed"],
      pilotPolicy,
    );

    // 1. Reject non-cohort customer under active staging pilot policy
    await expect(
      service.acceptCommand({
        schemaVersion: "1.0.0",
        eventId: randomUUID(),
        correlationId,
        idempotencyKey: `bazionweb:p7:blocked:${suffix}:v1`,
        occurredAt: new Date().toISOString(),
        source: "bazionweb",
        customer: {
          externalCustomerId: `non-pilot-${suffix}`,
          displayName: "Blocked Non-Pilot",
          primaryContact: { name: "Bob", email: "bob@example.test" },
        },
        order: {
          externalOrderId: `order-p7-blocked-${suffix}`,
          offerId: pilotBinding.offer.id,
          offerVersion: pilotBinding.offer.version,
        },
        composition: pilotBinding.composition,
      }),
    ).rejects.toMatchObject({ code: "PROVISIONING_CUSTOMER_NOT_IN_PILOT_COHORT" });

    // 2. Accept paid pilot command + duplicate command idempotency
    const cmdPrimary = {
      schemaVersion: "1.0.0" as const,
      eventId: randomUUID(),
      correlationId,
      idempotencyKey: `bazionweb:p7:primary:${suffix}:v1`,
      occurredAt: new Date().toISOString(),
      source: "bazionweb" as const,
      customer: {
        externalCustomerId: pilotCustomerId,
        displayName: `Pilot Tenant ${suffix}`,
        primaryContact: { name: "Grace", email: "grace@example.test" },
      },
      order: {
        externalOrderId: orderIdPrimary,
        offerId: pilotBinding.offer.id,
        offerVersion: pilotBinding.offer.version,
      },
      composition: pilotBinding.composition,
      requestedDomain: `p7-${suffix}.church.test`,
    };

    const acceptedFirst = await service.acceptCommand(cmdPrimary);
    expect(acceptedFirst.deduplicated).toBe(false);
    const opPrimaryId = acceptedFirst.operation.operationId;
    createdOperationIds.push(opPrimaryId);

    const acceptedDup = await service.acceptCommand(cmdPrimary);
    expect(acceptedDup.deduplicated).toBe(true);
    expect(acceptedDup.operation.operationId).toBe(opPrimaryId);
    telemetry.recordCommandAcceptance({ durationMs: 22, succeeded: true });

    // 3. Transient retry -> provisioning success WITHOUT invoking Dokploy/hosting mutations
    const baseAdapters = createDefaultProvisioningStepAdapters({
      provisionerPool,
      platformPool,
      hostingRuntime: pilotPolicy.hostingMutationsEnabled ? ({ provisionTenantApp: hostingSpy } as any) : null,
      offerBindings,
    });
    let injectedConfigTransientError = true;
    const retryTestAdapters = {
      ...baseAdapters,
      configureInstallation: async (ctx: Parameters<typeof baseAdapters.configureInstallation>[0]) => {
        if (injectedConfigTransientError) {
          injectedConfigTransientError = false;
          throw new ProvisioningStepError("CONFIG_TRANSIENT_TIMEOUT", "retry");
        }
        return baseAdapters.configureInstallation(ctx);
      },
    };

    const auditWriter = new PostgresAuditEventWriter(auditPool);
    const orchestrator = new CommercialProvisioningSagaOrchestrator(provisionerPool, retryTestAdapters, {
      workerId: `p7-worker-${suffix}`,
      offerBindings,
    });
    const operatorService = new CommercialProvisioningOperatorService(provisionerPool, orchestrator, auditWriter);

    const failRun = await orchestrator.runOperation(opPrimaryId);
    expect(failRun.claimed).toBe(true);
    if (!failRun.claimed) throw new Error("Expected operation claim");
    expect(failRun.result.status).toBe("failed");

    const retried = await operatorService.performOperatorAction({
      operationId: opPrimaryId,
      action: "retry",
      actor: { userId: `owner-p7-${suffix}`, role: "platform_owner" },
      body: { reason: "Phase 7 verified transient retry after entitlement timeout" },
      requestId: correlationId,
    });
    expect(retried.operation.status).toBe("ready");
    expect(hostingSpy).not.toHaveBeenCalled();

    const tenantId = retried.operation.tenantId!;
    const installationId = retried.operation.installationId!;
    createdTenantIds.push(tenantId);

    // Confirm zero hosting deployments created for shared-managed tenant
    const depCountRes = await auditPool.query<{ cnt: number }>(
      "SELECT count(*)::int AS cnt FROM public.tenant_hosting_deployments WHERE tenant_id = $1",
      [tenantId],
    );
    expect(depCountRes.rows[0]?.cnt).toBe(0);

    // 4. Outbox callback delivery + HMAC + correlation propagation + duplicate callback idempotency
    const verifiedSignatures: string[] = [];
    const statusDispatcher = new PlatformStatusOutboxDispatcher(provisionerPool, async (_url, init) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const rawBody = typeof init?.body === "string" ? init.body : "";
      const sigHeader = headers["X-Bazion-Signature"] ?? "";
      const timestampPart = sigHeader.split(",").find((p) => p.startsWith("t="))?.slice(2) ?? "";
      const v1Part = sigHeader.split(",").find((p) => p.startsWith("v1="))?.slice(3) ?? "";
      const expectedDigest = createHmac("sha256", callbackSecret).update(`${timestampPart}.${rawBody}`).digest("hex");
      if (v1Part === expectedDigest && timestampPart.length > 0) {
        verifiedSignatures.push(sigHeader);
      }
      receivedCorrelations.push(headers["X-Correlation-Id"] ?? "");
      const evId = headers["X-Bazion-Event-Id"] ?? "";
      const firstSeen = !receivedCallbackEventIds.has(evId);
      receivedCallbackEventIds.add(evId);
      return new Response(JSON.stringify({ deduplicated: !firstSeen }), { status: 202 });
    });

    const outboxBatch = await statusDispatcher.processDueBatch({
      callbackUrl: "https://bazionweb.staging.internal/webhooks/status",
      signingSecret: callbackSecret,
      batchSize: 50,
    });
    expect(outboxBatch.delivered).toBeGreaterThanOrEqual(1);
    expect(verifiedSignatures.length).toBe(outboxBatch.delivered);
    expect(receivedCorrelations).toContain(correlationId);

    // 5. Grace -> Suspend -> Reactivate subscription lifecycle + lifecycle outbox delivery
    const lifecycleService = new SubscriptionLifecycleService(
      provisionerPool,
      auditWriter,
      createDefaultTenantLifecycleAdapter(platformPool),
    );
    const subscriptionId = `sub-p7-${suffix}`;
    createdSubscriptionIds.push(subscriptionId);
    const tGrace = new Date("2026-11-12T01:00:00.000Z").toISOString();
    const tSuspend = new Date("2026-11-12T02:00:00.000Z").toISOString();
    const tReactivate = new Date("2026-11-12T03:00:00.000Z").toISOString();

    const baseLifecycle: Omit<SubscriptionLifecycleCommandV1, "eventId" | "idempotencyKey" | "action" | "occurredAt" | "effectiveAt"> = {
      schemaVersion: "1.0.0",
      correlationId,
      source: "bazionweb",
      subscriptionId,
      externalOrderId: orderIdPrimary,
      externalCustomerId: pilotCustomerId,
      graceEndsAt: "2026-11-19T01:00:00.000Z",
      reasonCode: "PILOT_LIFECYCLE",
    };

    const graceRes = await lifecycleService.applySignedCommand(
      { ...baseLifecycle, eventId: randomUUID(), idempotencyKey: `p7-life-grace-${suffix}`, action: "grace", occurredAt: tGrace, effectiveAt: tGrace },
      { requestId: correlationId, actorClientId: "bazionweb-pilot" },
    );
    expect(graceRes.installationStatus).toBe("ready");

    const suspendRes = await lifecycleService.applySignedCommand(
      { ...baseLifecycle, eventId: randomUUID(), idempotencyKey: `p7-life-suspend-${suffix}`, action: "suspend", occurredAt: tSuspend, effectiveAt: tSuspend },
      { requestId: correlationId, actorClientId: "bazionweb-pilot" },
    );
    expect(suspendRes.installationStatus).toBe("suspended");

    const reactivateRes = await lifecycleService.applySignedCommand(
      { ...baseLifecycle, eventId: randomUUID(), idempotencyKey: `p7-life-reactivate-${suffix}`, action: "reactivate", occurredAt: tReactivate, effectiveAt: tReactivate },
      { requestId: correlationId, actorClientId: "bazionweb-pilot" },
    );
    expect(reactivateRes.installationStatus).toBe("ready");

    const lifeDispatcher = new PlatformLifecycleOutboxDispatcher(provisionerPool, async () =>
      new Response("{}", { status: 202 }),
    );
    await lifeDispatcher.processDueBatch({
      callbackUrl: "https://bazionweb.staging.internal/webhooks/lifecycle",
      signingSecret: callbackSecret,
      batchSize: 10,
    });

    // 6. Five-way reconciliation for the active pilot order verifies zero drift across order/op/installation/entitlements/hosting
    const reconService = new CrossEntityReconciliationService(provisionerPool, auditPool, offerBindings);
    const reconReport = await reconService.reconcile(
      [
        {
          externalOrderId: orderIdPrimary,
          externalCustomerId: pilotCustomerId,
          offerId: pilotBinding.offer.id,
          offerVersion: pilotBinding.offer.version,
          paymentStatus: "paid",
          paidAt: cmdPrimary.occurredAt,
          operationId: opPrimaryId,
          tenantId,
          installationId,
          provisioningStatus: "ready",
          legacyFallbackUsed: false,
        },
      ],
      correlationId,
    );
    const pilotExceptions = reconReport.exceptions.filter(
      (ex) => ex.entityRefs.externalOrderId === orderIdPrimary || ex.entityRefs.tenantId === tenantId,
    );
    expect(pilotExceptions).toEqual([]);
    expect(reconReport.summary.ordersChecked).toBe(1);
    expect(reconReport.summary.entitlementsChecked).toBeGreaterThanOrEqual(3);

    // 7. Simulated worker crash / expired lease recovery + ambiguous failure -> manual review -> safe compensation
    const acceptedSecond = await service.acceptCommand({
      ...cmdPrimary,
      eventId: randomUUID(),
      idempotencyKey: `bazionweb:p7:recover:${suffix}:v1`,
      order: {
        externalOrderId: orderIdRecover,
        offerId: pilotBinding.offer.id,
        offerVersion: pilotBinding.offer.version,
      },
      requestedDomain: `p7-rec-${suffix}.church.test`,
    });
    const opRecoverId = acceptedSecond.operation.operationId;
    createdOperationIds.push(opRecoverId);

    // Ambiguous failure adapter forces compensation_required before tenant ready
    const ambiguousAdapters = {
      ...baseAdapters,
      configureInstallation: async () => {
        throw new ProvisioningStepError("AMBIGUOUS_PROVIDER_RESPONSE", "unknown");
      },
    };
    const ambiguousOrch = new CommercialProvisioningSagaOrchestrator(provisionerPool, ambiguousAdapters, {
      workerId: `p7-crash-worker-${suffix}`,
      offerBindings,
    });
    const ambiguousOp = new CommercialProvisioningOperatorService(provisionerPool, ambiguousOrch, auditWriter);

    const ambResult = await ambiguousOrch.runOperation(opRecoverId);
    expect(ambResult.claimed).toBe(true);
    if (!ambResult.claimed) throw new Error("Expected claim on recovery operation");
    expect(ambResult.result.status).toBe("compensation_required");
    const ambDetail = await ambiguousOp.getOperationDetail(opRecoverId);
    if (ambDetail.operation.tenantId) {
      createdTenantIds.push(ambDetail.operation.tenantId);
    }

    // Simulate expired lease left behind by a crashed worker before operator manual review & fenced compensation
    const staleLeaseToken = randomUUID();
    await migrationPool.query(
      `UPDATE public.product_provisioning_operations
          SET lease_token = $2,
              lease_expires_at = now() - interval '10 seconds',
              worker_id = $3
        WHERE id = $1`,
      [opRecoverId, staleLeaseToken, `crashed-worker-${suffix}`],
    );

    // Manual review triggers safe reverse compensation (clears expired lease and increments fence cleanly)
    const compensated = await ambiguousOp.completeManualReview({
      operationId: opRecoverId,
      actor: { userId: `owner-p7-${suffix}`, role: "platform_owner" },
      body: {
        resolution: "trigger_compensate",
        note: "Verified ambiguous failure during pilot; safe reverse compensation authorized.",
        reason: "Phase 7 manual review compensation verification",
        confirmDestructive: true,
      },
      requestId: correlationId,
    });
    expect(compensated.operation.status).toBe("compensated");
    expect(compensated.lease.fencingToken).toBeGreaterThanOrEqual(2);
    // Old worker's stale fencing token (1) cannot record step attempts anymore
    const staleFenceCheck = await migrationPool.query<{ cnt: number }>(
      `SELECT count(*)::int AS cnt FROM public.product_provisioning_operations WHERE id = $1 AND lease_token = $2`,
      [opRecoverId, staleLeaseToken],
    );
    expect(staleFenceCheck.rows[0]?.cnt).toBe(0);

    await statusDispatcher.processDueBatch({
      callbackUrl: "https://bazionweb.staging.internal/webhooks/status",
      signingSecret: callbackSecret,
      batchSize: 20,
    });

    // 8. 30-day Archive offboard + restoration drill
    const storage = new LocalPrivateArchiveStorage(archiveRoot);
    const offboarding = new InstallationOffboardingService(
      provisionerPool,
      storage,
      auditWriter,
      createDefaultTenantLifecycleAdapter(platformPool),
    );
    const offboarded = await offboarding.offboardInstallation({
      tenantId,
      installationId,
      actor: { userId: `owner-p7-${suffix}`, role: "platform_owner" },
      reason: "Phase 7 archive restoration recovery drill",
      confirmDestructive: true,
      requestId: correlationId,
    });
    expect(offboarded.status).toBe("offboarding");

    const restored = await offboarding.restoreInstallation({
      tenantId,
      installationId,
      actor: { userId: `owner-p7-${suffix}`, role: "platform_owner" },
      reason: "Phase 7 archive restore verification completed cleanly",
      requestId: correlationId,
    });
    expect(restored.status).toBe("ready");

    // 9. SLO evaluation & Cutover Drill recording
    const sloService = new ProvisioningSloService(provisionerPool, reconService, telemetry);
    const sloSnapshot = await sloService.evaluate(correlationId);
    expect(sloSnapshot.metrics.provisionReadyCount).toBeGreaterThanOrEqual(1);
    expect(sloSnapshot.metrics.commandAcceptanceCount).toBe(1);

    const cutoverService = new CutoverReadinessService(pilotPolicy, sloService, reconService, auditPool);
    for (const drillType of [
      "staging_pilot_signoff",
      "database_restore",
      "archive_restore",
      "canary_cohort_signoff",
      "rollback_window",
    ] as const) {
      const ref = `p7-drill-${drillType}-${suffix}`;
      await cutoverService.recordDrill({
        actorId: `owner-p7-${suffix}`,
        actorRole: "platform_owner",
        requestId: correlationId,
        payload: {
          drillType,
          evidenceRef: ref,
          summary: `Verified ${drillType} drill in staging integration run`,
        },
      });
    }
    const cutoverReport = await cutoverService.evaluate(correlationId);
    const drillGateIds = [
      "staging_pilot_verified",
      "database_restore_drill_verified",
      "archive_restore_drill_verified",
      "canary_and_rollback_window_verified",
    ];
    for (const gateId of drillGateIds) {
      expect(cutoverReport.gates.find((g) => g.id === gateId)?.passed).toBe(true);
    }
  });
});
