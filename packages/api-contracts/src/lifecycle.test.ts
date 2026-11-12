import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  provisioningManualReviewRequestSchema,
  provisioningOperationDetailV1Schema,
  subscriptionLifecycleCommandV1Schema,
  subscriptionLifecycleStatusEventV1Schema,
} from "./index.js";

describe("Phase 6 lifecycle & saga contracts", () => {
  it("validates versioned subscription lifecycle commands and requires graceEndsAt for grace actions", () => {
    const valid = subscriptionLifecycleCommandV1Schema.safeParse({
      schemaVersion: "1.0.0",
      eventId: randomUUID(),
      correlationId: randomUUID(),
      idempotencyKey: `sub-lifecycle:${randomUUID()}`,
      occurredAt: "2026-11-12T04:00:00.000Z",
      effectiveAt: "2026-11-12T04:00:00.000Z",
      source: "bazionweb",
      action: "grace",
      subscriptionId: "sub_12345",
      externalCustomerId: "cust_123",
      externalOrderId: "order_456",
      reasonCode: "INVOICE_OVERDUE_GRACE",
      graceEndsAt: "2026-11-19T04:00:00.000Z",
    });
    expect(valid.success).toBe(true);

    const missingGraceEnd = subscriptionLifecycleCommandV1Schema.safeParse({
      schemaVersion: "1.0.0",
      eventId: randomUUID(),
      correlationId: randomUUID(),
      idempotencyKey: `sub-lifecycle:${randomUUID()}`,
      occurredAt: "2026-11-12T04:00:00.000Z",
      effectiveAt: "2026-11-12T04:00:00.000Z",
      source: "bazionweb",
      action: "grace",
      subscriptionId: "sub_12345",
      externalCustomerId: "cust_123",
      externalOrderId: "order_456",
      reasonCode: "INVOICE_OVERDUE_GRACE",
    });
    expect(missingGraceEnd.success).toBe(false);
  });

  it("validates lifecycle status callbacks and operation detail snapshots without unknown keys", () => {
    const opId = randomUUID();
    const corrId = randomUUID();
    const detail = provisioningOperationDetailV1Schema.parse({
      operation: {
        schemaVersion: "1.0.0",
        operationId: opId,
        correlationId: corrId,
        externalOrderId: "order_456",
        status: "compensation_required",
        currentStep: "bind_domain",
        tenantId: randomUUID(),
        installationId: randomUUID(),
        failure: { code: "DOMAIN_VERIFICATION_TIMED_OUT", retryable: false },
        updatedAt: "2026-11-12T04:00:00.000Z",
      },
      source: "bazionweb",
      externalCustomerId: "cust_123",
      offerId: "church-site",
      offerVersion: "1.0.0",
      requestedDomain: "grace.example.org",
      lease: {
        holderWorkerId: "worker-1",
        fencingToken: 2,
        leaseExpiresAt: "2026-11-12T04:05:00.000Z",
        attemptCount: 2,
        retryAfterAt: null,
      },
      failureDisposition: "unknown",
      manualReviewNote: null,
      lastOperatorActorId: null,
      acceptedAt: "2026-11-12T03:59:00.000Z",
      finishedAt: null,
      stepAttempts: [
        {
          id: randomUUID(),
          stepName: "bind_domain",
          direction: "forward",
          attemptNumber: 1,
          status: "unknown",
          fencingToken: 2,
          correlationId: corrId,
          effectRefs: { hostname: "grace.example.org" },
          errorCode: "DOMAIN_VERIFICATION_TIMED_OUT",
          retryable: true,
          failureDisposition: "unknown",
          startedAt: "2026-11-12T03:59:30.000Z",
          finishedAt: "2026-11-12T04:00:00.000Z",
        },
      ],
      events: [
        {
          id: randomUUID(),
          eventType: "status_changed",
          status: "compensation_required",
          currentStep: "bind_domain",
          failureCode: "DOMAIN_VERIFICATION_TIMED_OUT",
          occurredAt: "2026-11-12T04:00:00.000Z",
        },
      ],
    });
    expect(detail.lease.fencingToken).toBe(2);

    const statusCallback = subscriptionLifecycleStatusEventV1Schema.parse({
      schemaVersion: "1.0.0",
      eventType: "product.subscription.lifecycle.status.v1",
      eventId: randomUUID(),
      correlationId: corrId,
      occurredAt: "2026-11-12T04:00:00.000Z",
      source: "bazion-platform",
      lifecycle: {
        schemaVersion: "1.0.0",
        commandId: randomUUID(),
        action: "suspend",
        subscriptionId: "sub_12345",
        externalOrderId: "order_456",
        tenantId: detail.operation.tenantId,
        installationId: detail.operation.installationId,
        installationStatus: "suspended",
        applied: true,
        reasonCode: "GRACE_EXPIRED",
        effectiveAt: "2026-11-12T04:00:00.000Z",
        updatedAt: "2026-11-12T04:00:01.000Z",
      },
    });
    expect(statusCallback.lifecycle.installationStatus).toBe("suspended");

    expect(provisioningManualReviewRequestSchema.safeParse({
      reason: "Inspected DNS state and confirmed TXT propagation is healthy.",
      resolution: "resume_forward",
      note: "Verified TXT record manually.",
    }).success).toBe(true);
  });
});

