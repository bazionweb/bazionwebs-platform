import type { FastifyInstance } from "fastify";
import { PostgresAuditEventWriter } from "@bazion/audit";
import { requirePlatformRole } from "@bazion/auth";
import { getPlatformTenant } from "@bazion/auth/server";
import type { TenantHostingDeploymentReference, TenantHostingDeploymentState, TenantHostingTemplate } from "@bazion/platform-contracts";
import { pool } from "../../lib/database.js";
import type { HostingProvisioningRuntime } from "./runtime.js";

const auditWriter = new PostgresAuditEventWriter(pool);
const tenantIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const deploymentIdPattern = tenantIdPattern;
const resourceIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/;
const templates = new Set<TenantHostingTemplate>(["wordpress", "node-nextjs", "ecommerce"]);
const recoverableStates = new Set<TenantHostingDeploymentState>(["provisioning", "ready", "deploying", "running", "stopped", "failed"]);

interface RecoveryRow {
  id: string;
  provider: string;
  template: TenantHostingTemplate;
  state: string;
  provider_resource_id: string | null;
  created_at: Date | string;
  lease_expires_at: Date | string | null;
}

interface SqlClient {
  query<T = Record<string, unknown>>(statement: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
  release(): void;
}

function iso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("HOSTING_RECOVERY_TIMESTAMP_INVALID");
  return date.toISOString();
}

export async function hostingRecoveryRoutes(
  app: FastifyInstance,
  options: { runtime: HostingProvisioningRuntime | null },
): Promise<void> {
  app.post<{
    Params: { tenantId: string; deploymentId: string };
    Body: { resourceId: string; resourceName: string };
  }>("/admin/platform/tenants/:tenantId/hosting/deployments/:deploymentId/recover", async (request, reply) => {
    const tenantId = request.params.tenantId.trim();
    const deploymentId = request.params.deploymentId.trim();
    const body = request.body as unknown;
    if (!tenantIdPattern.test(tenantId) || !deploymentIdPattern.test(deploymentId) ||
        !body || typeof body !== "object" || Array.isArray(body) ||
        Object.keys(body).sort().join(",") !== "resourceId,resourceName" ||
        typeof (body as Record<string, unknown>).resourceId !== "string" ||
        typeof (body as Record<string, unknown>).resourceName !== "string") {
      return reply.code(400).send({ error: "INVALID_INPUT" });
    }
    const resourceId = (body as { resourceId: string }).resourceId.trim();
    const resourceName = (body as { resourceName: string }).resourceName.trim();
    if (!resourceIdPattern.test(resourceId) || resourceName.length < 1 || resourceName.length > 128) {
      return reply.code(400).send({ error: "INVALID_INPUT" });
    }

    const operator = await requirePlatformRole(request.headers, ["platform_owner"]);
    const tenant = await getPlatformTenant(tenantId);
    if (!tenant) return reply.code(404).send({ error: "TENANT_NOT_FOUND" });
    if (tenant.status !== "active") return reply.code(409).send({ error: "TENANT_NOT_ACTIVE" });
    const runtime = options.runtime;
    if (!runtime) return reply.code(503).send({ error: "HOSTING_NOT_CONFIGURED" });

    const client = await pool.connect() as unknown as SqlClient;
    let deployment: RecoveryRow | undefined;
    try {
      const result = await client.query<RecoveryRow>(
        "SELECT id::text,provider,template,state,provider_resource_id,created_at,lease_expires_at " +
        "FROM public.tenant_hosting_deployments WHERE id=$1 AND tenant_id=$2",
        [deploymentId, tenantId],
      );
      deployment = result.rows[0];
    } finally {
      client.release();
    }
    if (!deployment) return reply.code(404).send({ error: "HOSTING_DEPLOYMENT_NOT_FOUND" });
    if (deployment.provider !== runtime.providerId) return reply.code(409).send({ error: "HOSTING_PROVIDER_MISMATCH" });
    if (deployment.state !== "unknown" || deployment.provider_resource_id !== null) {
      return reply.code(409).send({ error: "HOSTING_DEPLOYMENT_NOT_RECOVERABLE" });
    }
    const leaseExpiry = deployment.lease_expires_at === null ? null :
      deployment.lease_expires_at instanceof Date ? deployment.lease_expires_at.getTime() : Date.parse(deployment.lease_expires_at);
    if (leaseExpiry !== null && leaseExpiry > Date.now()) {
      return reply.code(409).send({ error: "HOSTING_PROVISIONING_IN_PROGRESS" });
    }
    if (!templates.has(deployment.template)) return reply.code(409).send({ error: "HOSTING_TEMPLATE_INVALID" });

    // Dokploy creates resources with this deterministic name. The operator must
    // inspect Dokploy and supply both the exact resource ID and matching name.
    // We then independently verify that the resource exists and can be inspected.
    const expectedName = `${tenant.slug}-${deployment.template}`;
    if (resourceName !== expectedName) return reply.code(409).send({ error: "HOSTING_RECOVERY_NAME_MISMATCH" });

    const auditBase = {
      actorType: "user" as const,
      actorId: operator.userId,
      actorRole: operator.role,
      tenantId,
      resourceType: "tenant_hosting_deployment",
      resourceId: deploymentId,
      requestId: request.id,
    };
    await auditWriter.append({
      ...auditBase,
      action: "tenant.hosting.recovery.requested",
      outcome: "succeeded",
      metadata: { provider: runtime.providerId, template: deployment.template, resourceName },
    });

    const reference: TenantHostingDeploymentReference = {
      provider: deployment.provider,
      resourceId,
      tenantId: tenantId as TenantHostingDeploymentReference["tenantId"],
      createdAt: iso(deployment.created_at),
    };
    let observed: Awaited<ReturnType<HostingProvisioningRuntime["inspect"]>>;
    try {
      observed = await runtime.inspect(reference);
    } catch {
      await auditWriter.append({
        ...auditBase,
        action: "tenant.hosting.recovery.failed",
        outcome: "failed",
        metadata: { provider: runtime.providerId, template: deployment.template, errorCode: "HOSTING_RESOURCE_NOT_VERIFIABLE" },
      }).catch(() => undefined);
      return reply.code(409).send({ error: "HOSTING_RESOURCE_NOT_VERIFIABLE" });
    }
    if (observed.reference.provider !== reference.provider ||
        observed.reference.resourceId !== reference.resourceId ||
        observed.reference.tenantId !== reference.tenantId ||
        observed.providerResourceName !== expectedName ||
        observed.providerEnvironmentId !== runtime.environmentId ||
        !recoverableStates.has(observed.state)) {
      return reply.code(409).send({ error: "HOSTING_RESOURCE_NOT_VERIFIABLE" });
    }

    const updateClient = await pool.connect() as unknown as SqlClient;
    try {
      await updateClient.query("BEGIN");
      const updated = await updateClient.query<{ id: string }>(
        "UPDATE public.tenant_hosting_deployments SET provider_resource_id=$3,state=$4,error_code=NULL," +
        "last_inspected_at=now(),next_reconcile_at=now(),updated_at=now() " +
        "WHERE id=$1 AND tenant_id=$2 AND state='unknown' AND provider_resource_id IS NULL " +
        "AND (lease_expires_at IS NULL OR lease_expires_at <= now()) RETURNING id::text",
        [deploymentId, tenantId, resourceId, observed.state],
      );
      if (updated.rowCount !== 1) {
        await updateClient.query("ROLLBACK");
        return reply.code(409).send({ error: "HOSTING_RECOVERY_CONFLICT" });
      }
      await updateClient.query(
        "INSERT INTO public.tenant_hosting_deployment_events " +
        "(deployment_id,tenant_id,event_type,from_state,to_state,actor_type,actor_id,request_id,metadata) " +
        "VALUES ($1,$2,'hosting.provisioning.resource_recovered','unknown',$3,'user',$4,$5,$6::jsonb)",
        [deploymentId,tenantId,observed.state,operator.userId,request.id,JSON.stringify({
          provider: runtime.providerId, template: deployment.template, recoveryMethod: "operator_verified_resource_id",
        })],
      );
      await updateClient.query("COMMIT");
    } catch (error) {
      await updateClient.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      updateClient.release();
    }

    await auditWriter.append({
      ...auditBase,
      action: "tenant.hosting.recovery.completed",
      outcome: "succeeded",
      metadata: { provider: runtime.providerId, template: deployment.template, state: observed.state },
    }).catch(() => undefined);

    return reply.code(200).send({
      deployment: {
        id: deploymentId,
        provider: runtime.providerId,
        resourceId,
        template: deployment.template,
        state: observed.state,
        lastDeployedAt: observed.lastDeployedAt,
        recovered: true,
      },
    });
  });
}
