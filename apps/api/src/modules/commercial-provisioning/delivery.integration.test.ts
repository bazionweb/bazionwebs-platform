import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { provisioningStatusEventV1Schema } from "@bazion/api-contracts";
import { CommercialProvisioningError, CommercialProvisioningService } from "./service.js";
import { PlatformStatusOutboxDispatcher } from "./status-outbox-worker.js";
import { DEFAULT_CALLBACK_AUDIENCE, DEFAULT_CALLBACK_ISSUER, verifyMachineBearerToken } from "./auth.js";

const enabled = Boolean(
  process.env.MIGRATION_DATABASE_URL && process.env.PRODUCT_PROVISIONER_DATABASE_URL,
);

function buildValidRequest(suffix: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    schemaVersion: "1.0.0" as const,
    eventId: randomUUID(),
    correlationId: randomUUID(),
    idempotencyKey: `bazionweb-integ-${suffix}`,
    occurredAt: new Date().toISOString(),
    source: "bazionweb" as const,
    customer: {
      externalCustomerId: `cust-${suffix}`,
      displayName: "Phase3 Integration Org",
      primaryContact: {
        name: "Amina Otieno",
        email: "amina@integration.test",
      },
    },
    order: {
      externalOrderId: `INV-INTEG-${suffix}`,
      offerId: "website-business",
      offerVersion: "2026.1.0",
    },
    composition: {
      product: { id: "bazion-site", version: "1.0.0" },
      solution: { id: "business-website", version: "1.0.0" },
      template: { id: "node-nextjs", version: "1.0.0" },
    },
    ...overrides,
  };
}

describe.skipIf(!enabled)("PostgreSQL commercial provisioning inbox, outbox, and lease delivery", () => {
  let migrationPool: Pool;
  let provisionerPool: Pool;
  let service: CommercialProvisioningService;
  const createdOperationIds: string[] = [];

  beforeAll(async () => {
    migrationPool = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL, max: 1 });
    provisionerPool = new Pool({ connectionString: process.env.PRODUCT_PROVISIONER_DATABASE_URL, max: 3 });
    service = new CommercialProvisioningService(provisionerPool);
    await provisionerPool.query("SELECT 1");
  });

  afterAll(async () => {
    if (createdOperationIds.length > 0 && provisionerPool) {
      await provisionerPool.query(
        `UPDATE public.product_provisioning_status_outbox
            SET status = 'delivered',
                lease_token = NULL,
                lease_expires_at = NULL,
                delivered_at = COALESCE(delivered_at, now())
          WHERE operation_id = ANY($1::uuid[]) AND status <> 'delivered'`,
        [createdOperationIds],
      ).catch(() => undefined);
    }
    await provisionerPool?.end();
    await migrationPool?.end();
  });

  it("enforces least-privilege access for bazion_product_provisioner and atomic inbox+operation+outbox creation", async () => {
    const whoami = await provisionerPool.query<{ current_user: string }>("SELECT current_user");
    expect(whoami.rows[0]?.current_user).toBe("bazion_product_provisioner");

    await expect(provisionerPool.query("SELECT id FROM public.tenants LIMIT 1")).rejects.toMatchObject({ code: "42501" });
    await expect(provisionerPool.query("DELETE FROM public.product_provisioning_status_outbox WHERE false")).rejects.toMatchObject({ code: "42501" });

    const req = buildValidRequest(randomUUID().slice(0, 8));
    const first = await service.acceptCommand(req);
    createdOperationIds.push(first.operation.operationId);

    expect(first.deduplicated).toBe(false);
    expect(first.operation.status).toBe("accepted");
    expect(first.operation.externalOrderId).toBe(req.order.externalOrderId);

    const outbox = await provisionerPool.query<{
      status: string;
      status_snapshot: string;
      payload: Record<string, unknown>;
    }>(
      "SELECT status, status_snapshot, payload FROM public.product_provisioning_status_outbox WHERE operation_id = $1",
      [first.operation.operationId],
    );
    expect(outbox.rows).toHaveLength(1);
    expect(outbox.rows[0]?.status).toBe("pending");
    expect(outbox.rows[0]?.status_snapshot).toBe("accepted");
    const parsedEvent = provisioningStatusEventV1Schema.parse(outbox.rows[0]?.payload);
    expect(parsedEvent.operation.operationId).toBe(first.operation.operationId);

    // Exact duplicate delivery deduplicates cleanly and does not add duplicate outbox events.
    const replay = await service.acceptCommand({ ...req });
    expect(replay.deduplicated).toBe(true);
    expect(replay.operation.operationId).toBe(first.operation.operationId);

    const contactOnlyReplay = await service.acceptCommand({
      ...req,
      customer: {
        ...req.customer,
        displayName: "Updated display name",
        primaryContact: { name: "Updated contact", email: "updated@integration.test" },
      },
    });
    expect(contactOnlyReplay.deduplicated).toBe(true);
    expect(contactOnlyReplay.operation.operationId).toBe(first.operation.operationId);

    await expect(service.acceptCommand({ ...req, eventId: randomUUID() }))
      .rejects.toMatchObject({ statusCode: 409, code: "PROVISIONING_IDEMPOTENCY_CONFLICT" });
    await expect(service.acceptCommand({ ...req, correlationId: randomUUID() }))
      .rejects.toMatchObject({ statusCode: 409, code: "PROVISIONING_IDEMPOTENCY_CONFLICT" });

    const inboxCount = await provisionerPool.query<{ received_count: number }>(
      "SELECT received_count FROM public.product_provisioning_inbox WHERE operation_id = $1",
      [first.operation.operationId],
    );
    expect(inboxCount.rows[0]?.received_count).toBe(3);

    const outboxAfterDuplicate = await provisionerPool.query<{ cnt: number }>(
      "SELECT count(*)::int AS cnt FROM public.product_provisioning_status_outbox WHERE operation_id = $1",
      [first.operation.operationId],
    );
    expect(outboxAfterDuplicate.rows[0]?.cnt).toBe(1);
  });

  it("rejects mismatched request fingerprints on the same idempotency key with 409 conflict", async () => {
    const suffix = randomUUID().slice(0, 8);
    const req = buildValidRequest(suffix);
    const accepted = await service.acceptCommand(req);
    createdOperationIds.push(accepted.operation.operationId);

    await expect(
      service.acceptCommand({
        ...req,
        eventId: randomUUID(),
        order: { ...req.order, offerId: "website-enterprise" },
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "PROVISIONING_IDEMPOTENCY_CONFLICT",
    });
  });

  it("rejects service transitions that the database state machine would reject", async () => {
    const req = buildValidRequest(randomUUID().slice(0, 8));
    const accepted = await service.acceptCommand(req);
    createdOperationIds.push(accepted.operation.operationId);

    await expect(service.transitionOperation({
      operationId: accepted.operation.operationId,
      nextStatus: "provisioning_tenant",
    })).rejects.toMatchObject({ code: "INVALID_OPERATION_TRANSITION" });
    await expect(service.transitionOperation({
      operationId: accepted.operation.operationId,
      nextStatus: "failed",
    })).rejects.toMatchObject({ code: "FAILURE_DETAILS_REQUIRED" });

    const validating = await service.transitionOperation({
      operationId: accepted.operation.operationId,
      nextStatus: "validating",
      currentStep: "validate_entitlements",
    });
    expect(validating.status).toBe("validating");

    const compensationRequired = await service.transitionOperation({
      operationId: accepted.operation.operationId,
      nextStatus: "compensation_required",
      currentStep: "inspect_unknown_effect",
      failure: { code: "PROVIDER_OUTCOME_UNKNOWN", retryable: true, disposition: "unknown" },
    });
    expect(compensationRequired).toMatchObject({
      status: "compensation_required",
      failure: { code: "PROVIDER_OUTCOME_UNKNOWN", retryable: true },
    });
  });

  it("does not replay active leases and bounds retries after a worker crash", async () => {
    const req = buildValidRequest(randomUUID().slice(0, 8));
    const accepted = await service.acceptCommand(req);
    createdOperationIds.push(accepted.operation.operationId);
    const outbox = await provisionerPool.query<{ id: string }>(
      "SELECT id::text FROM public.product_provisioning_status_outbox WHERE operation_id = $1",
      [accepted.operation.operationId],
    );
    const outboxId = outbox.rows[0]!.id;
    const leaseToken = randomUUID();

    await provisionerPool.query(
      `UPDATE public.product_provisioning_status_outbox
          SET status = 'delivered', delivered_at = now()
        WHERE id <> $1 AND status = 'pending'`,
      [outboxId],
    );
    await provisionerPool.query(
      `UPDATE public.product_provisioning_status_outbox
          SET status = 'processing', attempt_count = 1, max_attempts = 1,
              lease_token = $2, lease_expires_at = now() + interval '5 minutes'
        WHERE id = $1`,
      [outboxId, leaseToken],
    );

    const dispatcher = new PlatformStatusOutboxDispatcher(provisionerPool, async () => {
      throw new Error("An exhausted callback must not be sent again.");
    });
    await expect(dispatcher.replayOutboxEntry(outboxId)).resolves.toBeNull();

    await provisionerPool.query(
      "UPDATE public.product_provisioning_status_outbox SET lease_expires_at = now() - interval '1 second' WHERE id = $1",
      [outboxId],
    );
    const result = await dispatcher.processDueBatch({
      callbackUrl: "https://commercial.example.test/api/v1/webhooks/platform/provisioning-status",
      signingSecret: "integration-callback-signing-secret-32chars",
      batchSize: 10,
    });

    expect(result).toMatchObject({ claimed: 0, deadLettered: 1 });
    const state = await provisionerPool.query<{ status: string; last_error_code: string }>(
      "SELECT status, last_error_code FROM public.product_provisioning_status_outbox WHERE id = $1",
      [outboxId],
    );
    expect(state.rows[0]).toEqual({ status: "dead", last_error_code: "CALLBACK_LEASE_EXHAUSTED" });
  });

  it("retries signed callbacks through downtime, dead-letters exhausted deliveries, and supports replay and reconciliation", async () => {
    const suffix = randomUUID().slice(0, 8);
    const req = buildValidRequest(suffix);
    const accepted = await service.acceptCommand(req);
    createdOperationIds.push(accepted.operation.operationId);

    // Transition operation inside a separate transaction -> triggers 2nd outbox item.
    const transitioned = await service.transitionOperation({
      operationId: accepted.operation.operationId,
      nextStatus: "validating",
      currentStep: "validate_entitlements",
    });
    expect(transitioned.status).toBe("validating");

    // Set max_attempts = 2 on one outbox row to exercise retry -> dead-letter -> manual replay.
    const outboxRows = await provisionerPool.query<{ id: string }>(
      "SELECT id::text FROM public.product_provisioning_status_outbox WHERE operation_id = $1 ORDER BY created_at ASC",
      [accepted.operation.operationId],
    );
    expect(outboxRows.rows).toHaveLength(2);
    const firstOutboxId = outboxRows.rows[0]!.id;
    const secondOutboxId = outboxRows.rows[1]!.id;

    // Limit scope of this dispatcher test by postponing other unrelated rows and setting max_attempts = 2 on firstOutboxId.
    await provisionerPool.query(
      "UPDATE public.product_provisioning_status_outbox SET max_attempts = 2 WHERE id = $1",
      [firstOutboxId],
    );
    await provisionerPool.query(
      "UPDATE public.product_provisioning_status_outbox SET status = 'delivered', delivered_at = now() WHERE id = $1",
      [secondOutboxId],
    );

    const callbackSecret = "integration-callback-signing-secret-32chars";
    const bearerSecret = "integration-callback-bearer-secret-32chars";
    const deliveredPayloads: Array<{ body: string; headers: Record<string, string>; redirect: RequestRedirect | undefined }> = [];
    let targetAttempts = 0;

    // Retire any unrelated older pending test outbox rows so batch processing deterministically hits firstOutboxId.
    await provisionerPool.query(
      "UPDATE public.product_provisioning_status_outbox SET status = 'delivered', delivered_at = COALESCE(delivered_at, now()) WHERE id <> $1 AND status = 'pending'",
      [firstOutboxId],
    );

    const dispatcher = new PlatformStatusOutboxDispatcher(
      provisionerPool,
      async (_url, init) => {
        const parsed = JSON.parse(String(init.body ?? "{}")) as { operation?: { operationId?: string } };
        if (parsed.operation?.operationId === accepted.operation.operationId) {
          targetAttempts += 1;
          if (targetAttempts <= 2) {
            return { status: 503, ok: false };
          }
          deliveredPayloads.push({
            body: String(init.body ?? ""),
            headers: (init.headers ?? {}) as Record<string, string>,
            redirect: init.redirect,
          });
        }
        return { status: 202, ok: true };
      },
      () => 0,
    );

    // Attempt 1 -> 503 retryable -> back to pending with attempt_count = 1
    const attempt1 = await dispatcher.processDueBatch({
      callbackUrl: "https://commercial.example.test/api/v1/webhooks/platform/provisioning-status",
      signingSecret: callbackSecret,
      bearerSigningSecret: bearerSecret,
      batchSize: 20,
      retryBaseSeconds: 10,
      retryMaxSeconds: 60,
    });
    expect(attempt1.retried).toBeGreaterThanOrEqual(1);

    // Force immediate due time for attempt 2 without sleeping
    await provisionerPool.query(
      "UPDATE public.product_provisioning_status_outbox SET next_attempt_at = now() - interval '1 second' WHERE id = $1",
      [firstOutboxId],
    );

    // Attempt 2 -> 503 -> max_attempts=2 reached -> dead-lettered
    const attempt2 = await dispatcher.processDueBatch({
      callbackUrl: "https://commercial.example.test/api/v1/webhooks/platform/provisioning-status",
      signingSecret: callbackSecret,
      bearerSigningSecret: bearerSecret,
      batchSize: 20,
    });
    expect(attempt2.deadLettered).toBeGreaterThanOrEqual(1);

    const recon = await service.reconcile(1);
    expect(recon.counts.deadOutbox).toBeGreaterThanOrEqual(1);
    expect(recon.deadOutboxItems.some((item) => item.outboxId === firstOutboxId)).toBe(true);

    // Operator replay
    const replayed = await dispatcher.replayOutboxEntry(firstOutboxId);
    expect(replayed).toMatchObject({ outboxId: firstOutboxId, status: "pending" });

    // Attempt 3 -> 202 delivered + verify HMAC & JWT signature
    const attempt3 = await dispatcher.processDueBatch({
      callbackUrl: "https://commercial.example.test/api/v1/webhooks/platform/provisioning-status",
      signingSecret: callbackSecret,
      bearerSigningSecret: bearerSecret,
      batchSize: 20,
    });
    expect(attempt3.delivered).toBeGreaterThanOrEqual(1);
    expect(deliveredPayloads).toHaveLength(1);

    const captured = deliveredPayloads[0]!;
    expect(captured.redirect).toBe("error");
    const sigMatch = /^t=(\d+),v1=([a-f0-9]{64})$/.exec(captured.headers["X-Bazion-Signature"] ?? "");
    expect(sigMatch).not.toBeNull();
    const expectedDigest = createHmac("sha256", callbackSecret)
      .update(`${sigMatch![1]}.${captured.body}`)
      .digest("hex");
    expect(sigMatch![2]).toBe(expectedDigest);

    const claims = verifyMachineBearerToken(
      { authorization: captured.headers.Authorization },
      {
        secret: bearerSecret,
        expectedIssuer: DEFAULT_CALLBACK_ISSUER,
        expectedAudience: DEFAULT_CALLBACK_AUDIENCE,
        requiredScopes: ["provisioning:status:write"],
      },
    );
    expect(claims.sub).toBe("bazion-platform-status-dispatcher");

    const parsedWire = provisioningStatusEventV1Schema.parse(JSON.parse(captured.body));
    expect(parsedWire.operation.operationId).toBe(accepted.operation.operationId);

    const finalState = await provisionerPool.query<{ status: string }>(
      "SELECT status FROM public.product_provisioning_status_outbox WHERE id = $1",
      [firstOutboxId],
    );
    expect(finalState.rows[0]?.status).toBe("delivered");
  });
});
