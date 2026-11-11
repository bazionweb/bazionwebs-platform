import type { FastifyInstance } from "fastify";
import { PostgresAuditEventWriter } from "@bazion/audit";
import { requirePlatformRole } from "@bazion/auth";
import { getPlatformTenant } from "@bazion/auth/server";
import { pool } from "../../lib/database.js";
import { tenantHostingDockerSecretReference } from "./secrets.js";
import { hostingProvisionInputSchema } from "./policy.js";
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
  options: { runtime: HostingProvisioningRuntime | null },
): Promise<void> {
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
