import type { FastifyInstance } from "fastify";
import { PostgresAuditEventWriter } from "@bazion/audit";
import { resolveIdentityCollisionInputSchema } from "@bazion/api-contracts";
import { requirePlatformRole } from "@bazion/auth";
import { pool } from "../../lib/database.js";

const auditWriter = new PostgresAuditEventWriter(pool);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function adminIdentityRoutes(app: FastifyInstance): Promise<void> {
  app.get("/admin/platform/identity/collisions", async (request, reply) => {
    await requirePlatformRole(request.headers, ["platform_owner", "platform_admin", "platform_support"]);
    const query = (request.query ?? {}) as Record<string, unknown>;
    const rawStatus = typeof query.status === "string" ? query.status : undefined;
    const status = rawStatus === "open" || rawStatus === "resolved_linked" || rawStatus === "resolved_rejected"
      ? rawStatus
      : undefined;
    const { listIdentityCollisionsForSupport } = await import("@bazion/auth/server");
    const items = await listIdentityCollisionsForSupport(status ? { status } : {});
    return reply.send({ items });
  });

  app.post<{ Params: { collisionId: string } }>(
    "/admin/platform/identity/collisions/:collisionId/resolve",
    async (request, reply) => {
      const operator = await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
      const collisionId = request.params.collisionId.trim();
      if (!uuidPattern.test(collisionId)) {
        return reply.code(400).send({ error: "INVALID_INPUT", message: "Invalid identity collision identifier." });
      }

      const parsed = resolveIdentityCollisionInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_INPUT",
          message: parsed.error.issues[0]?.message ?? "Invalid collision resolution payload.",
        });
      }

      const { IdentityLifecycleError, resolveIdentityCollisionForSupport } = await import("@bazion/auth/server");
      try {
        const resolved = await resolveIdentityCollisionForSupport({
          collisionId,
          actorUserId: operator.userId,
          action: parsed.data.action,
          ...(parsed.data.targetUserId ? { targetUserId: parsed.data.targetUserId } : {}),
          note: parsed.data.note,
        });

        await auditWriter.append({
          actorType: "user",
          actorId: operator.userId,
          actorRole: operator.role,
          action: "platform.identity.collision.resolve",
          resourceType: "identity_link_collision",
          resourceId: collisionId,
          outcome: "succeeded",
          requestId: request.id,
          metadata: { resolutionAction: parsed.data.action, nextStatus: resolved.status },
        }).catch(() => undefined);

        return reply.send({ collision: resolved });
      } catch (error) {
        if (error instanceof IdentityLifecycleError) {
          return reply.code(error.statusCode).send({ error: error.code, message: error.message });
        }
        throw error;
      }
    },
  );
}
