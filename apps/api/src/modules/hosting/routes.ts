import type { FastifyInstance } from "fastify";
import { PostgresAuditEventWriter } from "@bazion/audit";
import { requirePlatformRole } from "@bazion/auth";
import { getPlatformTenant } from "@bazion/auth/server";
import { pool } from "../../lib/database.js";
import { tenantHostingDockerSecretReference } from "./secrets.js";
import { hostingProvisionInputSchema } from "./policy.js";
import { HostingLifecycleError, HostingLifecycleService } from "./lifecycle.js";
import type { HostingProvisioningRuntime } from "./runtime.js";

const auditWriter = new PostgresAuditEventWriter(pool);
const tenantIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const idempotencyKeyPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/;

function errorCode(error: unknown): string {
  return error instanceof Error && /^[A-Z][A-Z0-9_]{1,63}$/.test(error.message)
    ? error.message
    : "HOSTING_PROVISION_FAILED";
}

function errorStatus(code: string): number {
  switch (code) {
    case "TENANT_NOT_FOUND": return 404;
    case "TENANT_NOT_ACTIVE":
    case "HOSTING_PROVISIONING_IN_PROGRESS":
    case "HOSTING_RECONCILIATION_REQUIRED":
    case "HOSTING_IDEMPOTENCY_CONFLICT":
    case "HOSTING_SECRET_INVALID":
    case "HOSTING_IMAGE_REFERENCE_INVALID": return 409;
    case "HOSTING_TEMPLATE_UNAVAILABLE":
    case "HOSTING_SECRET_UNAVAILABLE":
    case "HOSTING_SECRET_REFERENCE_INVALID":
    case "HOSTING_NOT_CONFIGURED": return 503;
    case "HOSTING_DEPLOYMENT_FAILED": return 502;
    default: return 500;
  }
}

export async function hostingRoutes(
  app: FastifyInstance,
  options: {
    runtime: HostingProvisioningRuntime | null;
    lifecycleService?: Pick<HostingLifecycleService, "inspect" | "stop" | "remove"> | undefined;
  },
): Promise<void> {
  const lifecycleService = options.lifecycleService ?? (options.runtime
    ? new HostingLifecycleService(pool, options.runtime)
    : null);

  app.get<{ Params: { tenantId: string } }>(
    "/admin/platform/tenants/:tenantId/hosting",
    async (request, reply) => {
      const tenantId = request.params.tenantId.trim();
      if (!tenantIdPattern.test(tenantId)) return reply.code(400).send({ error: "INVALID_INPUT" });

      // Hosting inventory is part of the global control plane and is restricted
      // to the same platform-owner role as resource creation.
      await requirePlatformRole(request.headers, ["platform_owner"]);
      const tenant = await getPlatformTenant(tenantId);
      if (!tenant) return reply.code(404).send({ error: "TENANT_NOT_FOUND" });

      const [deployments, events] = await Promise.all([
        pool.query<{
          id: string; provider: string; template: string; template_version: string;
          provider_resource_id: string | null; state: string; attempt_count: number;
          error_code: string | null; last_deployed_at: Date | string | null;
          last_inspected_at: Date | string | null; next_reconcile_at: Date | string;
          reconcile_failure_count: number; created_at: Date | string; updated_at: Date | string;
        }>(
          "SELECT id::text,provider,template,template_version,provider_resource_id,state,attempt_count," +
          "error_code,last_deployed_at,last_inspected_at,next_reconcile_at,reconcile_failure_count,created_at,updated_at " +
          "FROM public.tenant_hosting_deployments WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 20",
          [tenantId],
        ),
        pool.query<{
          id: string; deployment_id: string; event_type: string; from_state: string | null;
          to_state: string | null; actor_type: string; actor_id: string; occurred_at: Date | string;
          metadata: unknown;
        }>(
          "SELECT id::text,deployment_id::text,event_type,from_state,to_state,actor_type,actor_id,occurred_at,metadata " +
          "FROM public.tenant_hosting_deployment_events WHERE tenant_id=$1 ORDER BY occurred_at DESC LIMIT 50",
          [tenantId],
        ),
      ]);

      const allowedMetadata = new Set([
        "template", "attempt", "reason", "provider", "errorCode",
        "templateVersion", "state", "attemptCount", "reused", "providerState",
        "lastDeployedAt", "failureCount", "retryInSeconds", "providerResourceId",
        "persistentVolumesDeleted", "providerWasAlreadyAbsent",
      ]);
      const safeMetadata = (value: unknown): Record<string, string | number | boolean | null> => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return {};
        return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
          if (!allowedMetadata.has(key)) return [];
          if (item === null || typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
            return [[key, item]];
          }
          return [];
        }));
      };
      const iso = (value: Date | string | null): string | null => {
        if (value === null) return null;
        const date = value instanceof Date ? value : new Date(value);
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
      };

      return reply.send({
        providerConfigured: options.runtime !== null,
        deployments: deployments.rows.map((row) => ({
          id: row.id,
          provider: row.provider,
          template: row.template,
          templateVersion: row.template_version,
          resourceId: row.provider_resource_id,
          state: row.state,
          attemptCount: row.attempt_count,
          errorCode: row.error_code,
          lastDeployedAt: iso(row.last_deployed_at),
          lastInspectedAt: iso(row.last_inspected_at),
          nextReconcileAt: iso(row.next_reconcile_at),
          reconcileFailureCount: row.reconcile_failure_count,
          createdAt: iso(row.created_at),
          updatedAt: iso(row.updated_at),
        })),
        events: events.rows.map((row) => ({
          id: row.id,
          deploymentId: row.deployment_id,
          eventType: row.event_type,
          fromState: row.from_state,
          toState: row.to_state,
          actorType: row.actor_type,
          actorId: row.actor_id,
          occurredAt: iso(row.occurred_at),
          metadata: safeMetadata(row.metadata),
        })),
      });
    },
  );

  app.post<{
    Params: { tenantId: string; deploymentId: string };
    Body: { reason: string };
  }>(
    "/admin/platform/tenants/:tenantId/hosting/deployments/:deploymentId/inspect",
    async (request, reply) => {
      const tenantId = request.params.tenantId.trim();
      const deploymentId = request.params.deploymentId.trim();
      const body = request.body as unknown;
      if (!tenantIdPattern.test(tenantId) || !tenantIdPattern.test(deploymentId) ||
          !body || typeof body !== "object" || Array.isArray(body) ||
          Object.keys(body).join(",") !== "reason" ||
          typeof (body as Record<string, unknown>).reason !== "string") {
        return reply.code(400).send({ error: "INVALID_INPUT" });
      }
      const reason = (body as { reason: string }).reason.trim();
      if (reason.length < 8 || reason.length > 500) return reply.code(400).send({ error: "HOSTING_REASON_INVALID" });

      const operator = await requirePlatformRole(request.headers, ["platform_owner"]);
      const tenant = await getPlatformTenant(tenantId);
      if (!tenant) return reply.code(404).send({ error: "TENANT_NOT_FOUND" });
      if (!options.runtime || !lifecycleService) return reply.code(503).send({ error: "HOSTING_NOT_CONFIGURED" });

      const auditBase = {
        actorType: "user" as const,
        actorId: operator.userId,
        actorRole: operator.role,
        tenantId,
        resourceType: "tenant_hosting_deployment",
        resourceId: deploymentId,
        requestId: request.id,
        metadata: { provider: options.runtime.providerId, reason },
      };
      await auditWriter.append({
        ...auditBase,
        action: "tenant.hosting.inspect.requested",
        outcome: "succeeded",
      });

      try {
        const inspection = await lifecycleService.inspect({
          tenantId,
          tenantSlug: tenant.slug,
          deploymentId,
        });
        await auditWriter.append({
          ...auditBase,
          action: "tenant.hosting.inspect.completed",
          outcome: "succeeded",
          metadata: { ...auditBase.metadata, providerState: inspection.providerState },
        }).catch((auditError: unknown) => {
          request.log.error({
            auditAction: "tenant.hosting.inspect.completed",
            errorType: auditError instanceof Error ? auditError.name : "UnknownError",
          }, "Hosting inspection completion audit could not be persisted");
        });
        return reply.send({ inspection });
      } catch (error) {
        if (error instanceof HostingLifecycleError) {
          await auditWriter.append({
            ...auditBase,
            action: "tenant.hosting.inspect.failed",
            outcome: "failed",
            metadata: { ...auditBase.metadata, errorCode: error.code },
          }).catch(() => undefined);
          return reply.code(error.statusCode).send({ error: error.code });
        }
        request.log.error({ errorType: error instanceof Error ? error.name : "UnknownError" }, "Hosting inspection failed unexpectedly");
        await auditWriter.append({
          ...auditBase,
          action: "tenant.hosting.inspect.failed",
          outcome: "failed",
          metadata: { ...auditBase.metadata, errorCode: "HOSTING_INSPECTION_FAILED" },
        }).catch(() => undefined);
        return reply.code(500).send({ error: "HOSTING_INSPECTION_FAILED" });
      }
    },
  );

  for (const action of ["stop", "remove"] as const) {
    app.post<{
      Params: { tenantId: string; deploymentId: string };
      Body: { reason: string; confirmDataRetained?: true };
    }>(
      `/admin/platform/tenants/:tenantId/hosting/deployments/:deploymentId/${action}`,
      async (request, reply) => {
        const tenantId = request.params.tenantId.trim();
        const deploymentId = request.params.deploymentId.trim();
        const body = request.body as unknown;
        const expectedKeys = action === "remove" ? "confirmDataRetained,reason" : "reason";
        if (!tenantIdPattern.test(tenantId) || !tenantIdPattern.test(deploymentId) ||
            !body || typeof body !== "object" || Array.isArray(body) ||
            Object.keys(body).sort().join(",") !== expectedKeys ||
            typeof (body as Record<string, unknown>).reason !== "string" ||
            (action === "remove" && (body as Record<string, unknown>).confirmDataRetained !== true)) {
          return reply.code(400).send({ error: "INVALID_INPUT" });
        }
        const reason = (body as { reason: string }).reason.trim();
        if (reason.length < 8 || reason.length > 500) return reply.code(400).send({ error: "HOSTING_REASON_INVALID" });

        const operator = await requirePlatformRole(request.headers, ["platform_owner"]);
        const tenant = await getPlatformTenant(tenantId);
        if (!tenant) return reply.code(404).send({ error: "TENANT_NOT_FOUND" });
        if (action === "remove" && tenant.status !== "suspended") {
          await auditWriter.append({
            actorType: "user",
            actorId: operator.userId,
            actorRole: operator.role,
            tenantId,
            resourceType: "tenant_hosting_deployment",
            resourceId: deploymentId,
            requestId: request.id,
            action: "tenant.hosting.remove.denied",
            outcome: "denied",
            metadata: { reason, errorCode: "HOSTING_TENANT_MUST_BE_SUSPENDED" },
          });
          return reply.code(409).send({ error: "HOSTING_TENANT_MUST_BE_SUSPENDED" });
        }
        if (!options.runtime || !lifecycleService) return reply.code(503).send({ error: "HOSTING_NOT_CONFIGURED" });

        const auditBase = {
          actorType: "user" as const,
          actorId: operator.userId,
          actorRole: operator.role,
          tenantId,
          resourceType: "tenant_hosting_deployment",
          resourceId: deploymentId,
          requestId: request.id,
          metadata: {
            provider: options.runtime.providerId,
            reason,
            ...(action === "remove" ? { persistentVolumesDeleted: false } : {}),
          },
        };
        await auditWriter.append({
          ...auditBase,
          action: `tenant.hosting.${action}.requested`,
          outcome: "succeeded",
        });

        try {
          const result = await lifecycleService[action]({
            tenantId,
            tenantSlug: tenant.slug,
            deploymentId,
            actorId: operator.userId,
            requestId: request.id,
            reason,
          });
          await auditWriter.append({
            ...auditBase,
            action: `tenant.hosting.${action}.completed`,
            outcome: "succeeded",
            metadata: {
              ...auditBase.metadata,
              alreadyApplied: result.alreadyApplied,
              removed: result.removed,
            },
          }).catch((auditError: unknown) => {
            request.log.error({
              auditAction: `tenant.hosting.${action}.completed`,
              errorType: auditError instanceof Error ? auditError.name : "UnknownError",
            }, "Hosting lifecycle completion audit could not be persisted");
          });
          return reply.send({ deployment: result, persistentVolumesRetained: action === "remove" });
        } catch (error) {
          if (error instanceof HostingLifecycleError) {
            await auditWriter.append({
              ...auditBase,
              action: `tenant.hosting.${action}.failed`,
              outcome: "failed",
              metadata: { ...auditBase.metadata, errorCode: error.code },
            }).catch(() => undefined);
            return reply.code(error.statusCode).send({ error: error.code });
          }
          request.log.error({
            action,
            errorType: error instanceof Error ? error.name : "UnknownError",
          }, "Hosting lifecycle operation failed unexpectedly");
          await auditWriter.append({
            ...auditBase,
            action: `tenant.hosting.${action}.failed`,
            outcome: "failed",
            metadata: { ...auditBase.metadata, errorCode: "HOSTING_LIFECYCLE_OPERATION_FAILED" },
          }).catch(() => undefined);
          return reply.code(500).send({ error: "HOSTING_LIFECYCLE_OPERATION_FAILED" });
        }
      },
    );
  }

  app.post<{ Params: { tenantId: string }; Body: { template: "wordpress" | "node-nextjs" | "ecommerce" } }>(
    "/admin/platform/tenants/:tenantId/hosting/provision",
    async (request, reply) => {
      const tenantId = request.params.tenantId.trim();
      if (!tenantIdPattern.test(tenantId)) return reply.code(400).send({ error: "INVALID_INPUT" });

      const parsed = hostingProvisionInputSchema.safeParse(request.body ?? {});
      const idempotencyHeader = request.headers["idempotency-key"];
      const idempotencyKey = typeof idempotencyHeader === "string" ? idempotencyHeader.trim() : "";
      if (!parsed.success || !idempotencyKeyPattern.test(idempotencyKey)) {
        return reply.code(400).send({
          error: "INVALID_INPUT",
          ...(parsed.success ? { message: "A valid Idempotency-Key header is required." } : { details: parsed.error.flatten() }),
        });
      }

      // This is deliberately platform-owner-only. Tenant owners/admins and
      // platform support/admin roles cannot create hosting resources.
      const operator = await requirePlatformRole(request.headers, ["platform_owner"]);
      const tenant = await getPlatformTenant(tenantId);
      if (!tenant) return reply.code(404).send({ error: "TENANT_NOT_FOUND" });
      if (tenant.status !== "active") {
        await auditWriter.append({
          actorType: "user",
          actorId: operator.userId,
          actorRole: operator.role,
          tenantId,
          action: "tenant.hosting.provision.denied",
          resourceType: "tenant_hosting_deployment",
          outcome: "denied",
          requestId: request.id,
          metadata: { template: parsed.data.template, reason: "tenant_not_active" },
        });
        return reply.code(409).send({ error: "TENANT_NOT_ACTIVE" });
      }
      const runtime = options.runtime;
      if (!runtime) return reply.code(503).send({ error: "HOSTING_NOT_CONFIGURED" });

      const auditBase = {
        actorType: "user" as const,
        actorId: operator.userId,
        actorRole: operator.role,
        tenantId,
        resourceType: "tenant_hosting_deployment",
        requestId: request.id,
        metadata: { template: parsed.data.template, provider: runtime.providerId },
      };
      // Fail closed: do not contact Dokploy unless the intent was recorded.
      await auditWriter.append({
        ...auditBase,
        action: "tenant.hosting.provision.requested",
        outcome: "succeeded",
      });

      try {
        const loaded = await runtime.loadTemplate(parsed.data.template);
        const result = await runtime.provision({
          tenantId,
          template: parsed.data.template,
          templateVersion: loaded.templateVersion,
          idempotencyKey,
          composeFile: loaded.composeFile,
          environmentSecretRef: tenantHostingDockerSecretReference(tenantId, parsed.data.template),
          actorType: "user",
          actorId: operator.userId,
          requestId: request.id,
        });

        await auditWriter.append({
          ...auditBase,
          action: "tenant.hosting.provision.completed",
          resourceId: result.reference.resourceId,
          outcome: "succeeded",
          metadata: {
            template: parsed.data.template,
            provider: runtime.providerId,
            templateVersion: loaded.templateVersion,
            state: result.state,
            attemptCount: result.attemptCount,
            reused: result.reused,
          },
        }).catch((auditError: unknown) => {
          request.log.error({
            auditAction: "tenant.hosting.provision.completed",
            errorType: auditError instanceof Error ? auditError.name : "UnknownError",
          }, "Hosting provisioning completion audit could not be persisted");
        });

        return reply.code(202).send({
          deployment: {
            provider: result.reference.provider,
            resourceId: result.reference.resourceId,
            template: parsed.data.template,
            templateVersion: loaded.templateVersion,
            state: result.state,
            attemptCount: result.attemptCount,
            reused: result.reused,
          },
        });
      } catch (error) {
        const code = errorCode(error);
        await auditWriter.append({
          ...auditBase,
          action: "tenant.hosting.provision.failed",
          outcome: "failed",
          metadata: { template: parsed.data.template, provider: runtime.providerId, errorCode: code },
        }).catch((auditError: unknown) => {
          request.log.error({
            auditAction: "tenant.hosting.provision.failed",
            errorType: auditError instanceof Error ? auditError.name : "UnknownError",
          }, "Hosting provisioning failure audit could not be persisted");
        });
        const status = errorStatus(code);
        return reply.code(status).send({
          error: code,
          message: status >= 500 ? "Hosting provisioning could not be completed." : "The hosting provisioning request could not be completed.",
        });
      }
    },
  );
}
