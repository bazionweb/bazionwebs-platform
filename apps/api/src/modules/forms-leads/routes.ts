import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { and, desc, eq, sql } from "drizzle-orm";
import { PostgresAuditEventWriter } from "@bazion/audit";
import { siteEnquiries, siteEnquiryPolicies } from "@bazion/database";
import {
  prepareSiteEnquiry,
  siteEnquiryPolicyInputSchema,
  siteEnquiryStatusSchema,
  siteEnquiryUpdateSchema,
  websiteEnquirySchema,
} from "@bazion/forms";
import { requireActiveTenantPermission } from "@bazion/auth";
import type { AppConfig } from "../../config.js";
import { pool, withTenantTransaction } from "../../lib/database.js";
import { resolveRequestTenantId } from "../../lib/tenant-resolution.js";
import { isTenantModuleEnabled } from "../../lib/tenant-modules.js";

const auditWriter = new PostgresAuditEventWriter(pool);

interface RouteOptions {
  config: AppConfig;
}

interface EnquiryCursor {
  createdAt: string;
  id: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PAGE_SIZE = 500;

async function assertFormsLeadsEnabled(tenantId: string): Promise<void> {
  if (!(await isTenantModuleEnabled(tenantId, "forms-leads"))) {
    throw Object.assign(new Error("The forms and lead capture module is not enabled for this tenant."), {
      statusCode: 404,
      code: "FORMS_LEADS_MODULE_DISABLED",
    });
  }
}

function parseCursor(value: string | undefined): EnquiryCursor | null | undefined {
  if (!value) return null;
  if (value.length > 512) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<EnquiryCursor>;
    if (typeof parsed.createdAt !== "string" || parsed.createdAt.length > 64 || !Number.isFinite(Date.parse(parsed.createdAt)) ||
        typeof parsed.id !== "string" || !UUID_PATTERN.test(parsed.id)) return undefined;
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return undefined;
  }
}

function encodeCursor(cursor: EnquiryCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function parsePageSize(value: string | undefined): number | undefined {
  if (value === undefined) return 100;
  const size = Number(value);
  return Number.isInteger(size) && size >= 1 && size <= MAX_PAGE_SIZE ? size : undefined;
}

export async function formsLeadsRoutes(app: FastifyInstance, { config }: RouteOptions): Promise<void> {
  app.post("/public/site/enquiries", {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: "15 minutes",
        // Do not include the untrusted Host header: rotating hostnames can bypass the limiter.
        keyGenerator: (request: FastifyRequest) => request.ip,
      },
    },
  }, async (request, reply) => {
    const tenantId = await resolveRequestTenantId(request, config);
    await assertFormsLeadsEnabled(tenantId);

    const parsed = websiteEnquirySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "VALIDATION_ERROR",
        details: parsed.error.issues.map(({ path, message }) => ({ path, message })),
      });
    }

    // Do not retain honeypot submissions; a successful response avoids exposing the trap.
    if (parsed.data.companyWebsite.trim()) {
      return reply.code(201).send({ success: true, message: "Thank you. Your enquiry has been received." });
    }

    const result = await withTenantTransaction(tenantId, async (tx) => {
      const [policy] = await tx.select().from(siteEnquiryPolicies)
        .where(eq(siteEnquiryPolicies.tenantId, tenantId)).limit(1);
      if (!policy?.enabled || !policy.publishedAt || policy.privacyNotice.trim().length < 40) return "unavailable" as const;

      const prepared = prepareSiteEnquiry(parsed.data, new Date(), policy.retentionDays, policy.privacyNoticeVersion);
      if (prepared.kind === "stale-policy") return "stale-policy" as const;
      if (prepared.kind === "honeypot") return "accepted" as const;

      await tx.insert(siteEnquiries).values({ tenantId, ...prepared.enquiry });
      return "accepted" as const;
    });
    if (result === "unavailable") return reply.code(404).send({ error: "ENQUIRY_FORM_UNAVAILABLE" });
    if (result === "stale-policy") return reply.code(409).send({
      error: "PRIVACY_NOTICE_VERSION_MISMATCH",
      message: "Refresh the page before submitting your enquiry.",
    });
    return reply.code(201).send({ success: true, message: "Thank you. Your enquiry has been received." });
  });

  app.get("/public/site/enquiry-policy", async (request, reply) => {
    const tenantId = await resolveRequestTenantId(request, config);
    await assertFormsLeadsEnabled(tenantId);
    const [policy] = await withTenantTransaction(tenantId, (tx) => tx.select({
      enabled: siteEnquiryPolicies.enabled,
      privacyNotice: siteEnquiryPolicies.privacyNotice,
      privacyNoticeVersion: siteEnquiryPolicies.privacyNoticeVersion,
      publishedAt: siteEnquiryPolicies.publishedAt,
    }).from(siteEnquiryPolicies).where(eq(siteEnquiryPolicies.tenantId, tenantId)).limit(1));
    reply.header("Cache-Control", "no-store");
    if (!policy?.enabled || !policy.publishedAt) {
      return reply.send({ enabled: false, privacyNotice: "", privacyNoticeVersion: policy?.privacyNoticeVersion ?? "1.0.0" });
    }
    return reply.send({
      enabled: true,
      privacyNotice: policy.privacyNotice,
      privacyNoticeVersion: policy.privacyNoticeVersion,
    });
  });

  app.get("/admin/site/enquiry-policy", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.headers, { enquiryPolicy: ["read"] });
    await assertFormsLeadsEnabled(context.tenantId);
    const [policy] = await withTenantTransaction(context.tenantId, (tx) => tx.select({
      enabled: siteEnquiryPolicies.enabled,
      privacyNotice: siteEnquiryPolicies.privacyNotice,
      privacyNoticeVersion: siteEnquiryPolicies.privacyNoticeVersion,
      retentionDays: siteEnquiryPolicies.retentionDays,
      routingEmail: siteEnquiryPolicies.routingEmail,
      publishedAt: siteEnquiryPolicies.publishedAt,
      updatedAt: siteEnquiryPolicies.updatedAt,
    }).from(siteEnquiryPolicies).where(eq(siteEnquiryPolicies.tenantId, context.tenantId)).limit(1));
    reply.header("Cache-Control", "no-store");
    return reply.send({ policy: policy ?? null });
  });

  app.put("/admin/site/enquiry-policy", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.headers, { enquiryPolicy: ["update"] });
    await assertFormsLeadsEnabled(context.tenantId);
    const parsed = siteEnquiryPolicyInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "VALIDATION_ERROR",
        details: parsed.error.issues.map(({ path, message }) => ({ path, message })),
      });
    }
    const updatedAt = new Date();
    const publishedAt = parsed.data.enabled ? updatedAt : null;
    const values = {
      enabled: parsed.data.enabled,
      privacyNotice: parsed.data.privacyNotice,
      privacyNoticeVersion: parsed.data.privacyNoticeVersion,
      retentionDays: parsed.data.retentionDays,
      routingEmail: parsed.data.routingEmail?.trim() || null,
      publishedAt,
      updatedAt,
    };
    const [policy] = await withTenantTransaction(context.tenantId, (tx) => tx.insert(siteEnquiryPolicies)
      .values({ tenantId: context.tenantId, ...values })
      .onConflictDoUpdate({
        target: siteEnquiryPolicies.tenantId,
        set: values,
      })
      .returning({
        enabled: siteEnquiryPolicies.enabled,
        privacyNotice: siteEnquiryPolicies.privacyNotice,
        privacyNoticeVersion: siteEnquiryPolicies.privacyNoticeVersion,
        retentionDays: siteEnquiryPolicies.retentionDays,
        routingEmail: siteEnquiryPolicies.routingEmail,
        publishedAt: siteEnquiryPolicies.publishedAt,
        updatedAt: siteEnquiryPolicies.updatedAt,
      }));
    try {
      await auditWriter.append({
        actorType: "user",
        actorId: context.userId ?? "admin",
        actorRole: context.roles?.join(",") ?? null,
        tenantId: context.tenantId,
        action: "forms.enquiry_policy.updated",
        resourceType: "site_enquiry_policies",
        resourceId: context.tenantId,
        outcome: "succeeded",
        requestId: request.id,
        metadata: { enabled: parsed.data.enabled, retentionDays: parsed.data.retentionDays },
      });
    } catch { /* non-fatal */ }
    reply.header("Cache-Control", "no-store");
    return reply.send({ policy });
  });

  const listEnquiries = async (
    request: FastifyRequest<{ Querystring: { limit?: string; cursor?: string; status?: string } }>,
    reply: FastifyReply,
    exportMode = false,
  ) => {
    const context = await requireActiveTenantPermission(request.headers, { enquiry: [exportMode ? "export" : "read"] });

    const limit = parsePageSize(request.query.limit);
    const cursor = parseCursor(request.query.cursor);
    const statusFilter = request.query.status?.trim();
    const validStatus = statusFilter && statusFilter !== "all"
      ? siteEnquiryStatusSchema.safeParse(statusFilter)
      : null;
    if (validStatus && !validStatus.success) {
      return reply.code(400).send({ error: "INVALID_STATUS", message: "Invalid enquiry status filter." });
    }
    if (limit === undefined) return reply.code(400).send({ error: "INVALID_PAGE_SIZE", message: `Page size must be between 1 and ${MAX_PAGE_SIZE}.` });
    if (cursor === undefined) return reply.code(400).send({ error: "INVALID_CURSOR", message: "The enquiry export cursor is invalid." });

    const rows = await withTenantTransaction(context.tenantId, (tx) => tx
      .select({
        id: siteEnquiries.id,
        formId: siteEnquiries.formId,
        fullName: siteEnquiries.fullName,
        email: siteEnquiries.email,
        telephone: siteEnquiries.telephone,
        subject: siteEnquiries.subject,
        message: siteEnquiries.message,
        status: siteEnquiries.status,
        assignedTo: siteEnquiries.assignedTo,
        privacyConsentAt: siteEnquiries.privacyConsentAt,
        privacyNoticeVersion: siteEnquiries.privacyNoticeVersion,
        retentionExpiresAt: siteEnquiries.retentionExpiresAt,
        createdAt: siteEnquiries.createdAt,
        updatedAt: siteEnquiries.updatedAt,
        cursorTimestamp: sql<string>`${siteEnquiries.createdAt}::text`,
      })
      .from(siteEnquiries)
      .where(and(
        eq(siteEnquiries.tenantId, context.tenantId),
        sql`${siteEnquiries.retentionExpiresAt} > now()`,
        ...(validStatus?.success ? [eq(siteEnquiries.status, validStatus.data)] : []),
        ...(cursor ? [sql`(${siteEnquiries.createdAt} < ${cursor.createdAt}::timestamptz OR (${siteEnquiries.createdAt} = ${cursor.createdAt}::timestamptz AND ${siteEnquiries.id} < ${cursor.id}::uuid))`] : []),
      ))
      .orderBy(desc(siteEnquiries.createdAt), desc(siteEnquiries.id))
      .limit(limit + 1));

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    const nextCursor = hasMore && last ? encodeCursor({ createdAt: last.cursorTimestamp, id: last.id }) : null;
    const enquiries = page.map((row) => ({
      id: row.id,
      formId: row.formId,
      fullName: row.fullName,
      email: row.email,
      telephone: row.telephone,
      subject: row.subject,
      message: row.message,
      status: row.status ?? "new",
      assignedTo: row.assignedTo ?? null,
      privacyConsentAt: row.privacyConsentAt,
      privacyNoticeVersion: row.privacyNoticeVersion,
      retentionExpiresAt: row.retentionExpiresAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt ?? row.createdAt,
    }));
    reply.header("Cache-Control", "no-store");
    if (exportMode) {
      reply.header("Content-Disposition", "attachment; filename=site-enquiries-page.json");
      try {
        await auditWriter.append({
          actorType: "user",
          actorId: context.userId ?? "admin",
          actorRole: context.roles?.join(",") ?? null,
          tenantId: context.tenantId,
          action: "forms.enquiries.exported",
          resourceType: "site_enquiries",
          outcome: "succeeded",
          requestId: request.id,
          metadata: { count: enquiries.length },
        });
      } catch { /* non-fatal */ }
    }
    return reply.send({ enquiries, nextCursor, hasMore });
  };

  app.get<{ Querystring: { limit?: string; cursor?: string; status?: string } }>("/admin/site/enquiries", (request, reply) =>
    listEnquiries(request, reply));
  app.get<{ Querystring: { limit?: string; cursor?: string; status?: string } }>("/admin/site/enquiries/export", (request, reply) =>
    listEnquiries(request, reply, true));

  app.patch<{ Params: { id: string } }>("/admin/site/enquiries/:id", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.headers, { enquiry: ["update"] });
    if (!UUID_PATTERN.test(request.params.id)) return reply.code(404).send({ error: "ENQUIRY_NOT_FOUND" });
    const parsed = siteEnquiryUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });
    }
    const [updated] = await withTenantTransaction(context.tenantId, (tx) => tx.update(siteEnquiries)
      .set({
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.assignedTo !== undefined ? { assignedTo: parsed.data.assignedTo } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(siteEnquiries.id, request.params.id), eq(siteEnquiries.tenantId, context.tenantId)))
      .returning());
    if (!updated) return reply.code(404).send({ error: "ENQUIRY_NOT_FOUND" });
    try {
      await auditWriter.append({
        actorType: "user",
        actorId: context.userId ?? "admin",
        actorRole: context.roles?.join(",") ?? null,
        tenantId: context.tenantId,
        action: "forms.enquiry.updated",
        resourceType: "site_enquiries",
        resourceId: request.params.id,
        outcome: "succeeded",
        requestId: request.id,
        metadata: { status: updated.status },
      });
    } catch { /* non-fatal */ }
    return reply.send({ enquiry: updated });
  });

  app.delete<{ Params: { id: string } }>("/admin/site/enquiries/:id", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.headers, { enquiry: ["delete"] });
    if (!UUID_PATTERN.test(request.params.id)) return reply.code(404).send({ error: "ENQUIRY_NOT_FOUND" });

    const [deleted] = await withTenantTransaction(context.tenantId, (tx) => tx.delete(siteEnquiries)
      .where(and(eq(siteEnquiries.id, request.params.id), eq(siteEnquiries.tenantId, context.tenantId)))
      .returning({ id: siteEnquiries.id }));
    if (!deleted) return reply.code(404).send({ error: "ENQUIRY_NOT_FOUND" });
    try {
      await auditWriter.append({
        actorType: "user",
        actorId: context.userId ?? "admin",
        actorRole: context.roles?.join(",") ?? null,
        tenantId: context.tenantId,
        action: "forms.enquiry.deleted",
        resourceType: "site_enquiries",
        resourceId: request.params.id,
        outcome: "succeeded",
        requestId: request.id,
      });
    } catch { /* non-fatal */ }
    return reply.send({ success: true });
  });
}
