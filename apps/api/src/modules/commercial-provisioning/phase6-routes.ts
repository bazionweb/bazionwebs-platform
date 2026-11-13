import type { FastifyInstance, FastifyReply } from "fastify";
import {
  installationOffboardRequestSchema,
  installationRestoreRequestSchema,
  provisioningManualReviewRequestSchema,
} from "@bazion/api-contracts";
import { requirePlatformRole } from "@bazion/auth";
import { StaleSagaLeaseError } from "@bazion/product-installations";
import {
  CommercialMachineAuthError,
  verifyRuntimeMachineBearer,
} from "./auth.js";
import type { CommercialProvisioningRuntime } from "./routes.js";
import { CommercialProvisioningError } from "./service.js";

function sendPhase6Error(reply: FastifyReply, error: unknown) {
  if (error instanceof CommercialMachineAuthError || error instanceof CommercialProvisioningError) {
    return reply.code(error.statusCode).send({
      error: error.code,
      message: error.message,
      ...(error instanceof CommercialProvisioningError && error.issues ? { issues: error.issues } : {}),
    });
  }
  if (error instanceof StaleSagaLeaseError) {
    return reply.code(409).send({
      error: error.code,
      message: error.message,
    });
  }
  if (error && typeof error === "object" && "statusCode" in error && "code" in error) {
    const authErr = error as { statusCode?: number; code?: string; message?: string };
    return reply.code(authErr.statusCode ?? 403).send({
      error: authErr.code ?? "PERMISSION_DENIED",
      message: authErr.message ?? "Access denied.",
    });
  }
  throw error;
}

function requireRuntime(runtime: CommercialProvisioningRuntime | null, reply: FastifyReply): runtime is CommercialProvisioningRuntime {
  if (!runtime) {
    reply.code(503).send({
      error: "COMMERCIAL_PROVISIONING_UNCONFIGURED",
      message: "Commercial provisioning runtime is not enabled or configured.",
    });
    return false;
  }
  return true;
}

/**
 * Registers Phase 6 durable saga operator controls, signed subscription lifecycle commands,
 * and 30-day offboarding archive/restore endpoints onto the commercial provisioning plugin.
 */
export async function registerCommercialPhase6Routes(
  app: FastifyInstance,
  options: { runtime: CommercialProvisioningRuntime | null },
): Promise<void> {
  // ── Internal signed subscription lifecycle command endpoint (Bazionweb -> Platform) ──
  app.post("/internal/commercial/subscription-lifecycle", async (request, reply) => {
    try {
      const runtime = options.runtime;
      if (!requireRuntime(runtime, reply)) return reply;
      if (!runtime.lifecycleService) {
        return reply.code(503).send({
          error: "COMMERCIAL_LIFECYCLE_UNAVAILABLE",
          message: "Subscription lifecycle service is not configured.",
        });
      }

      const claims = verifyRuntimeMachineBearer(
        request.headers as Record<string, unknown>,
        runtime.commandAuth,
        ["commercial:lifecycle:write"],
      );

      const result = await runtime.lifecycleService.applySignedCommand(request.body, {
        requestId: request.id,
        actorClientId: claims.sub,
      });

      return reply.code(200).send({
        accepted: true,
        ...result,
      });
    } catch (error) {
      return sendPhase6Error(reply, error);
    }
  });

  // ── Super-admin & operator provisioning saga inspection & control routes ──
  app.get<{
    Querystring: { status?: string; externalOrderId?: string; tenantId?: string; limit?: string };
  }>("/admin/platform/commercial-provisioning/operations", async (request, reply) => {
    try {
      await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
      const runtime = options.runtime;
      if (!requireRuntime(runtime, reply)) return reply;
      if (!runtime.operatorService) {
        return reply.code(503).send({ error: "COMMERCIAL_OPERATOR_UNAVAILABLE" });
      }
      const parsedLimit = request.query.limit ? Number.parseInt(request.query.limit, 10) : undefined;
      const items = await runtime.operatorService.listOperations({
        ...(request.query.status ? { status: request.query.status } : {}),
        ...(request.query.externalOrderId ? { externalOrderId: request.query.externalOrderId } : {}),
        ...(request.query.tenantId ? { tenantId: request.query.tenantId } : {}),
        ...(parsedLimit && Number.isFinite(parsedLimit) ? { limit: parsedLimit } : {}),
      });
      return reply.send({ items });
    } catch (error) {
      return sendPhase6Error(reply, error);
    }
  });

  app.get<{ Params: { operationId: string } }>(
    "/admin/platform/commercial-provisioning/operations/:operationId",
    async (request, reply) => {
      try {
        await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
        const runtime = options.runtime;
        if (!requireRuntime(runtime, reply)) return reply;
        if (!runtime.operatorService) {
          return reply.code(503).send({ error: "COMMERCIAL_OPERATOR_UNAVAILABLE" });
        }
        const detail = await runtime.operatorService.getOperationDetail(request.params.operationId);
        return reply.send(detail);
      } catch (error) {
        return sendPhase6Error(reply, error);
      }
    },
  );

  const operatorActionRoutes: Array<{
    action: "retry" | "resume" | "reconcile" | "compensate";
    roles: readonly ("platform_owner" | "platform_admin")[];
  }> = [
    { action: "retry", roles: ["platform_owner", "platform_admin"] },
    { action: "resume", roles: ["platform_owner", "platform_admin"] },
    { action: "reconcile", roles: ["platform_owner", "platform_admin"] },
    { action: "compensate", roles: ["platform_owner"] },
  ];

  for (const routeDef of operatorActionRoutes) {
    app.post<{ Params: { operationId: string } }>(
      `/admin/platform/commercial-provisioning/operations/:operationId/${routeDef.action}`,
      async (request, reply) => {
        try {
          const identity = await requirePlatformRole(request.headers, routeDef.roles);
          const runtime = options.runtime;
          if (!requireRuntime(runtime, reply)) return reply;
          if (!runtime.operatorService) {
            return reply.code(503).send({ error: "COMMERCIAL_OPERATOR_UNAVAILABLE" });
          }
          const detail = await runtime.operatorService.performOperatorAction({
            operationId: request.params.operationId,
            action: routeDef.action,
            actor: { userId: identity.userId, role: identity.role },
            body: request.body ?? {},
            requestId: request.id,
          });
          return reply.send(detail);
        } catch (error) {
          return sendPhase6Error(reply, error);
        }
      },
    );
  }

  app.post<{ Params: { operationId: string } }>(
    "/admin/platform/commercial-provisioning/operations/:operationId/complete-manual-review",
    async (request, reply) => {
      try {
        const identity = await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
        const parsed = provisioningManualReviewRequestSchema.safeParse(request.body ?? {});
        if (parsed.success && parsed.data.resolution === "trigger_compensate" && identity.role !== "platform_owner") {
          return reply.code(403).send({
            error: "PLATFORM_PERMISSION_DENIED",
            message: "Triggering destructive compensation requires platform_owner role.",
          });
        }
        const runtime = options.runtime;
        if (!requireRuntime(runtime, reply)) return reply;
        if (!runtime.operatorService) {
          return reply.code(503).send({ error: "COMMERCIAL_OPERATOR_UNAVAILABLE" });
        }
        const detail = await runtime.operatorService.completeManualReview({
          operationId: request.params.operationId,
          actor: { userId: identity.userId, role: identity.role },
          body: request.body ?? {},
          requestId: request.id,
        });
        return reply.send(detail);
      } catch (error) {
        return sendPhase6Error(reply, error);
      }
    },
  );

  // ── Tenant product installation inventory & 30-day offboarding/recovery endpoints ──
  app.get<{ Params: { tenantId: string } }>(
    "/admin/platform/tenants/:tenantId/installations",
    async (request, reply) => {
      try {
        await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
        const runtime = options.runtime;
        if (!requireRuntime(runtime, reply)) return reply;
        if (!runtime.operatorService) {
          return reply.code(503).send({ error: "COMMERCIAL_OPERATOR_UNAVAILABLE" });
        }
        const items = await runtime.operatorService.listTenantInstallations(request.params.tenantId);
        return reply.send({ items });
      } catch (error) {
        return sendPhase6Error(reply, error);
      }
    },
  );

  app.post<{ Params: { tenantId: string; installationId: string } }>(
    "/admin/platform/tenants/:tenantId/installations/:installationId/offboard",
    async (request, reply) => {
      try {
        const identity = await requirePlatformRole(request.headers, ["platform_owner"]);
        const parsed = installationOffboardRequestSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
          return reply.code(400).send({
            error: "DESTRUCTIVE_CONFIRMATION_REQUIRED",
            message: parsed.error.issues[0]?.message ?? "Offboarding requires confirmDestructive: true and a descriptive reason.",
          });
        }
        const runtime = options.runtime;
        if (!requireRuntime(runtime, reply)) return reply;
        if (!runtime.offboardingService) {
          return reply.code(503).send({ error: "OFFBOARDING_SERVICE_UNAVAILABLE" });
        }
        const result = await runtime.offboardingService.offboardInstallation({
          tenantId: request.params.tenantId,
          installationId: request.params.installationId,
          actor: { userId: identity.userId, role: identity.role },
          reason: parsed.data.reason,
          confirmDestructive: parsed.data.confirmDestructive,
          requestId: request.id,
        });
        return reply.send(result);
      } catch (error) {
        return sendPhase6Error(reply, error);
      }
    },
  );

  app.post<{ Params: { tenantId: string; installationId: string } }>(
    "/admin/platform/tenants/:tenantId/installations/:installationId/restore",
    async (request, reply) => {
      try {
        const identity = await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
        const parsed = installationRestoreRequestSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
          return reply.code(400).send({
            error: "INVALID_INPUT",
            message: parsed.error.issues[0]?.message ?? "Restore requires a descriptive reason (min 8 chars).",
          });
        }
        const runtime = options.runtime;
        if (!requireRuntime(runtime, reply)) return reply;
        if (!runtime.offboardingService) {
          return reply.code(503).send({ error: "OFFBOARDING_SERVICE_UNAVAILABLE" });
        }
        const result = await runtime.offboardingService.restoreInstallation({
          tenantId: request.params.tenantId,
          installationId: request.params.installationId,
          actor: { userId: identity.userId, role: identity.role },
          reason: parsed.data.reason,
          requestId: request.id,
        });
        return reply.send(result);
      } catch (error) {
        return sendPhase6Error(reply, error);
      }
    },
  );

  app.post<{ Params: { tenantId: string } }>(
    "/admin/platform/tenants/:tenantId/offboarding-archives/purge-expired",
    async (request, reply) => {
      try {
        const identity = await requirePlatformRole(request.headers, ["platform_owner"]);
        const runtime = options.runtime;
        if (!requireRuntime(runtime, reply)) return reply;
        if (!runtime.offboardingService) {
          return reply.code(503).send({ error: "OFFBOARDING_SERVICE_UNAVAILABLE" });
        }
        const result = await runtime.offboardingService.purgeExpiredArchivesForTenant({
          tenantId: request.params.tenantId,
          actor: { userId: identity.userId, role: identity.role },
          requestId: request.id,
        });
        return reply.send(result);
      } catch (error) {
        return sendPhase6Error(reply, error);
      }
    },
  );
}
