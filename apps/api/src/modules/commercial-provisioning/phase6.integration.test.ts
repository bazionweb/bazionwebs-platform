import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PostgresAuditEventWriter } from "@bazion/audit";
import type {
  ProvisionProductRequestV1,
  SubscriptionLifecycleCommandV1,
} from "@bazion/api-contracts";
import {
  PostgresProvisioningSagaJournal,
  ProvisioningStepError,
  StaleSagaLeaseError,
} from "@bazion/product-installations";
import { LocalPrivateArchiveStorage } from "@bazion/storage";
import { createWebhookSignatureHeader } from "./auth.js";
import { createDefaultTenantLifecycleAdapter, SubscriptionLifecycleService } from "./lifecycle-service.js";
import { InstallationOffboardingService } from "./offboarding-service.js";
import type { ProvisioningOfferBinding } from "./offer-resolution.js";
import { CommercialProvisioningOperatorService } from "./operator-service.js";
import {
  CommercialProvisioningSagaOrchestrator,
  createDefaultProvisioningStepAdapters,
} from "./saga-orchestrator.js";
import { CommercialProvisioningService } from "./service.js";
import { PlatformLifecycleOutboxDispatcher } from "./status-outbox-worker.js";

const enabled = Boolean(
  process.env.MIGRATION_DATABASE_URL
    && process.env.PRODUCT_PROVISIONER_DATABASE_URL
    && process.env.TENANT_PROVISIONER_DATABASE_URL
    && process.env.DATABASE_URL,
);

const SHARED_OFFER: ProvisioningOfferBinding = {
  offer: { id: "website-launch", version: "2026.1.0" },
  composition: {
    product: { id: "bazion-site", version: "1.0.0" },
    solution: { id: "church-ministry", version: "1.0.0" },
    template: { id: "wordpress", version: "1.0.0" },
  },
  requiredModules: [],
  optionalModules: [],
  distributionMode: "shared-managed",
  availability: "active",
  releaseState: {
    product: "stable",
    solution: "stable",
    solutionReadiness: "buildable",
    template: "stable",
  },
};

const DEDICATED_OFFER: ProvisioningOfferBinding = {
  offer: { id: "website-business", version: "2026.1.0" },
  composition: {
    product: { id: "bazion-site", version: "1.0.0" },
    solution: { id: "church-ministry", version: "1.0.0" },
    template: { id: "node-nextjs", version: "1.0.0" },
  },
  requiredModules: [],
  optionalModules: [],
  distributionMode: "dedicated",
  availability: "active",
  releaseState: {
    product: "stable",
    solution: "stable",
    solutionReadiness: "buildable",
    template: "stable",
  },
};

function makeCommand(
  suffix: string,
  offer: ProvisioningOfferBinding,
  overrides: Partial<ProvisionProductRequestV1> = {},
): ProvisionProductRequestV1 {
  return {
    schemaVersion: "1.0.0",
    eventId: randomUUID(),
    correlationId: randomUUID(),
    idempotencyKey: `phase6-integ-${suffix}-${randomUUID().slice(0, 8)}`,
    occurredAt: new Date().toISOString(),
    source: "bazionweb",
    customer: {
      externalCustomerId: `cust-p6-${suffix}`,
      displayName: `Phase 6 Customer ${suffix}`,
      primaryContact: {
        name: `Admin ${suffix}`,
        email: `admin.${suffix.toLowerCase()}@example.org`,
      },
    },
    order: {
      externalOrderId: `INV-P6-${suffix}:line:0`,
      offerId: offer.offer.id,
      offerVersion: offer.offer.version,
    },
    composition: {
      product: { ...offer.composition.product },
      solution: { ...offer.composition.solution },
      template: { ...offer.composition.template },
    },
    ...overrides,
  };
}

async function withTenantRls<T>(
  pool: Pool,
  tenantId: string,
  fn: (client: import("pg").PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

describe.skipIf(!enabled)("Phase 6 live PostgreSQL provisioning saga, lifecycle, and offboarding archive", () => {
  let migrationPool: Pool;
  let provisionerPool: Pool;
  let platformPool: Pool;
  let auditPool: Pool;
  let archiveRoot: string;

  const createdOperationIds: string[] = [];
  const createdTenantIds: string[] = [];
  const createdInstallationIds: string[] = [];
  const createdExternalOrderIds: string[] = [];
  const createdSubscriptionIds: string[] = [];

  beforeAll(() => {
    migrationPool = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL, max: 3 });
    provisionerPool = new Pool({ connectionString: process.env.PRODUCT_PROVISIONER_DATABASE_URL, max: 5 });
    platformPool = new Pool({ connectionString: process.env.TENANT_PROVISIONER_DATABASE_URL, max: 4 });
    auditPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
    archiveRoot = mkdtempSync(join(tmpdir(), "bazion-phase6-archives-"));
  });

  afterAll(async () => {
    try {
      if (createdOperationIds.length > 0) {
        await migrationPool.query(
          `UPDATE public.product_provisioning_status_outbox
              SET status = 'delivered', delivered_at = COALESCE(delivered_at, now())
            WHERE operation_id = ANY($1::uuid[]) AND status IN ('pending', 'processing')`,
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

  it("executes all 7 shared-managed steps, records config checksums, and enforces fencing tokens", async () => {
    const suffix = randomUUID().slice(0, 8);
    const domain = `p6-${suffix}.church.test`;
    const service = new CommercialProvisioningService(provisionerPool, [SHARED_OFFER]);
    const accepted = await service.acceptCommand(
      makeCommand(suffix, SHARED_OFFER, { requestedDomain: domain }),
    );
    const opId = accepted.operation.operationId;
    createdOperationIds.push(opId);
    createdExternalOrderIds.push(accepted.operation.externalOrderId);

    const adapters = createDefaultProvisioningStepAdapters({
      provisionerPool,
      platformPool,
      hostingRuntime: null,
      offerBindings: [SHARED_OFFER],
    });
    const orchestrator = new CommercialProvisioningSagaOrchestrator(provisionerPool, adapters, {
      workerId: `worker-shared-${suffix}`,
      offerBindings: [SHARED_OFFER],
    });
    const auditWriter = new PostgresAuditEventWriter(auditPool);
    const operatorService = new CommercialProvisioningOperatorService(provisionerPool, orchestrator, auditWriter);

    const runResult = await orchestrator.runOperation(opId);
    expect(runResult.claimed).toBe(true);
    if (!runResult.claimed) throw new Error("Expected operation claim");
    expect(runResult.result.status).toBe("ready");

    const detail = await operatorService.getOperationDetail(opId);
    expect(detail.operation.status).toBe("ready");
    expect(detail.operation.tenantId).toBeTruthy();
    expect(detail.operation.installationId).toBeTruthy();

    const tenantId = detail.operation.tenantId!;
    const installationId = detail.operation.installationId!;
    createdTenantIds.push(tenantId);
    createdInstallationIds.push(installationId);

    // Every step ran in ordered succession
    expect(detail.stepAttempts.map((s) => `${s.stepName}:${s.direction}:${s.status}`)).toEqual([
      "validate_composition:forward:succeeded",
      "ensure_tenant:forward:succeeded",
      "create_installation:forward:succeeded",
      "configure_installation:forward:succeeded",
      "bind_domain:forward:succeeded",
      "provision_hosting:forward:succeeded",
      "verify_readiness:forward:succeeded",
    ]);

    // Check tenant_domains row via migrationPool
    const domainRow = await migrationPool.query<{ hostname: string; status: string }>(
      "SELECT hostname, status FROM public.tenant_domains WHERE tenant_id = $1 AND hostname = $2",
      [tenantId, domain],
    );
    expect(domainRow.rows[0]).toEqual({ hostname: domain, status: "pending" });

    // Check installation_configuration_versions v1 snapshot & checksum (RLS-scoped)
    const configRow = await withTenantRls(provisionerPool, tenantId, (client) =>
      client.query<{
        version: number;
        checksum: string;
        configuration: Record<string, unknown>;
      }>(
        `SELECT version, checksum, configuration
           FROM public.installation_configuration_versions
          WHERE tenant_id = $1 AND installation_id = $2`,
        [tenantId, installationId],
      ),
    );
    expect(configRow.rows[0]?.version).toBe(1);
    expect(configRow.rows[0]?.checksum).toMatch(/^[0-9a-f]{64}$/);

    // Enforce fencing_token monotonicity in PostgreSQL
    const journal = new PostgresProvisioningSagaJournal(provisionerPool);
    const staleClaim = await journal.claimOperation({
      operationId: opId,
      workerId: "worker-a",
      leaseDurationMs: 100,
    });
    expect(staleClaim).toBeNull(); // Terminal 'ready' operation is never re-claimed automatically

    // Direct trigger enforcement test on a fresh non-terminal operation
    const fencingOp = await service.acceptCommand(makeCommand(`${suffix}-fence`, SHARED_OFFER));
    createdOperationIds.push(fencingOp.operation.operationId);
    createdExternalOrderIds.push(fencingOp.operation.externalOrderId);

    const claim1 = await journal.claimOperation({
      operationId: fencingOp.operation.operationId,
      workerId: "worker-1",
      leaseDurationMs: 1_000,
    });
    expect(claim1).not.toBeNull();

    // Active lease prevents a competing worker from claiming
    const blockedClaim = await journal.claimOperation({
      operationId: fencingOp.operation.operationId,
      workerId: "worker-2",
      leaseDurationMs: 30_000,
    });
    expect(blockedClaim).toBeNull();

    // Once lease expires, worker-2 increments fencing_token and fences out worker-1
    await migrationPool.query(
      "UPDATE public.product_provisioning_operations SET lease_expires_at = now() - interval '1 second' WHERE id = $1",
      [fencingOp.operation.operationId],
    );
    const claim2 = await journal.claimOperation({
      operationId: fencingOp.operation.operationId,
      workerId: "worker-2",
      leaseDurationMs: 30_000,
    });
    expect(claim2).not.toBeNull();
    expect(claim2!.lease.fencingToken).toBeGreaterThan(claim1!.lease.fencingToken);

    await expect(
      journal.setStatus(fencingOp.operation.operationId, "validating", undefined, claim1!.lease),
    ).rejects.toBeInstanceOf(StaleSagaLeaseError);

    await journal.releaseLease({
      operationId: fencingOp.operation.operationId,
      lease: claim2!.lease,
    });
  });

  it("compensates failed dedicated hosting in reverse while retaining a pre-existing customer tenant", async () => {
    const suffix = randomUUID().slice(0, 8);
    const existingSlug = `existing-cust-${suffix}`;
    const existingInsert = await platformPool.query<{ id: string }>(
      `INSERT INTO public.tenants (slug, name, default_currency, status)
       VALUES ($1, $2, 'KES', 'active')
       RETURNING id::text`,
      [existingSlug, `Existing Customer ${suffix}`],
    );
    const existingTenantId = existingInsert.rows[0]!.id;
    createdTenantIds.push(existingTenantId);

    const service = new CommercialProvisioningService(
      provisionerPool,
      [DEDICATED_OFFER],
      ["shared-managed", "dedicated"],
    );
    const accepted = await service.acceptCommand(
      makeCommand(suffix, DEDICATED_OFFER, { requestedDomain: `dedicated-${suffix}.example.org` }),
    );
    const opId = accepted.operation.operationId;
    createdOperationIds.push(opId);
    createdExternalOrderIds.push(accepted.operation.externalOrderId);

    // Pre-link operation to existing customer tenant before worker runs ensure_tenant
    await migrationPool.query(
      "UPDATE public.product_provisioning_operations SET tenant_id = $2 WHERE id = $1",
      [opId, existingTenantId],
    );

    const stopCalls: string[] = [];
    const baseAdapters = createDefaultProvisioningStepAdapters({
      provisionerPool,
      platformPool,
      offerBindings: [SHARED_OFFER, DEDICATED_OFFER],
      hostingRuntime: {
        providerId: "docker-compose",
        provision: async () => ({ providerDeploymentId: `deploy-${suffix}`, status: "running" }),
        inspect: async () => ({ status: "running" }),
        stop: async ({ deploymentId }) => {
          stopCalls.push(deploymentId);
        },
      },
    });

    // Inject unknown/ambiguous failure inside provisionHosting AFTER creating deployment
    const failingOrchestrator = new CommercialProvisioningSagaOrchestrator(
      provisionerPool,
      {
        ...baseAdapters,
        async provisionHosting(args) {
          await baseAdapters.provisionHosting(args);
          throw new ProvisioningStepError("HOSTING_HEALTHCHECK_TIMED_OUT", "unknown");
        },
        async inspectHosting() {
          return {
            outcome: "completed",
            effect: {
              hosting_mode: "dedicated",
              provider_id: "docker-compose",
              hosting_ownership: "created",
              deployment_id: `deploy-${suffix}`,
            },
          };
        },
      },
      {
        workerId: `worker-dedicated-${suffix}`,
        offerBindings: [SHARED_OFFER, DEDICATED_OFFER],
      },
    );

    const auditWriter = new PostgresAuditEventWriter(auditPool);
    const operatorService = new CommercialProvisioningOperatorService(
      provisionerPool,
      failingOrchestrator,
      auditWriter,
    );

    const firstRun = await failingOrchestrator.runOperation(opId);
    expect(firstRun.claimed).toBe(true);
    if (!firstRun.claimed) throw new Error("Expected claim");
    expect(firstRun.result.status).toBe("compensation_required");

    // Trigger audited compensation via operator service
    const compensated = await operatorService.performOperatorAction({
      operationId: opId,
      action: "compensate",
      actor: { userId: `owner-${suffix}`, role: "platform_owner" },
      body: { reason: "Verified unknown hosting step and approved rollback", confirmDestructive: true },
      requestId: `req-comp-${suffix}`,
    });
    expect(compensated.operation.status).toBe("compensated");

    // Pre-existing customer tenant is RETAINED and active!
    const tenantStillActive = await migrationPool.query<{ status: string }>(
      "SELECT status FROM public.tenants WHERE id = $1",
      [existingTenantId],
    );
    expect(tenantStillActive.rows[0]?.status).toBe("active");

    // Domain binding was disabled on rollback
    const disabledDomain = await migrationPool.query<{ status: string }>(
      "SELECT status FROM public.tenant_domains WHERE tenant_id = $1",
      [existingTenantId],
    );
    expect(disabledDomain.rows[0]?.status).toBe("disabled");

    // Dedicated deployment stop was called because inspectHosting confirmed ownership
    expect(stopCalls).toEqual([`deploy-${suffix}`]);

    // Newly created installation was offboarded safely (RLS-scoped)
    if (compensated.operation.installationId) {
      createdInstallationIds.push(compensated.operation.installationId);
      const inst = await withTenantRls(provisionerPool, existingTenantId, (client) =>
        client.query<{ status: string }>(
          "SELECT status FROM public.product_installations WHERE id = $1 AND tenant_id = $2",
          [compensated.operation.installationId, existingTenantId],
        ),
      );
      expect(["offboarding", "offboarded", "deprovisioned"]).toContain(inst.rows[0]?.status);
    }
  });

  it("applies idempotent out-of-order-safe subscription lifecycle commands and signs outbox callbacks", async () => {
    const suffix = randomUUID().slice(0, 8);
    const service = new CommercialProvisioningService(provisionerPool, [SHARED_OFFER]);
    const accepted = await service.acceptCommand(makeCommand(suffix, SHARED_OFFER));
    const opId = accepted.operation.operationId;
    createdOperationIds.push(opId);
    createdExternalOrderIds.push(accepted.operation.externalOrderId);

    const adapters = createDefaultProvisioningStepAdapters({
      provisionerPool,
      platformPool,
      hostingRuntime: null,
      offerBindings: [SHARED_OFFER],
    });
    const orchestrator = new CommercialProvisioningSagaOrchestrator(provisionerPool, adapters, {
      workerId: `worker-life-${suffix}`,
      offerBindings: [SHARED_OFFER],
    });
    await orchestrator.runOperation(opId);

    const opRow = await migrationPool.query<{ tenant_id: string; installation_id: string }>(
      "SELECT tenant_id::text, installation_id::text FROM public.product_provisioning_operations WHERE id = $1",
      [opId],
    );
    const tenantId = opRow.rows[0]!.tenant_id;
    const installationId = opRow.rows[0]!.installation_id;
    createdTenantIds.push(tenantId);
    createdInstallationIds.push(installationId);

    const subscriptionId = `sub-p6-${suffix}`;
    createdSubscriptionIds.push(subscriptionId);
    const auditWriter = new PostgresAuditEventWriter(auditPool);
    const tenantAdapter = createDefaultTenantLifecycleAdapter(platformPool);
    const lifecycleService = new SubscriptionLifecycleService(provisionerPool, auditWriter, tenantAdapter);

    const t1 = new Date("2026-11-12T01:00:00.000Z").toISOString();
    const t2 = new Date("2026-11-12T02:00:00.000Z").toISOString();
    const tStale = new Date("2026-11-12T01:30:00.000Z").toISOString();
    const t3 = new Date("2026-11-12T03:00:00.000Z").toISOString();

    // 1. Grace command preserves active/ready access with grace marker
    const graceCmd: SubscriptionLifecycleCommandV1 = {
      schemaVersion: "1.0.0",
      eventId: randomUUID(),
      correlationId: randomUUID(),
      idempotencyKey: `life-grace-${suffix}`,
      occurredAt: t1,
      effectiveAt: t1,
      graceEndsAt: "2026-11-19T01:00:00.000Z",
      source: "bazionweb",
      action: "grace",
      subscriptionId,
      externalOrderId: accepted.operation.externalOrderId,
      externalCustomerId: `cust-p6-${suffix}`,
      reasonCode: "INVOICE_OVERDUE_GRACE",
    };
    const graceRes = await lifecycleService.applySignedCommand(graceCmd, {
      requestId: "req-grace-1",
      actorClientId: "bazionweb-test",
    });
    expect(graceRes).toMatchObject({ deduplicated: false, stale: false, applied: true, installationStatus: "ready" });

    // 2. Suspend reverses installation + tenant safely
    const suspendCmd: SubscriptionLifecycleCommandV1 = {
      ...graceCmd,
      eventId: randomUUID(),
      correlationId: randomUUID(),
      idempotencyKey: `life-suspend-${suffix}`,
      occurredAt: t2,
      effectiveAt: t2,
      action: "suspend",
      reasonCode: "GRACE_EXPIRED_DUNNING_EXHAUSTED",
    };
    const suspendRes = await lifecycleService.applySignedCommand(suspendCmd, {
      requestId: "req-suspend-1",
      actorClientId: "bazionweb-test",
    });
    expect(suspendRes).toMatchObject({ deduplicated: false, stale: false, applied: true, installationStatus: "suspended" });

    // Duplicate replay of exact suspend command is idempotent
    const suspendReplay = await lifecycleService.applySignedCommand(suspendCmd, {
      requestId: "req-suspend-2",
      actorClientId: "bazionweb-test",
    });
    expect(suspendReplay.deduplicated).toBe(true);

    // Out-of-order older effectiveAt is safely ignored
    const staleActivate = await lifecycleService.applySignedCommand(
      {
        ...graceCmd,
        eventId: randomUUID(),
        correlationId: randomUUID(),
        idempotencyKey: `life-stale-act-${suffix}`,
        occurredAt: tStale,
        effectiveAt: tStale,
        action: "reactivate",
        reasonCode: "STALE_EVENT",
      },
      { requestId: "req-stale", actorClientId: "bazionweb-test" },
    );
    expect(staleActivate.stale).toBe(true);
    expect(staleActivate.applied).toBe(false);

    // Tenant & installation are still suspended
    const suspendedTenant = await migrationPool.query<{ status: string }>(
      "SELECT status FROM public.tenants WHERE id = $1",
      [tenantId],
    );
    expect(suspendedTenant.rows[0]?.status).toBe("suspended");

    // 3. Newer reactivate restores active + ready cleanly
    const reactivateRes = await lifecycleService.applySignedCommand(
      {
        ...graceCmd,
        eventId: randomUUID(),
        correlationId: randomUUID(),
        idempotencyKey: `life-reactivate-${suffix}`,
        occurredAt: t3,
        effectiveAt: t3,
        action: "reactivate",
        reasonCode: "INVOICE_SETTLED",
      },
      { requestId: "req-reactivate", actorClientId: "bazionweb-test" },
    );
    expect(reactivateRes).toMatchObject({ applied: true, installationStatus: "ready" });

    const activeTenant = await migrationPool.query<{ status: string }>(
      "SELECT status FROM public.tenants WHERE id = $1",
      [tenantId],
    );
    expect(activeTenant.rows[0]?.status).toBe("active");

    // 4. Outbox dispatcher delivers signed callbacks back to Bazionweb
    const deliveredCallbacks: Array<{ body: string; signature: string }> = [];
    const dispatcher = new PlatformLifecycleOutboxDispatcher(provisionerPool, async (_url, init) => {
      const headers = init.headers as Record<string, string>;
      deliveredCallbacks.push({ body: String(init.body), signature: headers["X-Bazion-Signature"] ?? "" });
      return { status: 200, ok: true };
    });
    const signingSecret = "test-lifecycle-callback-signing-secret-32c";
    const batch = await dispatcher.processDueBatch({
      callbackUrl: "https://bazionweb.test/api/v1/webhooks/platform/lifecycle-status",
      signingSecret,
      bearerSigningSecret: signingSecret,
    });
    expect(batch.delivered).toBeGreaterThanOrEqual(4);
    const sigMatch = /^t=(\d+),v1=[0-9a-f]{64}$/.exec(deliveredCallbacks[0]!.signature);
    expect(sigMatch).not.toBeNull();
    expect(deliveredCallbacks[0]!.signature).toBe(
      createWebhookSignatureHeader(deliveredCallbacks[0]!.body, signingSecret, Number(sigMatch![1])),
    );
  });

  it("exports a 30-day offboarding archive, restores it with checksum verification, and purges after retention", async () => {
    const suffix = randomUUID().slice(0, 8);
    const service = new CommercialProvisioningService(provisionerPool, [SHARED_OFFER]);
    const accepted = await service.acceptCommand(makeCommand(suffix, SHARED_OFFER));
    const opId = accepted.operation.operationId;
    createdOperationIds.push(opId);
    createdExternalOrderIds.push(accepted.operation.externalOrderId);

    const orchestrator = new CommercialProvisioningSagaOrchestrator(
      provisionerPool,
      createDefaultProvisioningStepAdapters({
        provisionerPool,
        platformPool,
        hostingRuntime: null,
        offerBindings: [SHARED_OFFER],
      }),
      { workerId: `worker-arch-${suffix}`, offerBindings: [SHARED_OFFER] },
    );
    await orchestrator.runOperation(opId);

    const opRow = await migrationPool.query<{ tenant_id: string; installation_id: string }>(
      "SELECT tenant_id::text, installation_id::text FROM public.product_provisioning_operations WHERE id = $1",
      [opId],
    );
    const tenantId = opRow.rows[0]!.tenant_id;
    const installationId = opRow.rows[0]!.installation_id;
    createdTenantIds.push(tenantId);
    createdInstallationIds.push(installationId);

    const storage = new LocalPrivateArchiveStorage(archiveRoot);
    const auditWriter = new PostgresAuditEventWriter(auditPool);
    const offboarding = new InstallationOffboardingService(
      provisionerPool,
      storage,
      auditWriter,
      createDefaultTenantLifecycleAdapter(platformPool),
    );

    const offboarded = await offboarding.offboardInstallation({
      tenantId,
      installationId,
      actor: { userId: `owner-${suffix}`, role: "platform_owner" },
      reason: "Customer requested cancellation archival",
      confirmDestructive: true,
      requestId: `req-offboard-${suffix}`,
    });
    expect(offboarded.status).toBe("offboarding");
    expect(offboarded.archive.checksum).toMatch(/^[0-9a-f]{64}$/);
    const retentionMs =
      new Date(offboarded.archive.retentionExpiresAt).getTime() - new Date(offboarded.archive.createdAt).getTime();
    expect(Math.round(retentionMs / 86_400_000)).toBe(30);

    // Restore from archive while inside 30-day retention window
    const restored = await offboarding.restoreInstallation({
      tenantId,
      installationId,
      actor: { userId: `admin-${suffix}`, role: "platform_admin" },
      reason: "Customer renewed subscription inside recovery window",
      requestId: `req-restore-${suffix}`,
    });
    expect(restored.status).toBe("ready");

    // Re-offboard, expire retention_expires_at in DB, and run purgeExpiredArchivesForTenant
    await offboarding.offboardInstallation({
      tenantId,
      installationId,
      actor: { userId: `owner-${suffix}`, role: "platform_owner" },
      reason: "Second offboard for expiry purge verification",
      confirmDestructive: true,
      requestId: `req-offboard2-${suffix}`,
    });

    // Inside 30-day window nothing is purged
    const prematurePurge = await offboarding.purgeExpiredArchivesForTenant({
      tenantId,
      asOf: new Date(Date.now() + 10 * 86_400_000),
      actor: { userId: `owner-${suffix}`, role: "platform_owner" },
      requestId: `req-purge-early-${suffix}`,
    });
    expect(prematurePurge.archivesDeleted).toBe(0);

    // Past 30-day retention window configurations & archive file are purged safely
    const purged = await offboarding.purgeExpiredArchivesForTenant({
      tenantId,
      asOf: new Date(Date.now() + 31 * 86_400_000),
      actor: { userId: `owner-${suffix}`, role: "platform_owner" },
      requestId: `req-purge-${suffix}`,
    });
    expect(purged.archivesScanned).toBeGreaterThanOrEqual(1);
    expect(purged.archivesDeleted).toBeGreaterThanOrEqual(1);
    expect(purged.configurationsDeleted).toBeGreaterThanOrEqual(1);

    const remainingArchive = await withTenantRls(provisionerPool, tenantId, (client) =>
      client.query<{ cnt: number }>(
        `SELECT count(*)::int AS cnt
           FROM public.installation_offboarding_archives
          WHERE tenant_id = $1 AND installation_id = $2 AND archive_purged_at IS NULL`,
        [tenantId, installationId],
      ),
    );
    expect(remainingArchive.rows[0]?.cnt).toBe(0);
  });
});
