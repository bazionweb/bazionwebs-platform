import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { commercialProvisioningRoutes, type CommercialProvisioningRuntime } from "./routes.js";
import { CommercialProvisioningError } from "./service.js";
import {
  DEFAULT_COMMAND_AUDIENCE,
  DEFAULT_COMMAND_ISSUER,
  signMachineBearerToken,
} from "./auth.js";

const mocks = vi.hoisted(() => ({
  requirePlatformRole: vi.fn(),
  appendAuditEvent: vi.fn(),
}));

vi.mock("@bazion/audit", () => ({
  PostgresAuditEventWriter: class {
    append(event: unknown) { return mocks.appendAuditEvent(event); }
  },
}));
vi.mock("@bazion/auth", () => ({ requirePlatformRole: mocks.requirePlatformRole }));
vi.mock("../../lib/database.js", () => ({ pool: { query: vi.fn() } }));

const commandSecret = "commercial-command-test-signing-secret-32chars";
const operationId = "11111111-1111-4111-8111-111111111111";
const correlationId = "22222222-2222-4222-8222-222222222222";
const eventId = "33333333-3333-4333-8333-333333333333";
const outboxId = "44444444-4444-4444-8444-444444444444";

const validPayload = {
  schemaVersion: "1.0.0",
  eventId,
  correlationId,
  idempotencyKey: "bazionweb:order:inv-1:line:0:v1",
  occurredAt: "2026-11-11T20:00:00.000Z",
  source: "bazionweb",
  customer: {
    externalCustomerId: "client-1",
    displayName: "Acacia Ltd",
    primaryContact: { name: "Grace Wanjiku", email: "grace@acacia.example" },
  },
  order: {
    externalOrderId: "INV-2026-001:line:0",
    offerId: "website-business",
    offerVersion: "2026.1.0",
  },
  composition: {
    product: { id: "bazion-site", version: "1.0.0" },
    solution: { id: "business-website", version: "1.0.0" },
    template: { id: "node-nextjs", version: "1.0.0" },
  },
};

const sampleOperation = {
  schemaVersion: "1.0.0" as const,
  operationId,
  correlationId,
  externalOrderId: "INV-2026-001:line:0",
  status: "accepted" as const,
  currentStep: "accept_command",
  tenantId: null,
  installationId: null,
  failure: null,
  updatedAt: "2026-11-11T20:00:01.000Z",
};

function makeRuntime(): CommercialProvisioningRuntime {
  return {
    commandAuth: {
      secret: commandSecret,
      issuer: DEFAULT_COMMAND_ISSUER,
      audience: DEFAULT_COMMAND_AUDIENCE,
    },
    service: {
      acceptCommand: vi.fn(async () => ({ deduplicated: false, operation: sampleOperation })),
      getOperation: vi.fn(async () => sampleOperation),
      reconcile: vi.fn(async () => ({
        generatedAt: "2026-11-11T20:05:00.000Z",
        staleAcceptedThresholdSeconds: 300,
        counts: {
          acceptedWithoutProgress: 1,
          pendingOutbox: 0,
          processingOutbox: 0,
          overdueOutbox: 0,
          deadOutbox: 0,
        },
        stalledOperations: [],
        deadOutboxItems: [],
      })),
    },
    dispatcher: {
      replayOutboxEntry: vi.fn(async () => ({
        outboxId,
        operationId,
        status: "pending",
        maxAttempts: 11,
      })),
    },
    close: vi.fn(async () => undefined),
  };
}

async function makeApp(runtime: CommercialProvisioningRuntime | null) {
  const app = Fastify();
  await app.register(commercialProvisioningRoutes, { prefix: "/v1", runtime });
  await app.ready();
  return app;
}

function mintToken(overrides: Partial<Parameters<typeof signMachineBearerToken>[0]> = {}) {
  return signMachineBearerToken(
    {
      subject: "bazionweb-outbox-worker",
      issuer: DEFAULT_COMMAND_ISSUER,
      audience: DEFAULT_COMMAND_AUDIENCE,
      scopes: ["commercial:provisioning:write", "commercial:provisioning:read"],
      ttlSeconds: 120,
      ...overrides,
    },
    commandSecret,
  );
}

beforeEach(() => {
  mocks.requirePlatformRole.mockReset();
  mocks.appendAuditEvent.mockReset();
  mocks.requirePlatformRole.mockResolvedValue({
    userId: "platform-owner-1",
    email: "owner@bazion.test",
    role: "platform_owner",
  });
  mocks.appendAuditEvent.mockResolvedValue(undefined);
});

describe("commercial provisioning HTTP routes", () => {
  it("publishes the price-free, versioned provisioning catalog to a read-scoped machine client", async () => {
    const app = await makeApp(makeRuntime());
    try {
      const response = await app.inject({
        method: "GET",
        url: "/v1/internal/commercial/provisioning-catalog",
        headers: { authorization: `Bearer ${mintToken()}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.headers["cache-control"]).toBe("private, max-age=60");
      expect(response.json()).toMatchObject({ schemaVersion: "1.0.0", bindings: [] });
      expect(response.json()).toHaveProperty("generatedAt");
      expect(response.payload).not.toContain("price");
    } finally {
      await app.close();
    }
  });

  it("requires the commercial provisioning read scope for catalog access", async () => {
    const app = await makeApp(makeRuntime());
    try {
      const response = await app.inject({
        method: "GET",
        url: "/v1/internal/commercial/provisioning-catalog",
        headers: {
          authorization: `Bearer ${mintToken({ scopes: ["commercial:provisioning:write"] })}`,
        },
      });
      expect(response.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });

  it("rejects unauthenticated, wrong-audience, expired, overly long-lived, and under-scoped machine tokens", async () => {
    const app = await makeApp(makeRuntime());
    try {
      const noAuth = await app.inject({
        method: "POST",
        url: "/v1/internal/commercial/provisioning-requests",
        payload: validPayload,
      });
      expect(noAuth.statusCode).toBe(401);

      const wrongAud = await app.inject({
        method: "POST",
        url: "/v1/internal/commercial/provisioning-requests",
        headers: { authorization: `Bearer ${mintToken({ audience: "wrong-audience" })}` },
        payload: validPayload,
      });
      expect(wrongAud.statusCode).toBe(401);
      expect(wrongAud.json().error).toBe("MACHINE_TOKEN_AUDIENCE_INVALID");

      const now = Math.floor(Date.now() / 1000);
      const expired = await app.inject({
        method: "POST",
        url: "/v1/internal/commercial/provisioning-requests",
        headers: { authorization: `Bearer ${mintToken({ nowSeconds: now - 300, ttlSeconds: 60 })}` },
        payload: validPayload,
      });
      expect(expired.statusCode).toBe(401);
      expect(expired.json().error).toBe("MACHINE_TOKEN_EXPIRED");

      const readOnly = await app.inject({
        method: "POST",
        url: "/v1/internal/commercial/provisioning-requests",
        headers: { authorization: `Bearer ${mintToken({ scopes: ["commercial:provisioning:read"] })}` },
        payload: validPayload,
      });
      expect(readOnly.statusCode).toBe(403);
      expect(readOnly.json().error).toBe("MACHINE_SCOPE_INSUFFICIENT");
    } finally {
      await app.close();
    }
  });

  it("accepts authenticated commands with 202 and maps validation and idempotency conflict errors cleanly", async () => {
    const runtime = makeRuntime();
    const app = await makeApp(runtime);
    try {
      const accepted = await app.inject({
        method: "POST",
        url: "/v1/internal/commercial/provisioning-requests",
        headers: { authorization: `Bearer ${mintToken()}` },
        payload: validPayload,
      });
      expect(accepted.statusCode).toBe(202);
      expect(accepted.json()).toEqual({
        accepted: true,
        deduplicated: false,
        operation: sampleOperation,
      });

      vi.mocked(runtime.service.acceptCommand).mockRejectedValueOnce(
        new CommercialProvisioningError(409, "PROVISIONING_IDEMPOTENCY_CONFLICT", "Fingerprint mismatch"),
      );
      const conflict = await app.inject({
        method: "POST",
        url: "/v1/internal/commercial/provisioning-requests",
        headers: { authorization: `Bearer ${mintToken()}` },
        payload: validPayload,
      });
      expect(conflict.statusCode).toBe(409);
      expect(conflict.json().error).toBe("PROVISIONING_IDEMPOTENCY_CONFLICT");

      const readOp = await app.inject({
        method: "GET",
        url: `/v1/internal/commercial/operations/${operationId}`,
        headers: { authorization: `Bearer ${mintToken({ scopes: ["commercial:provisioning:read"] })}` },
      });
      expect(readOp.statusCode).toBe(200);
      expect(readOp.json().operation.operationId).toBe(operationId);
    } finally {
      await app.close();
    }
  });

  it("requires platform_owner authentication for reconciliation and audited outbox replay", async () => {
    const runtime = makeRuntime();
    const app = await makeApp(runtime);
    try {
      const reconcile = await app.inject({
        method: "GET",
        url: "/v1/admin/platform/commercial-provisioning/reconciliation?staleSeconds=120",
      });
      expect(reconcile.statusCode).toBe(200);
      expect(mocks.requirePlatformRole).toHaveBeenCalledWith(expect.any(Object), ["platform_owner"]);
      expect(runtime.service.reconcile).toHaveBeenCalledWith(120);

      const replay = await app.inject({
        method: "POST",
        url: `/v1/admin/platform/commercial-provisioning/status-outbox/${outboxId}/replay`,
      });
      expect(replay.statusCode).toBe(202);
      expect(replay.json().outbox.status).toBe("pending");
      expect(mocks.appendAuditEvent).toHaveBeenCalledTimes(2);
    } finally {
      await app.close();
    }
  });

  it("rejects replayed machine bearer tokens with identical jti", async () => {
    const app = await makeApp(makeRuntime());
    try {
      const token = mintToken({ jti: "replay-check-jti-001", scopes: ["commercial:provisioning:read"] });
      const first = await app.inject({
        method: "GET",
        url: "/v1/internal/commercial/provisioning-catalog",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(first.statusCode).toBe(200);

      const second = await app.inject({
        method: "GET",
        url: "/v1/internal/commercial/provisioning-catalog",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(second.statusCode).toBe(401);
      expect(second.json().error).toBe("MACHINE_TOKEN_REPLAYED");
    } finally {
      await app.close();
    }
  });

  it("accepts rotated previousSecrets and rejects unknown signing secrets", async () => {
    const previousSecret = "previous-commercial-command-secret-32chars";
    const runtime = makeRuntime();
    runtime.commandAuth.previousSecrets = [previousSecret];
    const app = await makeApp(runtime);
    try {
      const rotatedToken = signMachineBearerToken(
        {
          subject: "bazionweb-outbox-worker",
          issuer: DEFAULT_COMMAND_ISSUER,
          audience: DEFAULT_COMMAND_AUDIENCE,
          scopes: ["commercial:provisioning:read"],
          keyId: "cmd-prev-1",
          ttlSeconds: 120,
        },
        previousSecret,
      );
      const validResponse = await app.inject({
        method: "GET",
        url: "/v1/internal/commercial/provisioning-catalog",
        headers: { authorization: `Bearer ${rotatedToken}` },
      });
      expect(validResponse.statusCode).toBe(200);

      const unknownToken = signMachineBearerToken(
        {
          subject: "bazionweb-outbox-worker",
          issuer: DEFAULT_COMMAND_ISSUER,
          audience: DEFAULT_COMMAND_AUDIENCE,
          scopes: ["commercial:provisioning:read"],
          keyId: "cmd-unknown",
          ttlSeconds: 120,
        },
        "completely-unknown-command-secret-32chars",
      );
      const rejectedResponse = await app.inject({
        method: "GET",
        url: "/v1/internal/commercial/provisioning-catalog",
        headers: { authorization: `Bearer ${unknownToken}` },
      });
      expect(rejectedResponse.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("fails closed with 503 when commercial provisioning runtime is not configured", async () => {
    const app = await makeApp(null);
    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/internal/commercial/provisioning-requests",
        payload: validPayload,
      });
      expect(res.statusCode).toBe(503);
      expect(res.json().error).toBe("COMMERCIAL_PROVISIONING_UNCONFIGURED");
    } finally {
      await app.close();
    }
  });
});
