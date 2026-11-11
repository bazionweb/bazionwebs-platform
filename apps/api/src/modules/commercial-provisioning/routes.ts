import type { FastifyInstance, FastifyRequest } from "fastify";
import { PostgresAuditEventWriter } from "@bazion/audit";
import { issueOrderClaimProofInputSchema } from "@bazion/api-contracts";
import { requirePlatformRole } from "@bazion/auth";
import { pool } from "../../lib/database.js";
import {
  CommercialMachineAuthError,
  DEFAULT_COMMAND_AUDIENCE,
  DEFAULT_COMMAND_ISSUER,
  verifyMachineBearerToken,
} from "./auth.js";
import {
  CommercialProvisioningError,
  type CommercialDeliveryReconciliationReport,
  type CommercialProvisioningService,
} from "./service.js";
import type {
  OutboxReplayResult,
  PlatformStatusOutboxDispatcher,
} from "./status-outbox-worker.js";

const auditWriter = new PostgresAuditEventWriter(pool);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CommercialProvisioningRuntime {
  commandAuth: {
    secret: string;
    issuer: string;
    audience: string;
  };
  service: Pick<CommercialProvisioningService, "acceptCommand" | "getOperation" | "reconcile">;
  dispatcher: Pick<PlatformStatusOutboxDispatcher, "replayOutboxEntry">;
  close(): Promise<void>;
}

function sendRouteError(reply: import("fastify").FastifyReply, error: unknown) {
  if (error instanceof CommercialMachineAuthError) {
    return reply.code(error.statusCode).send({ error: error.code, message: error.message });
  }
  if (error instanceof CommercialProvisioningError) {
    return reply.code(error.statusCode).send({
      error: error.code,
      message: error.message,
      ...(error.issues ? { issues: error.issues } : {}),
    });
  }
  throw error;
}

export async function commercialProvisioningRoutes(
  app: FastifyInstance,
  options: { runtime: CommercialProvisioningRuntime | null },
): Promise<void> {
  app.post("/internal/commercial/provisioning-requests", async (request, reply) => {
    const runtime = options.runtime;
    if (!runtime) {
      return reply.code(503).send({
        error: "COMMERCIAL_PROVISIONING_UNCONFIGURED",
        message: "Commercial provisioning receiver is not configured.",
      });
    }

    try {
      verifyMachineBearerToken(request.headers as Record<string, unknown>, {
        secret: runtime.commandAuth.secret,
        expectedIssuer: runtime.commandAuth.issuer || DEFAULT_COMMAND_ISSUER,
        expectedAudience: runtime.commandAuth.audience || DEFAULT_COMMAND_AUDIENCE,
        requiredScopes: ["commercial:provisioning:write"],
      });

      const result = await runtime.service.acceptCommand(request.body);
      return reply.code(202).send({
        accepted: true,
        deduplicated: result.deduplicated,
        operation: result.operation,
      });
    } catch (error) {
      return sendRouteError(reply, error);
    }
  });

  app.get<{ Params: { operationId: string } }>(
    "/internal/commercial/operations/:operationId",
    async (request, reply) => {
      const runtime = options.runtime;
      if (!runtime) {
        return reply.code(503).send({
          error: "COMMERCIAL_PROVISIONING_UNCONFIGURED",
          message: "Commercial provisioning receiver is not configured.",
        });
      }

      try {
        verifyMachineBearerToken(request.headers as Record<string, unknown>, {
          secret: runtime.commandAuth.secret,
          expectedIssuer: runtime.commandAuth.issuer || DEFAULT_COMMAND_ISSUER,
          expectedAudience: runtime.commandAuth.audience || DEFAULT_COMMAND_AUDIENCE,
          requiredScopes: ["commercial:provisioning:read"],
        });

        const operation = await runtime.service.getOperation(request.params.operationId.trim());
        return reply.send({ operation });
      } catch (error) {
        return sendRouteError(reply, error);
      }
    },
  );

  app.get<{ Querystring: { staleSeconds?: string } }>(
    "/admin/platform/commercial-provisioning/reconciliation",
    async (request, reply) => {
      await requirePlatformRole(request.headers, ["platform_owner"]);
      const runtime = options.runtime;
      if (!runtime) {
        return reply.code(503).send({
          error: "COMMERCIAL_PROVISIONING_UNCONFIGURED",
          message: "Commercial provisioning receiver is not configured.",
        });
      }

      const rawStale = request.query.staleSeconds;
      const staleSeconds = rawStale === undefined ? 300 : Number(rawStale);
      if (!Number.isFinite(staleSeconds) || staleSeconds < 30 || staleSeconds > 86_400) {
        return reply.code(400).send({ error: "INVALID_INPUT", message: "staleSeconds must be between 30 and 86400." });
      }

      const report: CommercialDeliveryReconciliationReport = await runtime.service.reconcile(staleSeconds);
      return reply.send({ reconciliation: report });
    },
  );

  app.post<{ Params: { outboxId: string } }>(
    "/admin/platform/commercial-provisioning/status-outbox/:outboxId/replay",
    async (request: FastifyRequest<{ Params: { outboxId: string } }>, reply) => {
      const operator = await requirePlatformRole(request.headers, ["platform_owner"]);
      const outboxId = request.params.outboxId.trim();
      if (!uuidPattern.test(outboxId)) {
        return reply.code(400).send({ error: "INVALID_INPUT", message: "Invalid outbox identifier." });
      }

      const runtime = options.runtime;
      if (!runtime) {
        return reply.code(503).send({
          error: "COMMERCIAL_PROVISIONING_UNCONFIGURED",
          message: "Commercial provisioning receiver is not configured.",
        });
      }

      const auditBase = {
        actorType: "user" as const,
        actorId: operator.userId,
        actorRole: operator.role,
        resourceType: "product_provisioning_status_outbox",
        resourceId: outboxId,
        requestId: request.id,
        ipAddress: request.ip,
        userAgent: typeof request.headers["user-agent"] === "string" ? request.headers["user-agent"] : null,
      };
      await auditWriter.append({
        ...auditBase,
        action: "commercial.provisioning.outbox.replay.requested",
        outcome: "succeeded",
      });

      const replayed: OutboxReplayResult | null = await runtime.dispatcher.replayOutboxEntry(outboxId);
      if (!replayed) {
        await auditWriter.append({
          ...auditBase,
          action: "commercial.provisioning.outbox.replay.failed",
          outcome: "failed",
          metadata: { errorCode: "OUTBOX_ENTRY_NOT_REPLAYABLE" },
        }).catch(() => undefined);
        return reply.code(404).send({
          error: "OUTBOX_ENTRY_NOT_FOUND",
          message: "Status outbox entry was not found, already delivered, or still has an active worker lease.",
        });
      }

      await auditWriter.append({
        ...auditBase,
        action: "commercial.provisioning.outbox.replay.completed",
        outcome: "succeeded",
        metadata: { operationId: replayed.operationId, status: replayed.status },
      }).catch(() => undefined);

      return reply.code(202).send({ outbox: replayed });
    },
  );

  app.post("/internal/commercial/order-claims", async (request, reply) => {
    const runtime = options.runtime;
    if (!runtime) {
      return reply.code(503).send({
        error: "COMMERCIAL_PROVISIONING_UNCONFIGURED",
        message: "Commercial integration secret is not configured.",
      });
    }

    try {
      const claims = verifyMachineBearerToken(request.headers as Record<string, unknown>, {
        secret: runtime.commandAuth.secret,
        expectedIssuer: runtime.commandAuth.issuer || DEFAULT_COMMAND_ISSUER,
        expectedAudience: runtime.commandAuth.audience || DEFAULT_COMMAND_AUDIENCE,
        requiredScopes: ["commercial:order-claims:write"],
      });

      const parsed = issueOrderClaimProofInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_INPUT",
          message: parsed.error.issues[0]?.message ?? "Invalid guest order claim issuance payload.",
        });
      }

      const { issueGuestOrderClaim } = await import("@bazion/auth/server");
      const issued = await issueGuestOrderClaim({
        externalOrderId: parsed.data.externalOrderId,
        externalCustomerId: parsed.data.externalCustomerId,
        tenantId: parsed.data.tenantId,
        installationId: parsed.data.installationId ?? null,
        issuedByClient: claims.sub,
        expiresInSeconds: parsed.data.expiresInSeconds,
      });

      await auditWriter.append({
        actorType: "service",
        actorId: claims.sub,
        tenantId: parsed.data.tenantId,
        action: "commercial.order_claim.issued",
        resourceType: "commercial_order_claim_proof",
        resourceId: issued.claimId,
        outcome: "succeeded",
        requestId: request.id,
        metadata: { externalOrderId: parsed.data.externalOrderId },
      }).catch(() => undefined);

      return reply.code(201).send({
        claimId: issued.claimId,
        proofToken: issued.proofToken,
        expiresAt: issued.expiresAt,
        claimPath: "/workspace?claim=1",
      });
    } catch (error) {
      return sendRouteError(reply, error);
    }
  });
}
