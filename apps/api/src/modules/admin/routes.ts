import type { FastifyInstance, FastifyRequest } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { count, eq } from "drizzle-orm";
import { requireActiveTenantPermission, requirePlatformRole, type ActiveTenantContext } from "@bazion/auth";
import { auth, reconcileProvisioningTenants } from "@bazion/auth/server";
import { orders, products } from "@bazion/database";
import { invitationInputSchema, memberListQuerySchema, memberRoleInputSchema, provisioningReconciliationInputSchema } from "./policy.js";
import { withTenantTransaction } from "../../lib/database.js";

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
    const result = await reconcileProvisioningTenants(parsed.data);
    request.log.info({
      actorUserId: operator.userId,
      scanned: result.scanned,
      activated: result.activated,
      unmatched: result.unmatched.length,
      conflicted: result.conflicted.length,
    }, "Tenant provisioning reconciliation completed");
    return reply.send(result);
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
    const invitation = await auth.api.createInvitation({
      body: {
        email: parsed.data.email,
        role: parsed.data.role,
        organizationId: context.organizationId,
      },
      headers: authHeaders(request),
    });
    return reply.code(201).send(invitation);
  });

  app.delete<{ Params: { invitationId: string } }>("/admin/invitations/:invitationId", async (request, reply) => {
    const invitationId = request.params.invitationId.trim();
    if (!invitationId || invitationId.length > 128) {
      return reply.code(400).send({ error: "INVALID_INPUT" });
    }
    const context = await requirePermission(request, { invitation: ["cancel"] });
    const result = await auth.api.cancelInvitation({
      body: { invitationId },
      headers: authHeaders(request),
    });
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
    const result = await auth.api.updateMemberRole({
      body: {
        memberId,
        role: parsed.data.role,
        organizationId: context.organizationId,
      },
      headers: authHeaders(request),
    });
    return reply.send(result);
  });

  app.delete<{ Params: { userId: string } }>("/admin/members/:userId", async (request, reply) => {
    const userId = request.params.userId.trim();
    if (!userId || userId.length > 128) {
      return reply.code(400).send({ error: "INVALID_INPUT" });
    }
    const context = await requirePermission(request, { member: ["delete"] });
    const result = await auth.api.removeMember({
      body: {
        memberIdOrEmail: userId,
        organizationId: context.organizationId,
      },
      headers: authHeaders(request),
    });
    return reply.send(result);
  });
}
