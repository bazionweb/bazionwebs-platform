import type { FastifyInstance, FastifyReply } from "fastify";
import { PostgresAuditEventWriter } from "@bazion/audit";
import {
  crossEntityReconciliationRequestV1Schema,
  recordOperationalDrillRequestV1Schema,
} from "@bazion/api-contracts";
import { requirePlatformRole } from "@bazion/auth";
import { pool } from "../../lib/database.js";
import {
  CommercialMachineAuthError,
  DEFAULT_COMMAND_AUDIENCE,
  DEFAULT_COMMAND_ISSUER,
  verifyMachineBearerToken,
} from "./auth.js";
import {
  emitStructuredProvisioningLog,
  redactStructuredContext,
  resolveCorrelationId,
} from "./observability.js";
import type { CommercialProvisioningRuntime } from "./routes.js";
import { CommercialProvisioningError } from "./service.js";
import { ProvisioningOfferResolutionError } from "./offer-resolution.js";

const auditWriter = new PostgresAuditEventWriter(pool);

function sendPhase7Error(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof CommercialMachineAuthError || error instanceof CommercialProvisioningError) {
    return reply.code(error.statusCode).send({
      error: error.code,
      message: error.message,
      ...(error instanceof CommercialProvisioningError && error.issues ? { issues: error.issues } : {}),
    });
  }
  if (error instanceof ProvisioningOfferResolutionError) {
    return reply.code(422).send({ error: error.code, message: error.message });
  }
  const candidate = error as { statusCode?: unknown; code?: unknown; message?: unknown };
  if (typeof candidate.statusCode === "number" && typeof candidate.code === "string") {
    return reply.code(candidate.statusCode).send({
      error: candidate.code,
      message: typeof candidate.message === "string" ? candidate.message : "Request failed.",
    });
  }
  throw error;
}

function requireRuntime(runtime: CommercialProvisioningRuntime | null, reply: FastifyReply): CommercialProvisioningRuntime | null {
  if (!runtime) {
    reply.code(503).send({
      error: "COMMERCIAL_PROVISIONING_UNCONFIGURED",
      message: "Commercial provisioning runtime is not configured.",
    });
    return null;
  }
  return runtime;
}

export async function registerCommercialPhase7Routes(
  app: FastifyInstance,
  options: { runtime: CommercialProvisioningRuntime | null },
): Promise<void> {
  // ── Live SLOs & alert evaluation ─────────────────────────────────────────
  app.get("/admin/platform/commercial-provisioning/slo-alerts", async (request, reply) => {
    const runtime = requireRuntime(options.runtime, reply);
    if (!runtime) return;
    if (!runtime.sloService) {
      return reply.code(503).send({
        error: "SLO_SERVICE_UNAVAILABLE",
        message: "Provisioning SLO evaluation service is not active in this runtime.",
      });
    }

    const correlationId = resolveCorrelationId(request.headers["x-correlation-id"]);
    reply.header("x-correlation-id", correlationId);
    try {
      await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
      const snapshot = await runtime.sloService.evaluate(correlationId);
      if (snapshot.alerts.length > 0) {
        emitStructuredProvisioningLog("warn", "slo.alerts_active", correlationId, {
          status: snapshot.status,
          alertIds: snapshot.alerts.map((a) => a.id),
        });
      }
      return reply.code(200).send(snapshot);
    } catch (error) {
      return sendPhase7Error(reply, error);
    }
  });

  // ── Authoritative cross-entity reconciliation & exception report ─────────
  app.get("/admin/platform/commercial-provisioning/reconciliation-exceptions", async (request, reply) => {
    const runtime = requireRuntime(options.runtime, reply);
    if (!runtime) return;
    if (!runtime.reconciliationService) {
      return reply.code(503).send({
        error: "RECONCILIATION_SERVICE_UNAVAILABLE",
        message: "Cross-entity reconciliation service is not active in this runtime.",
      });
    }

    const correlationId = resolveCorrelationId(request.headers["x-correlation-id"]);
    reply.header("x-correlation-id", correlationId);
    try {
      await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
      const report = await runtime.reconciliationService.reconcile([], correlationId);
      return reply.code(200).send(report);
    } catch (error) {
      return sendPhase7Error(reply, error);
    }
  });

  app.post("/admin/platform/commercial-provisioning/reconciliation-exceptions", async (request, reply) => {
    const runtime = requireRuntime(options.runtime, reply);
    if (!runtime) return;
    if (!runtime.reconciliationService) {
      return reply.code(503).send({
        error: "RECONCILIATION_SERVICE_UNAVAILABLE",
        message: "Cross-entity reconciliation service is not active in this runtime.",
      });
    }

    const headerCorrelationId = resolveCorrelationId(request.headers["x-correlation-id"]);
    try {
      const identity = await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
      const parsed = crossEntityReconciliationRequestV1Schema.safeParse(request.body ?? { schemaVersion: "1.0.0", paidOrders: [] });
      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_RECONCILIATION_REQUEST",
          message: "Paid-order snapshot payload failed strict validation.",
          issues: redactStructuredContext(parsed.error.issues),
        });
      }

      const correlationId = parsed.data.correlationId ?? headerCorrelationId;
      reply.header("x-correlation-id", correlationId);
      const report = await runtime.reconciliationService.reconcile(parsed.data.paidOrders, correlationId);

      await auditWriter.append({
        actorType: "user",
        actorId: identity.userId,
        actorRole: identity.role,
        action: "commercial_provisioning.cross_entity_reconcile",
        resourceType: "commercial_reconciliation_report",
        resourceId: correlationId,
        outcome: report.summary.unresolvedDriftCount === 0 ? "succeeded" : "failed",
        requestId: correlationId,
        metadata: {
          ordersChecked: report.summary.ordersChecked,
          operationsChecked: report.summary.operationsChecked,
          installationsChecked: report.summary.installationsChecked,
          unresolvedDriftCount: report.summary.unresolvedDriftCount,
        },
      }).catch(() => undefined);

      return reply.code(200).send(report);
    } catch (error) {
      return sendPhase7Error(reply, error);
    }
  });

  app.post("/internal/commercial/reconciliation/report", async (request, reply) => {
    const runtime = requireRuntime(options.runtime, reply);
    if (!runtime) return;
    if (!runtime.reconciliationService) {
      return reply.code(503).send({
        error: "RECONCILIATION_SERVICE_UNAVAILABLE",
        message: "Cross-entity reconciliation service is not active in this runtime.",
      });
    }

    const headerCorrelationId = resolveCorrelationId(request.headers["x-correlation-id"]);
    try {
      verifyMachineBearerToken(request.headers as Record<string, unknown>, {
        secret: runtime.commandAuth.secret,
        expectedIssuer: runtime.commandAuth.issuer || DEFAULT_COMMAND_ISSUER,
        expectedAudience: runtime.commandAuth.audience || DEFAULT_COMMAND_AUDIENCE,
        requiredScopes: ["commercial:provisioning:read"],
      });

      const parsed = crossEntityReconciliationRequestV1Schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_RECONCILIATION_REQUEST",
          message: "Commercial reconciliation snapshot payload failed strict validation.",
          issues: redactStructuredContext(parsed.error.issues),
        });
      }

      const correlationId = parsed.data.correlationId ?? headerCorrelationId;
      reply.header("x-correlation-id", correlationId);
      const report = await runtime.reconciliationService.reconcile(parsed.data.paidOrders, correlationId);
      return reply.code(200).send(report);
    } catch (error) {
      return sendPhase7Error(reply, error);
    }
  });

  // ── Canary / cutover readiness & verified drill recording ────────────────
  app.get("/admin/platform/commercial-provisioning/cutover-readiness", async (request, reply) => {
    const runtime = requireRuntime(options.runtime, reply);
    if (!runtime) return;
    if (!runtime.cutoverService) {
      return reply.code(503).send({
        error: "CUTOVER_SERVICE_UNAVAILABLE",
        message: "Cutover readiness evaluation service is not active in this runtime.",
      });
    }

    const correlationId = resolveCorrelationId(request.headers["x-correlation-id"]);
    reply.header("x-correlation-id", correlationId);
    try {
      await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
      const report = await runtime.cutoverService.evaluate(correlationId);
      return reply.code(200).send(report);
    } catch (error) {
      return sendPhase7Error(reply, error);
    }
  });

  app.post("/admin/platform/commercial-provisioning/drills", async (request, reply) => {
    const runtime = requireRuntime(options.runtime, reply);
    if (!runtime) return;
    if (!runtime.cutoverService) {
      return reply.code(503).send({
        error: "CUTOVER_SERVICE_UNAVAILABLE",
        message: "Cutover readiness evaluation service is not active in this runtime.",
      });
    }

    const correlationId = resolveCorrelationId(request.headers["x-correlation-id"]);
    reply.header("x-correlation-id", correlationId);
    try {
      const identity = await requirePlatformRole(request.headers, ["platform_owner"]);
      const parsed = recordOperationalDrillRequestV1Schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_DRILL_INPUT",
          message: "Operational drill input failed validation.",
          issues: redactStructuredContext(parsed.error.issues),
        });
      }

      await runtime.cutoverService.recordDrill({
        actorId: identity.userId,
        actorRole: identity.role,
        requestId: correlationId,
        payload: parsed.data,
      });
      const updatedReport = await runtime.cutoverService.evaluate(correlationId);
      emitStructuredProvisioningLog("info", "cutover.drill_recorded", correlationId, {
        drillType: parsed.data.drillType,
        evidenceRef: parsed.data.evidenceRef,
      });
      return reply.code(201).send(updatedReport);
    } catch (error) {
      return sendPhase7Error(reply, error);
    }
  });
}
