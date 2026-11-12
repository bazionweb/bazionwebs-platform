import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_CALLBACK_AUDIENCE,
  DEFAULT_CALLBACK_ISSUER,
  DEFAULT_COMMAND_AUDIENCE,
  DEFAULT_COMMAND_ISSUER,
  signMachineBearerToken,
  verifyMachineBearerToken,
} from "./auth.js";
import { commercialProvisioningRoutes, type CommercialProvisioningRuntime } from "./routes.js";
import { CommercialProvisioningError } from "./service.js";
import { PlatformLifecycleOutboxDispatcher } from "./status-outbox-worker.js";

const mocks = vi.hoisted(() => ({
  requirePlatformRole: vi.fn(),
  appendAuditEvent: vi.fn(),
}));

vi.mock("@bazion/audit", () => ({
  PostgresAuditEventWriter: class {
    append(event: unknown) {
      return mocks.appendAuditEvent(event);
    }
  },
}));
vi.mock("@bazion/auth", () => ({ requirePlatformRole: mocks.requirePlatformRole }));
vi.mock("../../lib/database.js", () => ({ pool: { query: vi.fn() } }));

const commandSecret = "phase6-commercial-command-test-secret-32c";
const operationId = "11111111-1111-4111-8111-111111111111";
const tenantId = "22222222-2222-4222-8222-222222222222";
const installationId = "33333333-3333-4333-8333-333333333333";
const correlationId = "44444444-4444-4444-8444-444444444444";
const eventId = "55555555-5555-4555-8555-555555555555";
const commandId = "66666666-6666-4666-8666-666666666666";

const sampleDetail = {
  operation: {
    schemaVersion: "1.0.0" as const,
    operationId,
    correlationId,
    externalOrderId: "INV-P6-100:line:0",
    status: "compensation_required" as const,
    currentStep: "provision_hosting" as const,
    tenantId,
    installationId,
    failure: { code: "TIMEOUT_AFTER_SUBMIT", retryable: true },
    updatedAt: "2026-11-12T03:00:00.000Z",
  },
  source: "bazionweb",
  externalCustomerId: "cust-p6-100",
  offerId: "website-business",
  offerVersion: "2026.1.0",
  requestedDomain: null,
  lease: {
    holderWorkerId: null,
    fencingToken: 2,
    leaseExpiresAt: null,
    attemptCount: 1,
    retryAfterAt: null,
  },
  failureDisposition: "unknown",
  manualReviewNote: null,
  lastOperatorActorId: null,
  acceptedAt: "2026-11-12T02:59:00.000Z",
  finishedAt: null,
  stepAttempts: [],
  events: [],
};

function makePhase6Runtime(): CommercialProvisioningRuntime {
  const lifecycleCallbackEvent = {
    schemaVersion: "1.0.0" as const,
    eventType: "product.subscription.lifecycle.status.v1" as const,
    eventId,
    correlationId,
    occurredAt: "2026-11-12T03:05:00.000Z",
    source: "bazion-platform" as const,
    lifecycle: {
      schemaVersion: "1.0.0" as const,
      commandId,
      action: "suspend" as const,
      subscriptionId: "sub-p6-100",
      externalOrderId: "INV-P6-100:line:0",
      tenantId,
      installationId,
      installationStatus: "suspended" as const,
      applied: true,
      reasonCode: "GRACE_EXPIRED_DUNNING_EXHAUSTED",
      effectiveAt: "2026-11-12T03:04:00.000Z",
      updatedAt: "2026-11-12T03:05:00.000Z",
    },
  };

  return {
    commandAuth: {
      secret: commandSecret,
      issuer: DEFAULT_COMMAND_ISSUER,
      audience: DEFAULT_COMMAND_AUDIENCE,
    },
    service: {
      acceptCommand: vi.fn(),
      getOperation: vi.fn(),
      reconcile: vi.fn(),
    } as any,
    dispatcher: {
      replayOutboxEntry: vi.fn(),
    } as any,
    operatorService: {
      listOperations: vi.fn(async () => []),
      getOperationDetail: vi.fn(async () => sampleDetail as any),
      performOperatorAction: vi.fn(async () => sampleDetail as any),
      completeManualReview: vi.fn(async () => sampleDetail as any),
      listTenantInstallations: vi.fn(async () => []),
    } as any,
    lifecycleService: {
      applySignedCommand: vi.fn(async () => ({
        deduplicated: false,
        stale: false,
        applied: true,
        commandId,
        action: "suspend" as const,
        subscriptionId: "sub-p6-100",
        tenantId,
        installationId,
        installationStatus: "suspended",
        callbackEvent: lifecycleCallbackEvent,
      })),
    } as any,
    offboardingService: {
      offboardInstallation: vi.fn(async () => ({
        installationId,
        status: "offboarding" as const,
        archive: {
          id: randomUUID(),
          tenantId,
          installationId,
          checksum: "a".repeat(64),
          sizeBytes: 512,
          createdAt: "2026-11-12T03:00:00.000Z",
          retentionExpiresAt: "2026-12-12T03:00:00.000Z",
        },
      })),
      restoreInstallation: vi.fn(async () => ({ installationId, status: "ready" })),
      purgeExpiredArchivesForTenant: vi.fn(async () => ({
        archivesScanned: 1,
        configurationsDeleted: 1,
        archivesDeleted: 1,
      })),
    } as any,
    close: vi.fn(async () => undefined),
  };
}

function mintToken(scopes: string[]) {
  return signMachineBearerToken(
    {
      subject: "bazionweb-lifecycle-worker",
      issuer: DEFAULT_COMMAND_ISSUER,
      audience: DEFAULT_COMMAND_AUDIENCE,
      scopes,
      ttlSeconds: 120,
    },
    commandSecret,
  );
}

beforeEach(() => {
  mocks.requirePlatformRole.mockReset();
  mocks.appendAuditEvent.mockReset();
  mocks.requirePlatformRole.mockImplementation(async (_headers: unknown, allowed: string[]) => {
    return {
      userId: "owner-1",
      email: "owner@bazion.test",
      role: allowed[0] ?? "platform_owner",
    };
  });
});

describe("Phase 6 commercial lifecycle, operator saga, and archive routes", () => {
  it("enforces commercial:lifecycle:write scope on signed lifecycle commands", async () => {
    const runtime = makePhase6Runtime();
    const app = Fastify();
    await app.register(commercialProvisioningRoutes, { prefix: "/v1", runtime });
    await app.ready();

    try {
      const payload = {
        schemaVersion: "1.0.0",
        eventId,
        correlationId,
        idempotencyKey: "bazionweb:sub:sub-p6-100:suspend:v1",
        occurredAt: "2026-11-12T03:04:00.000Z",
        effectiveAt: "2026-11-12T03:04:00.000Z",
        source: "bazionweb",
        action: "suspend",
        subscriptionId: "sub-p6-100",
        externalCustomerId: "cust-p6-100",
        externalOrderId: "INV-P6-100:line:0",
        reasonCode: "GRACE_EXPIRED_DUNNING_EXHAUSTED",
      };

      const wrongScope = await app.inject({
        method: "POST",
        url: "/v1/internal/commercial/subscription-lifecycle",
        headers: { authorization: `Bearer ${mintToken(["commercial:provisioning:write"])}` },
        payload,
      });
      expect(wrongScope.statusCode).toBe(403);

      const ok = await app.inject({
        method: "POST",
        url: "/v1/internal/commercial/subscription-lifecycle",
        headers: { authorization: `Bearer ${mintToken(["commercial:lifecycle:write"])}` },
        payload,
      });
      expect(ok.statusCode).toBe(200);
      expect(ok.json().accepted).toBe(true);
      expect(ok.json().installationStatus).toBe("suspended");
    } finally {
      await app.close();
    }
  });

  it("requires platform_owner for destructive compensation, manual trigger_compensate, offboard, and purge", async () => {
    const runtime = makePhase6Runtime();
    const app = Fastify();
    await app.register(commercialProvisioningRoutes, { prefix: "/v1", runtime });
    await app.ready();

    try {
      mocks.requirePlatformRole.mockResolvedValue({
        userId: "admin-1",
        email: "admin@bazion.test",
        role: "platform_admin",
      });

      const manualCompensateByAdmin = await app.inject({
        method: "POST",
        url: `/v1/admin/platform/commercial-provisioning/operations/${operationId}/complete-manual-review`,
        payload: {
          resolution: "trigger_compensate",
          note: "Operator tried trigger_compensate",
          reason: "Operator audit reason for action",
          confirmDestructive: true,
        },
      });
      expect(manualCompensateByAdmin.statusCode).toBe(403);

      mocks.requirePlatformRole.mockImplementation(async (_headers: unknown, allowed: readonly string[]) => {
        if (!allowed.includes("platform_admin")) {
          throw Object.assign(new Error("Owner required"), {
            statusCode: 403,
            code: "PLATFORM_PERMISSION_DENIED",
          });
        }
        return { userId: "admin-1", email: "admin@bazion.test", role: "platform_admin" };
      });

      const compensateByAdmin = await app.inject({
        method: "POST",
        url: `/v1/admin/platform/commercial-provisioning/operations/${operationId}/compensate`,
        payload: { reason: "Compensate stalled op", confirmDestructive: true },
      });
      expect(compensateByAdmin.statusCode).toBe(403);

      const retryByAdmin = await app.inject({
        method: "POST",
        url: `/v1/admin/platform/commercial-provisioning/operations/${operationId}/retry`,
        payload: { reason: "Retry temporary failure" },
      });
      expect(retryByAdmin.statusCode).toBe(200);

      mocks.requirePlatformRole.mockResolvedValue({
        userId: "owner-1",
        email: "owner@bazion.test",
        role: "platform_owner",
      });

      const offboard = await app.inject({
        method: "POST",
        url: `/v1/admin/platform/tenants/${tenantId}/installations/${installationId}/offboard`,
        payload: { reason: "Customer offboard confirmed", confirmDestructive: true },
      });
      expect(offboard.statusCode).toBe(200);
      expect(offboard.json().status).toBe("offboarding");

      vi.mocked(runtime.operatorService!.performOperatorAction).mockRejectedValueOnce(
        new CommercialProvisioningError(409, "OPERATION_ALREADY_TERMINAL", "Already done"),
      );
      const conflict = await app.inject({
        method: "POST",
        url: `/v1/admin/platform/commercial-provisioning/operations/${operationId}/compensate`,
        payload: { reason: "Compensate terminal op", confirmDestructive: true },
      });
      expect(conflict.statusCode).toBe(409);
    } finally {
      await app.close();
    }
  });

  it("delivers signed lifecycle status outbox events with bearer + HMAC headers", async () => {
    const updates: Array<{ sql: string; params: unknown[] | undefined }> = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("FOR UPDATE SKIP LOCKED")) {
          return {
            rows: [
              {
                id: commandId,
                operation_id: commandId,
                event_id: eventId,
                correlation_id: correlationId,
                payload: { eventType: "product.subscription.lifecycle.status.v1" },
                max_attempts: 8,
              },
            ],
            rowCount: 1,
          };
        }
        if (sql.includes("RETURNING id, attempt_count")) {
          return { rows: [{ id: commandId, attempt_count: 1 }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        updates.push({ sql, params });
        if (sql.includes("dead_letter")) {
          return { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 1 };
      }),
      connect: vi.fn(async () => client),
    };

    const requests: Array<{ headers: Record<string, string>; body: string }> = [];
    const dispatcher = new PlatformLifecycleOutboxDispatcher(pool as any, async (_url, init) => {
      requests.push({
        headers: init.headers as Record<string, string>,
        body: String(init.body),
      });
      return { status: 200, ok: true };
    });

    const summary = await dispatcher.processDueBatch({
      callbackUrl: "https://bazionweb.local/api/v1/webhooks/platform/lifecycle-status",
      signingSecret: commandSecret,
      bearerSigningSecret: commandSecret,
    });
    expect(summary).toEqual({
      claimed: 1,
      delivered: 1,
      retried: 0,
      deadLettered: 0,
      leaseConflicts: 0,
    });
    expect(requests).toHaveLength(1);
    const claims = verifyMachineBearerToken(
      { authorization: requests[0]!.headers.Authorization },
      {
        secret: commandSecret,
        expectedIssuer: DEFAULT_CALLBACK_ISSUER,
        expectedAudience: DEFAULT_CALLBACK_AUDIENCE,
        requiredScopes: ["provisioning:status:write"],
      },
    );
    expect(claims.sub).toBe("bazion-platform-lifecycle-dispatcher");
    expect(updates.some((u) => u.sql.includes("product_subscription_lifecycle_outbox") && u.sql.includes("'delivered'"))).toBe(true);
  });
});
