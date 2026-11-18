import {
  analyticsEvents,
  analyticsPolicies,
} from "@bazion/database";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  DEFAULT_ANALYTICS_RETENTION_DAYS,
  prepareAnalyticsEvent,
  summarizeAnalyticsEvents,
  validateAnalyticsPolicyInput,
} from "@bazion/analytics";
import { PostgresAuditEventWriter } from "@bazion/audit";
import { requireActiveTenantPermission } from "@bazion/auth";
import type { AppConfig } from "../../config.js";
import { pool, withTenantTransaction } from "../../lib/database.js";
import { isTenantModuleEnabled } from "../../lib/tenant-modules.js";
import { resolveRequestTenantId } from "../../lib/tenant-resolution.js";

interface RouteOptions {
  config: AppConfig;
}

const auditWriter = new PostgresAuditEventWriter(pool);

const trackEventBodySchema = z.object({
  name: z.string().trim().min(2).max(80),
  path: z.string().trim().max(512).default("/"),
  actorId: z.string().trim().max(128).nullable().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
}).strict();

async function assertAnalyticsEnabled(tenantId: string): Promise<void> {
  if (!(await isTenantModuleEnabled(tenantId, "analytics"))) {
    throw Object.assign(new Error("The analytics module is disabled for this tenant."), {
      statusCode: 404,
      code: "TENANT_MODULE_DISABLED",
    });
  }
}

export async function analyticsRoutes(app: FastifyInstance, { config }: RouteOptions): Promise<void> {
  app.post("/public/analytics/events", {
    config: {
      rateLimit: {
        max: 120,
        timeWindow: "1 minute",
        keyGenerator: (request: FastifyRequest) => request.ip,
      },
    },
  }, async (request, reply) => {
    const tenantId = await resolveRequestTenantId(request, config);
    await assertAnalyticsEnabled(tenantId);

    const parsed = trackEventBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });
    }

    const result = await withTenantTransaction(tenantId, async (tx) => {
      const [policy] = await tx
        .select()
        .from(analyticsPolicies)
        .where(eq(analyticsPolicies.tenantId, tenantId))
        .limit(1);

      if (policy && !policy.enabled) return { kind: "disabled" as const };
      const retentionDays = policy?.retentionDays ?? DEFAULT_ANALYTICS_RETENTION_DAYS;

      const prepared = prepareAnalyticsEvent(
        {
          name: parsed.data.name,
          path: parsed.data.path,
          actorId: parsed.data.actorId ?? null,
          properties: parsed.data.properties ?? {},
        },
        { retentionDays },
      );

      const [inserted] = await tx
        .insert(analyticsEvents)
        .values({
          tenantId,
          eventName: prepared.eventName,
          path: prepared.path,
          actorId: prepared.actorId,
          propertiesJson: prepared.properties,
          occurredAt: prepared.occurredAt,
          retentionExpiresAt: prepared.retentionExpiresAt,
        })
        .returning({ id: analyticsEvents.id });
      return { kind: "recorded" as const, id: inserted?.id ?? null };
    });

    if (result.kind === "disabled") {
      return reply.code(202).send({ recorded: false, reason: "ANALYTICS_COLLECTION_PAUSED" });
    }
    return reply.code(201).send({ recorded: true, id: result.id });
  });

  app.get<{ Querystring: { days?: string } }>("/admin/analytics/summary", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.headers, { analytics: ["read"] });
    await assertAnalyticsEnabled(context.tenantId);

    const days = Math.min(Math.max(Number(request.query.days) || 30, 1), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const data = await withTenantTransaction(context.tenantId, async (tx) => {
      const rows = await tx
        .select({
          eventName: analyticsEvents.eventName,
          path: analyticsEvents.path,
        })
        .from(analyticsEvents)
        .where(and(eq(analyticsEvents.tenantId, context.tenantId), gte(analyticsEvents.occurredAt, since)))
        .orderBy(desc(analyticsEvents.occurredAt))
        .limit(5000);

      const [policy] = await tx
        .select()
        .from(analyticsPolicies)
        .where(eq(analyticsPolicies.tenantId, context.tenantId))
        .limit(1);

      return { rows, policy };
    });

    const summary = summarizeAnalyticsEvents(data.rows);
    reply.header("Cache-Control", "no-store");
    return reply.send({
      days,
      since: since.toISOString(),
      summary,
      policy: data.policy ?? {
        tenantId: context.tenantId,
        enabled: true,
        retentionDays: DEFAULT_ANALYTICS_RETENTION_DAYS,
        updatedAt: null,
      },
    });
  });

  app.get<{ Querystring: { limit?: string; eventName?: string } }>("/admin/analytics/export", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.headers, { analytics: ["export"] });
    await assertAnalyticsEnabled(context.tenantId);

    const limit = Math.min(Math.max(Number(request.query.limit) || 250, 1), 1000);
    const eventName = request.query.eventName?.trim();

    const items = await withTenantTransaction(context.tenantId, (tx) =>
      tx
        .select({
          id: analyticsEvents.id,
          eventName: analyticsEvents.eventName,
          path: analyticsEvents.path,
          actorId: analyticsEvents.actorId,
          properties: analyticsEvents.propertiesJson,
          occurredAt: analyticsEvents.occurredAt,
          retentionExpiresAt: analyticsEvents.retentionExpiresAt,
        })
        .from(analyticsEvents)
        .where(and(
          eq(analyticsEvents.tenantId, context.tenantId),
          sql`${analyticsEvents.retentionExpiresAt} > now()`,
          ...(eventName ? [eq(analyticsEvents.eventName, eventName)] : []),
        ))
        .orderBy(desc(analyticsEvents.occurredAt))
        .limit(limit),
    );

    try {
      await auditWriter.append({
        actorType: "user",
        actorId: context.userId,
        actorRole: context.roles.join(","),
        tenantId: context.tenantId,
        action: "analytics.events.exported",
        resourceType: "analytics_events",
        outcome: "succeeded",
        requestId: request.id,
        metadata: { count: items.length },
      });
    } catch {
      // Do not fail export if audit log hits transient contention.
    }

    reply.header("Cache-Control", "no-store");
    reply.header("Content-Disposition", 'attachment; filename="analytics-events.json"');
    return reply.send({ exportedAt: new Date().toISOString(), count: items.length, items });
  });

  app.get("/admin/analytics/policy", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.headers, { analytics: ["read"] });
    await assertAnalyticsEnabled(context.tenantId);
    const [policy] = await withTenantTransaction(context.tenantId, (tx) =>
      tx.select().from(analyticsPolicies).where(eq(analyticsPolicies.tenantId, context.tenantId)).limit(1));
    reply.header("Cache-Control", "no-store");
    return reply.send({
      policy: policy ?? {
        tenantId: context.tenantId,
        enabled: true,
        retentionDays: DEFAULT_ANALYTICS_RETENTION_DAYS,
        updatedAt: null,
      },
    });
  });

  app.put("/admin/analytics/policy", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.headers, { analytics: ["delete"] });
    await assertAnalyticsEnabled(context.tenantId);

    let validated: ReturnType<typeof validateAnalyticsPolicyInput>;
    try {
      validated = validateAnalyticsPolicyInput(request.body);
    } catch (error) {
      return reply.code(400).send({
        error: "INVALID_INPUT",
        message: error instanceof Error ? error.message : "Invalid analytics policy payload.",
      });
    }

    const updatedAt = new Date();
    const [saved] = await withTenantTransaction(context.tenantId, (tx) =>
      tx
        .insert(analyticsPolicies)
        .values({
          tenantId: context.tenantId,
          enabled: validated.enabled,
          retentionDays: validated.retentionDays,
          updatedBy: context.userId,
          updatedAt,
        })
        .onConflictDoUpdate({
          target: analyticsPolicies.tenantId,
          set: {
            enabled: validated.enabled,
            retentionDays: validated.retentionDays,
            updatedBy: context.userId,
            updatedAt,
          },
        })
        .returning());

    try {
      await auditWriter.append({
        actorType: "user",
        actorId: context.userId,
        actorRole: context.roles.join(","),
        tenantId: context.tenantId,
        action: "analytics.policy.updated",
        resourceType: "analytics_policies",
        resourceId: context.tenantId,
        outcome: "succeeded",
        requestId: request.id,
        metadata: { enabled: validated.enabled, retentionDays: validated.retentionDays },
      });
    } catch {
      // Ignore transient audit failure.
    }

    reply.header("Cache-Control", "no-store");
    return reply.send({ policy: saved });
  });

  app.delete("/admin/analytics/events", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.headers, { analytics: ["delete"] });
    await assertAnalyticsEnabled(context.tenantId);

    const deleted = await withTenantTransaction(context.tenantId, (tx) =>
      tx
        .delete(analyticsEvents)
        .where(eq(analyticsEvents.tenantId, context.tenantId))
        .returning({ id: analyticsEvents.id }));

    try {
      await auditWriter.append({
        actorType: "user",
        actorId: context.userId,
        actorRole: context.roles.join(","),
        tenantId: context.tenantId,
        action: "analytics.events.purged",
        resourceType: "analytics_events",
        outcome: "succeeded",
        requestId: request.id,
        metadata: { deletedCount: deleted.length },
      });
    } catch {
      // Ignore transient audit failure.
    }

    return reply.send({ purged: true, deletedCount: deleted.length });
  });
}
