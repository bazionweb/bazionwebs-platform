import type { FastifyInstance, FastifyRequest } from "fastify";
import { PostgresAuditEventWriter, type AuditEvent } from "@bazion/audit";
import { fromNodeHeaders } from "better-auth/node";
import { count, eq } from "drizzle-orm";
import { requireActiveTenantPermission, requirePlatformRole, requirePlatformPermission, type ActiveTenantContext } from "@bazion/auth";
import { auth, reconcileProvisioningTenants, listPlatformTenants, getPlatformTenant, transitionPlatformTenant } from "@bazion/auth/server";
import { orders, products } from "@bazion/database";
import { invitationInputSchema, memberListQuerySchema, memberRoleInputSchema, provisioningReconciliationInputSchema, platformTenantListQuerySchema, platformTenantLifecycleInputSchema } from "./policy.js";
import { pool, withTenantTransaction } from "../../lib/database.js";

const auditWriter = new PostgresAuditEventWriter(pool);

async function withAudit<T>(
  request: FastifyRequest,
  event: Omit<AuditEvent, "action" | "outcome"> & { action: string },
  operation: () => Promise<T>,
): Promise<T> {
  // Fail closed before the protected operation if the audit store cannot accept
  // the intent record. Never place contact details, credentials or one-time URLs
  // in audit metadata.
  await auditWriter.append({ ...event, action: `${event.action}.requested`, outcome: "succeeded" });
  try {
    const result = await operation();
    try {
      await auditWriter.append({ ...event, action: `${event.action}.completed`, outcome: "succeeded" });
    } catch (auditError) {
      request.log.error({
        auditAction: event.action,
        errorType: auditError instanceof Error ? auditError.name : "UnknownError",
      }, "Audit completion event could not be persisted");
    }
    return result;
  } catch (error) {
    try {
      await auditWriter.append({ ...event, action: `${event.action}.failed`, outcome: "failed" });
    } catch (auditError) {
      request.log.error({
        auditAction: event.action,
        errorType: auditError instanceof Error ? auditError.name : "UnknownError",
      }, "Audit failure event could not be persisted");
    }
    throw error;
  }
}

function userAuditEvent(
  request: FastifyRequest,
  actor: { userId: string; role: string },
  resourceType: string,
  resourceId?: string | null,
  metadata?: Record<string, string | number | boolean | null>,
) {
  return {
    actorType: "user" as const,
    actorId: actor.userId,
    actorRole: actor.role,
    resourceType,
    ...(resourceId === undefined ? {} : { resourceId }),
    requestId: request.id,
    ...(metadata ? { metadata } : {}),
  };
}

function authHeaders(request: FastifyRequest) {
  return fromNodeHeaders(request.headers);
}

async function requirePermission(
  request: FastifyRequest,
  permissions: Parameters<typeof requireActiveTenantPermission>[1],
): Promise<ActiveTenantContext> {
  return requireActiveTenantPermission(request.headers, permissions);
}

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // Platform-level recovery operation. Client tenant roles cannot invoke it.
  app.post("/admin/platform/tenants/reconcile-provisioning", async (request, reply) => {
    const parsed = provisioningReconciliationInputSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });
    }
    const operator = await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
    const result = await withAudit(
      request,
      {
        ...userAuditEvent(request, operator, "tenant_registry", null, parsed.data),
        action: "tenant.provisioning.reconciliation",
        tenantId: null,
      },
      () => reconcileProvisioningTenants(parsed.data),
    );
    request.log.info({
      actorUserId: operator.userId,
      scanned: result.scanned,
      activated: result.activated,
      unmatched: result.unmatched.length,
      conflicted: result.conflicted.length,
    }, "Tenant provisioning reconciliation completed");
    return reply.send(result);
  });


  // Platform tenant directory. Query filters are validated and tenant IDs are
  // never accepted as authority; every operation is guarded by a platform permission.
  app.get("/admin/platform/tenants", async (request, reply) => {
    const parsed = platformTenantListQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });
    await requirePlatformPermission(request.headers, "tenant.list");
    return reply.send(await listPlatformTenants(parsed.data));
  });

  app.get<{ Params: { tenantId: string } }>("/admin/platform/tenants/:tenantId", async (request, reply) => {
    const tenantId = request.params.tenantId.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId)) {
      return reply.code(400).send({ error: "INVALID_INPUT" });
    }
    await requirePlatformPermission(request.headers, "tenant.read");
    const tenant = await getPlatformTenant(tenantId);
    if (!tenant) return reply.code(404).send({ error: "TENANT_NOT_FOUND" });
    return reply.send({ tenant });
  });

  app.patch<{ Params: { tenantId: string } }>("/admin/platform/tenants/:tenantId/lifecycle", async (request, reply) => {
    const tenantId = request.params.tenantId.trim();
    const parsed = platformTenantLifecycleInputSchema.safeParse(request.body);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId) || !parsed.success) {
      return reply.code(400).send({ error: "INVALID_INPUT", ...(parsed.success ? {} : { details: parsed.error.flatten() }) });
    }
    const permission = parsed.data.action === "suspend"
      ? "tenant.suspend"
      : parsed.data.action === "restore"
        ? "tenant.restore"
        : "tenant.close";
    const operator = await requirePlatformPermission(request.headers, permission);
    const result = await withAudit(
      request,
      {
        ...userAuditEvent(request, operator, "tenant", tenantId, { lifecycleAction: parsed.data.action }),
        action: `tenant.${parsed.data.action}`,
        tenantId,
      },
      () => transitionPlatformTenant({ tenantId, action: parsed.data.action }),
    );
    if (!result) return reply.code(409).send({ error: "TENANT_STATE_CONFLICT", message: "The tenant does not exist or is not in a state that permits this transition." });
    return reply.send({ tenant: result });
  });

  // Tenant identity is resolved from the signed-in session and active
  // organization. No request parameter can select another tenant.
  app.get("/admin/overview", async (request) => {
    const context = await requirePermission(request, { analytics: ["read"] });
    const metrics = await withTenantTransaction(context.tenantId, async (tx) => {
      const [productCount] = await tx.select({ value: count() }).from(products);
      const [activeProductCount] = await tx.select({ value: count() }).from(products)
        .where(eq(products.active, true));
      const [orderCount] = await tx.select({ value: count() }).from(orders);
      const [pendingOrderCount] = await tx.select({ value: count() }).from(orders)
        .where(eq(orders.status, "pending_payment"));
      const [paidOrderCount] = await tx.select({ value: count() }).from(orders)
        .where(eq(orders.status, "paid"));
      return {
        products: productCount?.value ?? 0,
        activeProducts: activeProductCount?.value ?? 0,
        orders: orderCount?.value ?? 0,
        pendingOrders: pendingOrderCount?.value ?? 0,
        paidOrders: paidOrderCount?.value ?? 0,
      };
    });

    return {
      tenant: {
        id: context.tenantId,
        slug: context.tenantSlug,
        name: context.tenantName,
        currency: context.currency,
      },
      organization: { id: context.organizationId, roles: context.roles },
      user: { id: context.userId, name: context.name, email: context.email },
      metrics,
    };
  });

  app.get<{ Querystring: { limit?: string; offset?: string } }>("/admin/members", async (request, reply) => {
    const parsed = memberListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });
    }
    const context = await requirePermission(request, { member: ["update"] });
    const result = await auth.api.listMembers({
      query: {
        organizationId: context.organizationId,
        limit: parsed.data.limit,
        offset: parsed.data.offset,
        sortBy: "createdAt",
        sortDirection: "desc",
      },
      headers: authHeaders(request),
    });
    return reply.send(result);
  });

  app.get("/admin/invitations", async (request) => {
    const context = await requirePermission(request, { invitation: ["create"] });
    return auth.api.listInvitations({
      query: { organizationId: context.organizationId },
      headers: authHeaders(request),
    });
  });

  app.post("/admin/invitations", async (request, reply) => {
    const parsed = invitationInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });
    }
    const context = await requirePermission(request, { invitation: ["create"] });
    const invitation = await withAudit(
      request,
      {
        ...userAuditEvent(request, { userId: context.userId, role: context.roles.join(",") }, "invitation", null, { role: parsed.data.role }),
        action: "tenant.invitation.created",
        tenantId: context.tenantId,
      },
      () => auth.api.createInvitation({
        body: {
          email: parsed.data.email,
          role: parsed.data.role,
          organizationId: context.organizationId,
        },
        headers: authHeaders(request),
      }),
    );
    return reply.code(201).send(invitation);
  });

  app.delete<{ Params: { invitationId: string } }>("/admin/invitations/:invitationId", async (request, reply) => {
    const invitationId = request.params.invitationId.trim();
    if (!invitationId || invitationId.length > 128) {
      return reply.code(400).send({ error: "INVALID_INPUT" });
    }
    const context = await requirePermission(request, { invitation: ["cancel"] });
    const result = await withAudit(
      request,
      {
        ...userAuditEvent(request, { userId: context.userId, role: context.roles.join(",") }, "invitation", invitationId),
        action: "tenant.invitation.cancelled",
        tenantId: context.tenantId,
      },
      () => auth.api.cancelInvitation({
        body: { invitationId },
        headers: authHeaders(request),
      }),
    );
    return reply.send(result);
  });

  app.patch<{ Params: { memberId: string } }>("/admin/members/:memberId/role", async (request, reply) => {
    const memberId = request.params.memberId.trim();
    const parsed = memberRoleInputSchema.safeParse(request.body);
    if (!memberId || memberId.length > 128 || !parsed.success) {
      return reply.code(400).send({
        error: "INVALID_INPUT",
        ...(parsed.success ? {} : { details: parsed.error.flatten() }),
      });
    }
    const context = await requirePermission(request, { member: ["update"] });
    const result = await withAudit(
      request,
      {
        ...userAuditEvent(request, { userId: context.userId, role: context.roles.join(",") }, "member", memberId, { assignedRole: parsed.data.role }),
        action: "tenant.member.role.updated",
        tenantId: context.tenantId,
      },
      () => auth.api.updateMemberRole({
        body: {
          memberId,
          role: parsed.data.role,
          organizationId: context.organizationId,
        },
        headers: authHeaders(request),
      }),
    );
    return reply.send(result);
  });

  app.delete<{ Params: { userId: string } }>("/admin/members/:userId", async (request, reply) => {
    const userId = request.params.userId.trim();
    if (!userId || userId.length > 128) {
      return reply.code(400).send({ error: "INVALID_INPUT" });
    }
    const context = await requirePermission(request, { member: ["delete"] });
    const result = await withAudit(
      request,
      {
        ...userAuditEvent(request, { userId: context.userId, role: context.roles.join(",") }, "member", userId),
        action: "tenant.member.removed",
        tenantId: context.tenantId,
      },
      () => auth.api.removeMember({
        body: {
          memberIdOrEmail: userId,
          organizationId: context.organizationId,
        },
        headers: authHeaders(request),
      }),
    );
    return reply.send(result);
  });
}
