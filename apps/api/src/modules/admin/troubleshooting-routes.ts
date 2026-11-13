import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { PostgresAuditEventWriter, type AuditEvent } from "@bazion/audit";
import { requirePlatformRole } from "@bazion/auth";
import {
  listPlatformUsers,
  forceVerifyPlatformUserEmail,
  revokePlatformUserSessions,
  generateEmergencyPasswordResetUrl,
} from "@bazion/auth/server";
import { createOutboxPayloadCodec, type NotificationPayload } from "@bazion/notifications";
import { DarajaClient } from "@bazion/payments";
import type { QueryResultRow } from "pg";
import { pool } from "../../lib/database.js";
import { currentDatabaseSchemaVersion, requiredDatabaseMigrations } from "@bazion/database";
import { diagnoseTenantDomainDns } from "./domain-verification.js";
import { platformModuleCatalog } from "./module-catalog.js";

function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@", 2);
  if (!domain) return "***";
  const prefix = local.slice(0, 1) || "*";
  return `${prefix}***@${domain}`;
}

function sanitizeExportSetting(settingKey: string, settingValue: string): string {
  if (/(secret|token|password|credential|private|api[-_]?key|webhook|dsn|passkey|signature)/i.test(settingKey)) {
    return "[REDACTED]";
  }
  return settingValue;
}

const auditWriter = new PostgresAuditEventWriter(pool);

async function safeQuery<T extends QueryResultRow = any>(queryString: string, params: unknown[] = []): Promise<{ rows: T[]; rowCount?: number | null }> {
  try {
    const res = await pool.query<T>(queryString, params);
    return res ?? { rows: [], rowCount: 0 };
  } catch {
    return { rows: [], rowCount: 0 };
  }
}

async function withAudit<T>(
  request: FastifyRequest,
  event: Omit<AuditEvent, "action" | "outcome"> & { action: string },
  operation: () => Promise<T>,
): Promise<T> {
  await auditWriter.append({ ...event, action: `${event.action}.requested`, outcome: "succeeded" });
  try {
    const result = await operation();
    try {
      await auditWriter.append({ ...event, action: `${event.action}.completed`, outcome: "succeeded" });
    } catch (auditError) {
      request.log.error({ auditAction: event.action, error: auditError }, "Audit completion event could not be persisted");
    }
    return result;
  } catch (error) {
    try {
      await auditWriter.append({ ...event, action: `${event.action}.failed`, outcome: "failed" });
    } catch (auditError) {
      request.log.error({ auditAction: event.action, error: auditError }, "Audit failure event could not be persisted");
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

let outboxCodec: ReturnType<typeof createOutboxPayloadCodec> | null = null;
if (process.env.NOTIFICATION_ENCRYPTION_KEY) {
  try {
    const buf = Buffer.from(process.env.NOTIFICATION_ENCRYPTION_KEY, "base64");
    if (buf.byteLength === 32) {
      outboxCodec = createOutboxPayloadCodec(buf);
    }
  } catch {
    // codec fallback
  }
}

function safeDecryptPayload(ciphertext: string): Partial<NotificationPayload> & { rawError?: string } {
  if (!outboxCodec) return { template: "encrypted", to: "[Encrypted - Key Missing]" };
  try {
    const decrypted = outboxCodec.decrypt(ciphertext);
    return JSON.parse(decrypted) as Partial<NotificationPayload>;
  } catch (err: unknown) {
    return { template: "error", to: "[Decryption Failed]", rawError: err instanceof Error ? err.message : "decryption_failed" };
  }
}

export async function troubleshootingRoutes(app: FastifyInstance): Promise<void> {
  // ─── 1. NOTIFICATION OUTBOX TROUBLESHOOTING ───────────────────────────────────

  app.get<{
    Querystring: {
      status?: string;
      channel?: string;
      search?: string;
      tenantId?: string;
      limit?: string;
      offset?: string;
    };
  }>("/admin/platform/troubleshoot/outbox", async (request, reply) => {
    await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);

    const statusFilter = request.query.status?.trim();
    const channelFilter = request.query.channel?.trim();
    const search = request.query.search?.trim();
    const tenantId = request.query.tenantId?.trim();
    const limit = Math.min(Math.max(Number(request.query.limit) || 25, 1), 100);
    const offset = Math.max(Number(request.query.offset) || 0, 0);

    const whereClauses: string[] = ["1=1"];
    const params: unknown[] = [];

    if (statusFilter && statusFilter !== "all") {
      params.push(statusFilter);
      whereClauses.push(`status = $${params.length}`);
    }
    if (channelFilter && channelFilter !== "all") {
      params.push(channelFilter);
      whereClauses.push(`channel = $${params.length}`);
    }
    if (tenantId) {
      params.push(tenantId);
      whereClauses.push(`tenant_id = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      whereClauses.push(`(idempotency_key ILIKE $${params.length} OR last_error_code ILIKE $${params.length})`);
    }

    const whereSql = whereClauses.join(" AND ");

    const [countRows, summaryRows, listRows] = await Promise.all([
      pool.query<{ total: string }>(`SELECT count(*)::text AS total FROM public.notification_outbox WHERE ${whereSql}`, params),
      pool.query<{ status: string; count: string }>(
        `SELECT status, count(*)::text AS count FROM public.notification_outbox GROUP BY status`,
      ),
      pool.query<{
        id: string;
        tenant_id: string | null;
        tenant_name: string | null;
        channel: string;
        payload_ciphertext: string;
        idempotency_key: string;
        status: string;
        attempts: number;
        max_attempts: number;
        available_at: string;
        locked_at: string | null;
        sent_at: string | null;
        last_error_code: string | null;
        created_at: string;
        updated_at: string;
      }>(
        `SELECT o.id, o.tenant_id, t.name AS tenant_name, o.channel, o.payload_ciphertext,
                o.idempotency_key, o.status, o.attempts, o.max_attempts, o.available_at::text,
                o.locked_at::text, o.sent_at::text, o.last_error_code, o.created_at::text, o.updated_at::text
           FROM public.notification_outbox o
           LEFT JOIN public.tenants t ON t.id = o.tenant_id
          WHERE ${whereSql}
          ORDER BY o.created_at DESC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
    ]);

    const summaryMap: Record<string, number> = { pending: 0, processing: 0, sent: 0, dead: 0 };
    for (const row of summaryRows.rows) {
      summaryMap[row.status] = Number(row.count) || 0;
    }

    const items = listRows.rows.map((row) => {
      const decrypted = safeDecryptPayload(row.payload_ciphertext);
      return {
        id: row.id,
        tenantId: row.tenant_id,
        tenantName: row.tenant_name,
        channel: row.channel,
        idempotencyKey: row.idempotency_key,
        status: row.status,
        attempts: row.attempts,
        maxAttempts: row.max_attempts,
        availableAt: row.available_at,
        lockedAt: row.locked_at,
        sentAt: row.sent_at,
        lastErrorCode: row.last_error_code,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        recipient: decrypted.to ?? "unknown",
        subject: decrypted.subject ?? null,
        template: decrypted.template ?? "unknown",
        variables: decrypted.variables ?? {},
      };
    });

    return reply.send({
      items,
      summary: summaryMap,
      total: Number(countRows.rows[0]?.total ?? 0),
      limit,
      offset,
    });
  });

  app.post<{ Params: { id: string } }>("/admin/platform/troubleshoot/outbox/:id/retry", async (request, reply) => {
    const operator = await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
    const id = request.params.id.trim();

    return withAudit(
      request,
      {
        ...userAuditEvent(request, operator, "notification_outbox", id),
        action: "outbox.notification.retry",
        tenantId: null,
      },
      async () => {
        const result = await pool.query(
          `UPDATE public.notification_outbox
              SET status = 'pending', attempts = 0, available_at = now(),
                  locked_at = NULL, last_error_code = NULL, updated_at = now()
            WHERE id = $1
            RETURNING id, status`,
          [id],
        );
        if (result.rowCount === 0) return reply.code(404).send({ error: "OUTBOX_ITEM_NOT_FOUND" });
        return reply.send({ success: true, item: result.rows[0] });
      },
    );
  });

  app.post("/admin/platform/troubleshoot/outbox/batch-retry-dead", async (request, reply) => {
    const operator = await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);

    return withAudit(
      request,
      {
        ...userAuditEvent(request, operator, "notification_outbox", null),
        action: "outbox.notification.batch_retry_dead",
        tenantId: null,
      },
      async () => {
        const result = await pool.query(
          `UPDATE public.notification_outbox
              SET status = 'pending', attempts = 0, available_at = now(),
                  locked_at = NULL, last_error_code = NULL, updated_at = now()
            WHERE status = 'dead' OR (status = 'processing' AND locked_at < now() - interval '5 minutes')
            RETURNING id`,
        );
        return reply.send({ success: true, requeuedCount: result.rowCount ?? 0 });
      },
    );
  });

  app.post<{ Params: { id: string } }>("/admin/platform/troubleshoot/outbox/:id/cancel", async (request, reply) => {
    const operator = await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
    const id = request.params.id.trim();

    return withAudit(
      request,
      {
        ...userAuditEvent(request, operator, "notification_outbox", id),
        action: "outbox.notification.cancel",
        tenantId: null,
      },
      async () => {
        const result = await pool.query(
          `UPDATE public.notification_outbox
              SET status = 'dead', locked_at = NULL, last_error_code = 'CANCELLED_BY_ADMIN', updated_at = now()
            WHERE id = $1 AND status != 'sent'
            RETURNING id, status`,
          [id],
        );
        if (result.rowCount === 0) return reply.code(404).send({ error: "OUTBOX_ITEM_NOT_FOUND_OR_SENT" });
        return reply.send({ success: true, item: result.rows[0] });
      },
    );
  });

  const testDispatchSchema = z.object({
    channel: z.enum(["email", "sms"]),
    to: z.string().min(1).max(254),
    subject: z.string().max(200).optional(),
    message: z.string().min(1).max(1000),
  });

  app.post("/admin/platform/troubleshoot/outbox/test-dispatch", async (request, reply) => {
    const operator = await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
    const parsed = testDispatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });

    return withAudit(
      request,
      {
        ...userAuditEvent(request, operator, "notification_outbox", null, {
          channel: parsed.data.channel,
        }),
        action: "outbox.notification.test_dispatch",
        tenantId: null,
      },
      async () => {
        if (!outboxCodec) {
          return reply.code(500).send({ error: "ENCRYPTION_KEY_NOT_CONFIGURED" });
        }
        const payload: NotificationPayload = {
          to: parsed.data.to,
          subject: parsed.data.subject ?? "Bazion Platform Diagnostics Test",
          template: "admin.diagnostics.test",
          variables: { message: parsed.data.message },
        };
        const ciphertext = outboxCodec.encrypt(JSON.stringify(payload));
        const payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
        const idempotencyKey = `admin:diag:${randomBytes(16).toString("hex")}`;

        const result = await pool.query<{ id: string }>(
          `INSERT INTO public.notification_outbox
             (channel, payload_ciphertext, payload_hash, idempotency_key, max_attempts)
           VALUES ($1, $2, $3, $4, 3)
           RETURNING id`,
          [parsed.data.channel, ciphertext, payloadHash, idempotencyKey],
        );
        return reply.code(201).send({ success: true, id: result.rows[0]?.id });
      },
    );
  });

  // ─── 2. PAYMENTS & RECONCILIATION TROUBLESHOOTING ────────────────────────────

  app.get<{
    Querystring: {
      status?: string;
      source?: string;
      search?: string;
      tenantId?: string;
      limit?: string;
      offset?: string;
    };
  }>("/admin/platform/troubleshoot/payments", async (request, reply) => {
    await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);

    const status = request.query.status?.trim();
    const source = request.query.source?.trim();
    const search = request.query.search?.trim();
    const tenantId = request.query.tenantId?.trim();
    const limit = Math.min(Math.max(Number(request.query.limit) || 25, 1), 100);
    const offset = Math.max(Number(request.query.offset) || 0, 0);

    const items: Array<{
      id: string;
      source: "church_donation" | "commerce_order";
      tenantId: string;
      tenantName: string | null;
      referenceId: string;
      orderNumber?: string | null;
      provider: string;
      providerReference: string | null;
      checkoutRequestId: string | null;
      merchantRequestId: string | null;
      amountMinor: number;
      currency: string;
      status: string;
      verifiedAt: string | null;
      rawCallback: unknown;
      createdAt: string;
      customerName: string | null;
      customerContact: string | null;
    }> = [];

    // Query Church Donations unless user filtered specifically for commerce_order
    if (!source || source === "all" || source === "church_donation") {
      const churchWhere: string[] = ["1=1"];
      const churchParams: unknown[] = [];
      if (status && status !== "all") {
        churchParams.push(status === "succeeded" ? "succeeded" : status === "failed" ? "failed" : "pending");
        churchWhere.push(`tx.transaction_status = $${churchParams.length}`);
      }
      if (tenantId) {
        churchParams.push(tenantId);
        churchWhere.push(`tx.tenant_id = $${churchParams.length}`);
      }
      if (search) {
        churchParams.push(`%${search}%`);
        churchWhere.push(`(
          tx.provider_reference ILIKE $${churchParams.length} OR
          tx.checkout_request_id ILIKE $${churchParams.length} OR
          d.donor_name ILIKE $${churchParams.length} OR
          d.donor_phone ILIKE $${churchParams.length} OR
          d.donor_email ILIKE $${churchParams.length}
        )`);
      }

      const churchRes = await safeQuery<{
        id: string;
        tenant_id: string;
        tenant_name: string | null;
        donation_id: string;
        provider: string;
        provider_reference: string | null;
        checkout_request_id: string | null;
        merchant_request_id: string | null;
        amount_minor: string;
        currency: string;
        transaction_status: string;
        verified_at: string | null;
        raw_callback_json: unknown;
        created_at: string;
        donor_name: string | null;
        donor_phone: string | null;
        donor_email: string | null;
      }>(
        `SELECT tx.id, tx.tenant_id, t.name AS tenant_name, tx.donation_id, tx.provider,
                tx.provider_reference, tx.checkout_request_id, tx.merchant_request_id,
                tx.amount_minor::text, tx.currency, tx.transaction_status, tx.verified_at::text,
                tx.raw_callback_json, tx.created_at::text, d.donor_name, d.donor_phone, d.donor_email
           FROM public.church_payment_transactions tx
           JOIN public.church_donations d ON d.id = tx.donation_id
           LEFT JOIN public.tenants t ON t.id = tx.tenant_id
          WHERE ${churchWhere.join(" AND ")}
          ORDER BY tx.created_at DESC
          LIMIT 100`,
        churchParams,
      );

      for (const row of churchRes?.rows ?? []) {
        items.push({
          id: row.id,
          source: "church_donation",
          tenantId: row.tenant_id,
          tenantName: row.tenant_name,
          referenceId: row.donation_id,
          orderNumber: null,
          provider: row.provider,
          providerReference: row.provider_reference,
          checkoutRequestId: row.checkout_request_id,
          merchantRequestId: row.merchant_request_id,
          amountMinor: Number(row.amount_minor),
          currency: row.currency,
          status: row.transaction_status,
          verifiedAt: row.verified_at,
          rawCallback: row.raw_callback_json,
          createdAt: row.created_at,
          customerName: row.donor_name,
          customerContact: row.donor_phone || row.donor_email,
        });
      }
    }

    // Query Commerce Orders unless user filtered specifically for church_donation
    if (!source || source === "all" || source === "commerce_order") {
      const commWhere: string[] = ["1=1"];
      const commParams: unknown[] = [];
      if (status && status !== "all") {
        if (status === "succeeded") {
          commWhere.push(`pa.status = 'succeeded'`);
        } else if (status === "failed") {
          commWhere.push(`pa.status in ('failed', 'cancelled')`);
        } else {
          commWhere.push(`pa.status in ('created', 'requires_action', 'processing')`);
        }
      }
      if (tenantId) {
        commParams.push(tenantId);
        commWhere.push(`pa.tenant_id = $${commParams.length}`);
      }
      if (search) {
        commParams.push(`%${search}%`);
        commWhere.push(`(
          pa.provider_reference ILIKE $${commParams.length} OR
          pa.checkout_request_id ILIKE $${commParams.length} OR
          o.customer_name ILIKE $${commParams.length} OR
          o.customer_phone ILIKE $${commParams.length} OR
          o.customer_email ILIKE $${commParams.length} OR
          o.order_number ILIKE $${commParams.length}
        )`);
      }

      const commRes = await safeQuery<{
        id: string;
        tenant_id: string;
        tenant_name: string | null;
        order_id: string;
        order_number: string | null;
        provider: string;
        provider_reference: string | null;
        checkout_request_id: string | null;
        merchant_request_id: string | null;
        amount_minor: string;
        currency: string;
        status: string;
        verified_at: string | null;
        created_at: string;
        customer_name: string | null;
        customer_phone: string | null;
        customer_email: string | null;
      }>(
        `SELECT pa.id, pa.tenant_id, t.name AS tenant_name, pa.order_id, o.order_number, pa.provider,
                pa.provider_reference, pa.checkout_request_id, pa.merchant_request_id,
                pa.amount_minor::text, pa.currency, pa.status, pa.verified_at::text,
                pa.created_at::text, o.customer_name, o.customer_phone, o.customer_email
           FROM public.payment_attempts pa
           JOIN public.orders o ON o.id = pa.order_id
           LEFT JOIN public.tenants t ON t.id = pa.tenant_id
          WHERE ${commWhere.join(" AND ")}
          ORDER BY pa.created_at DESC
          LIMIT 100`,
        commParams,
      );

      for (const row of commRes?.rows ?? []) {
        items.push({
          id: row.id,
          source: "commerce_order",
          tenantId: row.tenant_id,
          tenantName: row.tenant_name,
          referenceId: row.order_id,
          orderNumber: row.order_number,
          provider: row.provider,
          providerReference: row.provider_reference,
          checkoutRequestId: row.checkout_request_id,
          merchantRequestId: row.merchant_request_id,
          amountMinor: Number(row.amount_minor),
          currency: row.currency,
          status: row.status,
          verifiedAt: row.verified_at,
          rawCallback: null,
          createdAt: row.created_at,
          customerName: row.customer_name,
          customerContact: row.customer_phone || row.customer_email,
        });
      }
    }

    // Sort combined records descending by createdAt
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const paginated = items.slice(offset, offset + limit);

    return reply.send({ items: paginated, total: items.length, limit, offset });
  });

  const reconcileSchema = z.object({
    source: z.enum(["church_donation", "commerce_order"]),
    action: z.enum(["mark_succeeded", "mark_failed"]),
    providerReference: z.string().max(160).optional(),
    reason: z.string().min(3).max(250),
  });

  app.post<{ Params: { id: string } }>("/admin/platform/troubleshoot/payments/:id/reconcile", async (request, reply) => {
    const operator = await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
    const id = request.params.id.trim();
    const parsed = reconcileSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });

    return withAudit(
      request,
      {
        ...userAuditEvent(request, operator, "payment_transaction", id, {
          source: parsed.data.source,
          actionTaken: parsed.data.action,
        }),
        action: "payment.troubleshoot.reconcile",
        tenantId: null,
      },
      async () => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          if (parsed.data.source === "church_donation") {
            const txResult = await client.query<{
              id: string;
              tenant_id: string;
              donation_id: string;
              transaction_status: string;
            }>(
              `SELECT id, tenant_id, donation_id, transaction_status
                 FROM public.church_payment_transactions
                WHERE id = $1 FOR UPDATE`,
              [id],
            );
            const tx = txResult.rows[0];
            if (!tx) {
              await client.query("ROLLBACK");
              return reply.code(404).send({ error: "TRANSACTION_NOT_FOUND" });
            }

            const targetStatus = parsed.data.action === "mark_succeeded" ? "succeeded" : "failed";
            const targetDonationStatus = parsed.data.action === "mark_succeeded" ? "verified" : "failed";

            await client.query(
              `UPDATE public.church_payment_transactions
                  SET transaction_status = $1,
                      provider_reference = coalesce($2, provider_reference),
                      verified_at = CASE WHEN $1 = 'succeeded' THEN now() ELSE verified_at END,
                      raw_callback_json = jsonb_build_object('reconciledBy', $3, 'reason', $4, 'at', now())
                WHERE id = $5`,
              [targetStatus, parsed.data.providerReference?.trim() || null, operator.userId, parsed.data.reason, id],
            );

            await client.query(
              `UPDATE public.church_donations
                  SET payment_status = $1
                WHERE id = $2 AND tenant_id = $3`,
              [targetDonationStatus, tx.donation_id, tx.tenant_id],
            );

            await client.query("COMMIT");
            return reply.send({ success: true, status: targetStatus });
          } else if (parsed.data.source === "commerce_order") {
            const attemptResult = await client.query<{
              id: string;
              tenant_id: string;
              order_id: string;
              status: string;
            }>(
              `SELECT id, tenant_id, order_id, status
                 FROM public.payment_attempts
                WHERE id = $1 FOR UPDATE`,
              [id],
            );
            const attempt = attemptResult.rows[0];
            if (!attempt) {
              await client.query("ROLLBACK");
              return reply.code(404).send({ error: "PAYMENT_ATTEMPT_NOT_FOUND" });
            }

            const targetStatus = parsed.data.action === "mark_succeeded" ? "succeeded" : "failed";
            const targetOrderStatus = parsed.data.action === "mark_succeeded" ? "paid" : "cancelled";

            await client.query(
              `UPDATE public.payment_attempts
                  SET status = $1,
                      provider_reference = coalesce($2, provider_reference),
                      verified_at = CASE WHEN $1 = 'succeeded' THEN now() ELSE verified_at END,
                      updated_at = now()
                WHERE id = $3`,
              [targetStatus, parsed.data.providerReference?.trim() || null, id],
            );

            await client.query(
              `UPDATE public.orders
                  SET status = $1,
                      updated_at = now()
                WHERE id = $2 AND tenant_id = $3`,
              [targetOrderStatus, attempt.order_id, attempt.tenant_id],
            );

            await client.query("COMMIT");
            return reply.send({ success: true, status: targetStatus });
          } else {
            await client.query("ROLLBACK");
            return reply.code(400).send({ error: "UNSUPPORTED_PAYMENT_SOURCE" });
          }
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      },
    );
  });

  const queryStkSchema = z.object({
    checkoutRequestId: z.string().min(1).max(200),
  });

  app.post("/admin/platform/troubleshoot/payments/query-stk", async (request, reply) => {
    await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
    const parsed = queryStkSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });

    const checkoutRequestId = parsed.data.checkoutRequestId.trim();

    const [churchTx, commTx] = await Promise.all([
      pool.query<{ id: string; provider: string; checkout_request_id: string; transaction_status: string }>(
        `SELECT id, provider, checkout_request_id, transaction_status FROM public.church_payment_transactions WHERE checkout_request_id = $1 LIMIT 1`,
        [checkoutRequestId],
      ).catch(() => ({ rows: [] })),
      pool.query<{ id: string; provider: string; checkout_request_id: string; status: string }>(
        `SELECT id, provider, checkout_request_id, status FROM public.payment_attempts WHERE checkout_request_id = $1 LIMIT 1`,
        [checkoutRequestId],
      ).catch(() => ({ rows: [] })),
    ]);

    const tx = churchTx.rows[0] ?? commTx.rows[0];

    if (process.env.MPESA_CONSUMER_KEY && process.env.MPESA_CONSUMER_SECRET && process.env.MPESA_PASSKEY && process.env.MPESA_BUSINESS_SHORT_CODE) {
      try {
        const daraja = new DarajaClient({
          environment: process.env.MPESA_ENVIRONMENT === "production" ? "production" : "sandbox",
          consumerKey: process.env.MPESA_CONSUMER_KEY,
          consumerSecret: process.env.MPESA_CONSUMER_SECRET,
          businessShortCode: process.env.MPESA_BUSINESS_SHORT_CODE,
          passkey: process.env.MPESA_PASSKEY,
          callbackUrl: process.env.MPESA_CALLBACK_URL || "https://localhost:4000/callback",
        });
        const result = await daraja.queryStkPushStatus(checkoutRequestId);
        return reply.send({ success: true, live: true, result, localRecord: tx ?? null });
      } catch (err: unknown) {
        return reply.code(502).send({
          success: false,
          error: "DARAJA_QUERY_ERROR",
          message: err instanceof Error ? err.message : "Safaricom query failed",
          localRecord: tx ?? null,
        });
      }
    } else {
      return reply.send({
        success: true,
        live: false,
        notice: "Daraja credentials not configured in this environment; returning diagnostic correlation.",
        result: {
          responseCode: "0",
          responseDescription: "Mock / Sandbox Mode",
          checkoutRequestId,
          resultCode: tx ? "0" : "1",
          resultDesc: tx ? "Transaction correlated locally in platform database." : "No local transaction found for this CheckoutRequestID.",
        },
        localRecord: tx ?? null,
      });
    }
  });

  // ─── 3. DNS & CUSTOM DOMAINS TROUBLESHOOTING ─────────────────────────────────

  app.get<{ Querystring: { search?: string } }>("/admin/platform/troubleshoot/domains", async (request, reply) => {
    await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);

    const search = request.query.search?.trim();
    const where = search ? `WHERE d.hostname ILIKE $1 OR t.name ILIKE $1` : "";
    const params = search ? [`%${search}%`] : [];

    const rows = await pool.query<{
      id: string;
      tenant_id: string;
      tenant_name: string;
      tenant_slug: string;
      hostname: string;
      status: string;
      verification_token_hash: string | null;
      verified_at: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT d.id, d.tenant_id, t.name AS tenant_name, t.slug AS tenant_slug,
              d.hostname, d.status, d.verification_token_hash, d.verified_at::text,
              d.created_at::text, d.updated_at::text
         FROM public.tenant_domains d
         JOIN public.tenants t ON t.id = d.tenant_id
        ${where}
        ORDER BY d.created_at DESC`,
      params,
    );

    return reply.send({ items: rows.rows });
  });

  const diagnoseSchema = z.object({
    hostname: z.string().min(1).max(253),
    domainId: z.string().uuid().optional(),
  });

  app.post("/admin/platform/troubleshoot/domains/diagnose", async (request, reply) => {
    await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
    const parsed = diagnoseSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });

    let expectedHash: string | undefined;
    if (parsed.data.domainId) {
      const res = await pool.query<{ verification_token_hash: string | null }>(
        `SELECT verification_token_hash FROM public.tenant_domains WHERE id = $1 LIMIT 1`,
        [parsed.data.domainId],
      );
      expectedHash = res.rows[0]?.verification_token_hash ?? undefined;
    }

    const report = await diagnoseTenantDomainDns(parsed.data.hostname, expectedHash);
    return reply.send(report);
  });

  const forceVerifySchema = z.object({
    reason: z.string().min(5).max(250),
  });

  app.post<{ Params: { domainId: string } }>(
    "/admin/platform/troubleshoot/domains/:domainId/force-verify",
    async (request, reply) => {
      const operator = await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
      const domainId = request.params.domainId.trim();
      const parsed = forceVerifySchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });

      return withAudit(
        request,
        {
          ...userAuditEvent(request, operator, "tenant_domain", domainId),
          action: "domain.troubleshoot.force_verify",
          tenantId: null,
        },
        async () => {
          const result = await pool.query(
            `UPDATE public.tenant_domains
                SET status = 'active', verified_at = now(), verification_token_hash = NULL, updated_at = now()
              WHERE id = $1
              RETURNING id, hostname, status`,
            [domainId],
          );
          if (result.rowCount === 0) return reply.code(404).send({ error: "DOMAIN_NOT_FOUND" });
          return reply.send({ success: true, domain: result.rows[0] });
        },
      );
    },
  );

  const toggleStatusSchema = z.object({
    status: z.enum(["active", "disabled"]),
    reason: z.string().min(3).max(250),
  });

  app.post<{ Params: { domainId: string } }>(
    "/admin/platform/troubleshoot/domains/:domainId/toggle-status",
    async (request, reply) => {
      const operator = await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
      const domainId = request.params.domainId.trim();
      const parsed = toggleStatusSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });

      return withAudit(
        request,
        {
          ...userAuditEvent(request, operator, "tenant_domain", domainId, {
            newStatus: parsed.data.status,
          }),
          action: "domain.troubleshoot.toggle_status",
          tenantId: null,
        },
        async () => {
          const result = await pool.query(
            `UPDATE public.tenant_domains
                SET status = $1, updated_at = now()
              WHERE id = $2
              RETURNING id, hostname, status`,
            [parsed.data.status, domainId],
          );
          if (result.rowCount === 0) return reply.code(404).send({ error: "DOMAIN_NOT_FOUND" });
          return reply.send({ success: true, domain: result.rows[0] });
        },
      );
    },
  );

  // ─── 4. USER & AUTH RESCUE ───────────────────────────────────────────────────

  app.get<{ Querystring: { query?: string; limit?: string; offset?: string } }>(
    "/admin/platform/troubleshoot/users",
    async (request, reply) => {
      await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
      const users = await listPlatformUsers({
        ...(request.query.query ? { query: request.query.query } : {}),
        limit: Number(request.query.limit) || 25,
        offset: Number(request.query.offset) || 0,
      });
      return reply.send(users);
    },
  );

  app.post<{ Params: { userId: string } }>(
    "/admin/platform/troubleshoot/users/:userId/force-verify-email",
    async (request, reply) => {
      const operator = await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
      const userId = request.params.userId.trim();

      return withAudit(
        request,
        {
          ...userAuditEvent(request, operator, "auth_user", userId),
          action: "user.troubleshoot.force_verify_email",
          tenantId: null,
        },
        async () => {
          const success = await forceVerifyPlatformUserEmail(userId);
          if (!success) return reply.code(404).send({ error: "USER_NOT_FOUND" });
          return reply.send({ success: true, userId });
        },
      );
    },
  );

  app.post<{ Params: { userId: string } }>(
    "/admin/platform/troubleshoot/users/:userId/revoke-sessions",
    async (request, reply) => {
      const operator = await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
      const userId = request.params.userId.trim();

      return withAudit(
        request,
        {
          ...userAuditEvent(request, operator, "auth_user", userId),
          action: "user.troubleshoot.revoke_sessions",
          tenantId: null,
        },
        async () => {
          const count = await revokePlatformUserSessions(userId);
          return reply.send({ success: true, revokedSessions: count });
        },
      );
    },
  );

  app.post<{ Params: { userId: string } }>(
    "/admin/platform/troubleshoot/users/:userId/emergency-reset-link",
    async (request, reply) => {
      const operator = await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
      const userId = request.params.userId.trim();

      return withAudit(
        request,
        {
          ...userAuditEvent(request, operator, "auth_user", userId),
          action: "user.troubleshoot.emergency_reset_link",
          tenantId: null,
        },
        async () => {
          const res = await generateEmergencyPasswordResetUrl(userId);
          if (!res) return reply.code(404).send({ error: "USER_NOT_FOUND" });
          if (!res.emailDelivered) {
            return reply.code(503).send({
              error: "NOTIFICATION_DELIVERY_UNAVAILABLE",
              message: "Emergency reset link was created but email delivery could not be queued.",
            });
          }
          return reply.send({
            success: true,
            emailDelivered: true,
            maskedEmail: maskEmail(res.email),
            expiresInSeconds: 3600,
          });
        },
      );
    },
  );

  // ─── 5. TENANT RECOVERY & OVERRIDES ──────────────────────────────────────────

  app.get<{ Params: { tenantId: string } }>(
    "/admin/platform/troubleshoot/tenants/:tenantId/health",
    async (request, reply) => {
      await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
      const tenantId = request.params.tenantId.trim();

      const [tenantRes, bindingRes, ministryRes, donationsRes] = await Promise.all([
        pool.query(`SELECT id, slug, name, default_currency, status, created_at, updated_at FROM public.tenants WHERE id = $1`, [tenantId]),
        pool.query(`SELECT tier, state, schema_version FROM public.tenant_database_bindings WHERE tenant_id = $1`, [tenantId]),
        pool.query(`SELECT setting_key, setting_value FROM public.ministry_settings WHERE tenant_id = $1 AND setting_key = 'maintenance_mode'`, [tenantId]),
        pool.query(`SELECT count(*)::text AS total, coalesce(sum(amount_minor), 0)::text AS raised FROM public.church_donations WHERE tenant_id = $1`, [tenantId]),
      ]);

      const tenant = tenantRes.rows[0];
      if (!tenant) return reply.code(404).send({ error: "TENANT_NOT_FOUND" });

      let maintenance = { enabled: false, message: "" };
      if (ministryRes.rows[0]?.setting_value) {
        try {
          maintenance = JSON.parse(ministryRes.rows[0].setting_value);
        } catch {
          // parse fallback
        }
      }

      return reply.send({
        tenant,
        binding: bindingRes.rows[0] ?? { tier: "shared", state: "shared", schema_version: currentDatabaseSchemaVersion },
        maintenance,
        donations: {
          count: Number(donationsRes.rows[0]?.total ?? 0),
          raisedMinor: Number(donationsRes.rows[0]?.raised ?? 0),
        },
      });
    },
  );

  const maintenanceSchema = z.object({
    enabled: z.boolean(),
    message: z.string().max(500).optional(),
    reason: z.string().min(3).max(250),
  });

  app.post<{ Params: { tenantId: string } }>(
    "/admin/platform/troubleshoot/tenants/:tenantId/maintenance",
    async (request, reply) => {
      const operator = await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
      const tenantId = request.params.tenantId.trim();
      const parsed = maintenanceSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });

      return withAudit(
        request,
        {
          ...userAuditEvent(request, operator, "tenant_maintenance", tenantId, {
            maintenanceActive: parsed.data.enabled,
          }),
          action: "tenant.troubleshoot.maintenance_toggle",
          tenantId,
        },
        async () => {
          const settingVal = JSON.stringify({
            enabled: parsed.data.enabled,
            message: parsed.data.message ?? "",
            updatedBy: operator.userId,
            updatedAt: new Date().toISOString(),
          });

          await pool.query(
            `INSERT INTO public.ministry_settings (tenant_id, setting_key, setting_value, updated_at)
             VALUES ($1, 'maintenance_mode', $2, now())
             ON CONFLICT (tenant_id, setting_key)
             DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = now()`,
            [tenantId, settingVal],
          );

          return reply.send({ success: true, enabled: parsed.data.enabled });
        },
      );
    },
  );

  const forceModuleSchema = z.object({
    moduleId: z.string().min(1).max(64),
    enabled: z.boolean(),
    reason: z.string().min(3).max(250),
  });

  app.post<{ Params: { tenantId: string } }>(
    "/admin/platform/troubleshoot/tenants/:tenantId/modules/force-override",
    async (request, reply) => {
      const operator = await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
      const tenantId = request.params.tenantId.trim();
      const parsed = forceModuleSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });

      return withAudit(
        request,
        {
          ...userAuditEvent(request, operator, "tenant_module_override", `${tenantId}:${parsed.data.moduleId}`, {
            moduleId: parsed.data.moduleId,
            enabled: parsed.data.enabled,
          }),
          action: "tenant.troubleshoot.module_force_override",
          tenantId,
        },
        async () => {
          await pool.query(
            `INSERT INTO public.tenant_module_entitlements (tenant_id, module_id, enabled, updated_by, updated_at)
             VALUES ($1, $2, $3, $4, now())
             ON CONFLICT (tenant_id, module_id)
             DO UPDATE SET enabled = EXCLUDED.enabled, updated_by = EXCLUDED.updated_by, updated_at = now()`,
            [tenantId, parsed.data.moduleId, parsed.data.enabled, operator.userId],
          );
          return reply.send({ success: true, moduleId: parsed.data.moduleId, enabled: parsed.data.enabled });
        },
      );
    },
  );

  const tenantStatusSchema = z.object({
    status: z.enum(["active", "suspended", "maintenance", "archived"]),
    reason: z.string().min(3).max(250),
  });

  app.post<{ Params: { tenantId: string } }>(
    "/admin/platform/troubleshoot/tenants/:tenantId/status",
    async (request, reply) => {
      const operator = await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
      const tenantId = request.params.tenantId.trim();
      const parsed = tenantStatusSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });

      return withAudit(
        request,
        {
          ...userAuditEvent(request, operator, "tenant_status", tenantId, {
            newStatus: parsed.data.status,
            reason: parsed.data.reason,
          }),
          action: "tenant.troubleshoot.status_override",
          tenantId,
        },
        async () => {
          const result = await pool.query(
            `UPDATE public.tenants
                SET status = $1, updated_at = now()
              WHERE id = $2
              RETURNING id, name, slug, status`,
            [parsed.data.status, tenantId],
          );
          if (result.rowCount === 0) return reply.code(404).send({ error: "TENANT_NOT_FOUND" });
          return reply.send({ success: true, tenant: result.rows[0] });
        },
      );
    },
  );

  app.get<{ Params: { tenantId: string } }>(
    "/admin/platform/troubleshoot/tenants/:tenantId/modules",
    async (request, reply) => {
      await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
      const tenantId = request.params.tenantId.trim();

      const [tenantRes, entitlementsRes] = await Promise.all([
        pool.query(`SELECT id, name, slug FROM public.tenants WHERE id = $1`, [tenantId]),
        pool.query<{ module_id: string; enabled: boolean; updated_at: string }>(
          `SELECT module_id, enabled, updated_at::text FROM public.tenant_module_entitlements WHERE tenant_id = $1`,
          [tenantId],
        ),
      ]);

      if (tenantRes.rowCount === 0) return reply.code(404).send({ error: "TENANT_NOT_FOUND" });

      const overrideMap = new Map(entitlementsRes.rows.map((r) => [r.module_id, { enabled: r.enabled, updatedAt: r.updated_at }]));

      const modules = platformModuleCatalog.map((mod) => {
        const override = overrideMap.get(mod.id);
        return {
          id: mod.id,
          name: mod.name,
          version: mod.version,
          status: mod.status,
          tenantModel: mod.tenantModel,
          defaultEnabled: mod.defaultEnabled,
          effectiveEnabled: override ? override.enabled : mod.defaultEnabled,
          hasOverride: !!override,
          updatedAt: override?.updatedAt ?? null,
        };
      });

      return reply.send({
        tenantId,
        tenantName: tenantRes.rows[0]?.name,
        modules,
      });
    },
  );

  app.get<{ Params: { tenantId: string } }>(
    "/admin/platform/troubleshoot/tenants/:tenantId/recovery-export",
    async (request, reply) => {
      const operator = await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
      const tenantId = request.params.tenantId.trim();

      return withAudit(
        request,
        {
          ...userAuditEvent(request, operator, "tenant_recovery_export", tenantId),
          action: "tenant.troubleshoot.recovery_export",
          tenantId,
        },
        async () => {
          const [tenant, domains, settings, modules, bindings] = await Promise.all([
            pool.query(
              `SELECT id, slug, name, default_currency, status, created_at, suspended_at, closed_at
                 FROM public.tenants
                WHERE id = $1`,
              [tenantId],
            ),
            pool.query(`SELECT id, hostname, status, verified_at FROM public.tenant_domains WHERE tenant_id = $1`, [tenantId]),
            pool.query(`SELECT setting_key, setting_value FROM public.ministry_settings WHERE tenant_id = $1`, [tenantId]),
            pool.query(`SELECT module_id, enabled, updated_at FROM public.tenant_module_entitlements WHERE tenant_id = $1`, [tenantId]),
            pool.query(`SELECT tier, state, schema_version FROM public.tenant_database_bindings WHERE tenant_id = $1`, [tenantId]),
          ]);

          if (tenant.rowCount === 0) return reply.code(404).send({ error: "TENANT_NOT_FOUND" });

          return reply.send({
            exportedAt: new Date().toISOString(),
            tenant: tenant.rows[0],
            domains: domains.rows,
            settings: settings.rows.map((row: { setting_key: string; setting_value: string }) => ({
              setting_key: row.setting_key,
              setting_value: sanitizeExportSetting(row.setting_key, row.setting_value),
            })),
            modules: modules.rows,
            bindings: bindings.rows[0] ?? null,
          });
        },
      );
    },
  );

  // ─── 6. DATABASE MIGRATIONS & SCHEMA INSPECTOR ──────────────────────────────

  app.get("/admin/platform/troubleshoot/database/migrations", async (request, reply) => {
    await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
    const [appliedRes, bindingsRes] = await Promise.all([
      safeQuery<{ version: string; applied_at: string }>(
        `SELECT version, applied_at::text FROM public.schema_migrations ORDER BY version ASC`,
      ),
      safeQuery<{ schema_version: string; count: string }>(
        `SELECT coalesce(schema_version, 'unknown') as schema_version, count(*)::text as count
           FROM public.tenant_database_bindings
          GROUP BY coalesce(schema_version, 'unknown')`,
      ),
    ]);

    const appliedMap = new Map(appliedRes.rows.map((r) => [r.version, r.applied_at]));
    const migrationItems = requiredDatabaseMigrations.map((version) => ({
      version,
      applied: appliedMap.has(version),
      appliedAt: appliedMap.get(version) ?? null,
    }));
    const pendingCount = migrationItems.filter((m) => !m.applied).length;

    return reply.send({
      currentPlatformSchemaVersion: currentDatabaseSchemaVersion,
      totalRequired: requiredDatabaseMigrations.length,
      appliedCount: migrationItems.filter((m) => m.applied).length,
      pendingCount,
      isUpToDate: pendingCount === 0,
      migrations: migrationItems,
      tenantBindingsSummary: bindingsRes.rows.map((r) => ({
        schemaVersion: r.schema_version,
        count: Number(r.count),
        isCurrent: r.schema_version === currentDatabaseSchemaVersion,
      })),
      poolStatus: {
        totalCount: (pool as any).totalCount ?? 1,
        idleCount: (pool as any).idleCount ?? 1,
        waitingCount: (pool as any).waitingCount ?? 0,
      },
    });
  });

  app.post("/admin/platform/troubleshoot/database/sync-tenant-bindings", async (request, reply) => {
    const operator = await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);

    return withAudit(
      request,
      {
        ...userAuditEvent(request, operator, "database_migrations", null),
        action: "database.troubleshoot.sync_tenant_bindings",
        tenantId: null,
      },
      async () => {
        const result = await pool.query(
          `UPDATE public.tenant_database_bindings
              SET schema_version = $1, updated_at = now()
            WHERE schema_version IS DISTINCT FROM $1
            RETURNING tenant_id, schema_version`,
          [currentDatabaseSchemaVersion],
        );
        return reply.send({
          success: true,
          synchronizedCount: result.rowCount ?? 0,
          currentSchemaVersion: currentDatabaseSchemaVersion,
        });
      },
    );
  });

  // ─── 7. STORAGE & ASSET QUOTAS INSPECTOR ────────────────────────────────────

  app.get("/admin/platform/troubleshoot/storage/usage", async (request, reply) => {
    await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);

    const [tenantsWithMedia, quotaRows] = await Promise.all([
      safeQuery<{
        tenant_id: string;
        tenant_name: string;
        tenant_slug: string;
        product_images_count: string;
        has_logo: boolean;
        leaders_with_photo: string;
      }>(
        `SELECT t.id AS tenant_id, t.name AS tenant_name, t.slug AS tenant_slug,
                count(DISTINCT p.id)::text AS product_images_count,
                (mp.logo_asset_url IS NOT NULL) AS has_logo,
                count(DISTINCT lp.id)::text AS leaders_with_photo
           FROM public.tenants t
           LEFT JOIN public.products p ON p.tenant_id = t.id AND p.image_url IS NOT NULL
           LEFT JOIN public.ministry_profiles mp ON mp.tenant_id = t.id
           LEFT JOIN public.leadership_profiles lp ON lp.tenant_id = t.id AND lp.photo_url IS NOT NULL
          GROUP BY t.id, t.name, t.slug, mp.logo_asset_url
          ORDER BY t.name ASC`,
      ),
      safeQuery<{ tenant_id: string; setting_value: string }>(
        `SELECT tenant_id, setting_value FROM public.ministry_settings WHERE setting_key = 'storage_quota_mb'`,
      ),
    ]);

    const quotaMap = new Map(quotaRows.rows.map((r) => [r.tenant_id, Number(r.setting_value) || 500]));
    const DEFAULT_QUOTA_MB = 500;

    const items = tenantsWithMedia.rows.map((row) => {
      const assetCount = Number(row.product_images_count) + (row.has_logo ? 1 : 0) + Number(row.leaders_with_photo);
      // Estimated ~1.2 MB average per high-res church banner / product asset
      const estimatedSizeBytes = assetCount * 1_258_291;
      const quotaMb = quotaMap.get(row.tenant_id) ?? DEFAULT_QUOTA_MB;
      const quotaBytes = quotaMb * 1024 * 1024;
      return {
        tenantId: row.tenant_id,
        tenantName: row.tenant_name,
        tenantSlug: row.tenant_slug,
        assetCount,
        estimatedSizeBytes,
        quotaMb,
        quotaBytes,
        percentUsed: Math.min(Math.round((estimatedSizeBytes / quotaBytes) * 100), 100),
      };
    });

    return reply.send({
      driver: process.env.MEDIA_STORAGE_DRIVER || "local",
      defaultQuotaMb: DEFAULT_QUOTA_MB,
      totalTenants: items.length,
      items,
    });
  });

  const quotaOverrideSchema = z.object({
    quotaMb: z.number().int().min(50).max(102400), // 50MB to 100GB
    reason: z.string().min(3).max(250),
  });

  app.post<{ Params: { tenantId: string } }>(
    "/admin/platform/troubleshoot/storage/tenants/:tenantId/quota-override",
    async (request, reply) => {
      const operator = await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
      const tenantId = request.params.tenantId.trim();
      const parsed = quotaOverrideSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });

      return withAudit(
        request,
        {
          ...userAuditEvent(request, operator, "tenant_storage_quota", tenantId, {
            quotaMb: parsed.data.quotaMb,
            reason: parsed.data.reason,
          }),
          action: "storage.troubleshoot.quota_override",
          tenantId,
        },
        async () => {
          await pool.query(
            `INSERT INTO public.ministry_settings (tenant_id, setting_key, setting_value, updated_at)
             VALUES ($1, 'storage_quota_mb', $2, now())
             ON CONFLICT (tenant_id, setting_key)
             DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = now()`,
            [tenantId, String(parsed.data.quotaMb)],
          );
          return reply.send({ success: true, tenantId, quotaMb: parsed.data.quotaMb });
        },
      );
    },
  );

  // ─── 8. RATE LIMITS & THROTTLING INSPECTOR ──────────────────────────────────

  app.get("/admin/platform/troubleshoot/rate-limits", async (request, reply) => {
    await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
    return reply.send({
      policies: [
        { id: "global_api", route: "Global API Window", window: "1 minute", maxRequests: 120, keyType: "Client IP" },
        { id: "auth_signin", route: "/api/auth/sign-in/email", window: "1 minute", maxRequests: 8, keyType: "IP & Email" },
        { id: "auth_signup", route: "/api/auth/sign-up/email", window: "1 hour", maxRequests: 10, keyType: "Client IP" },
        { id: "auth_reset_req", route: "/api/auth/request-password-reset", window: "1 hour", maxRequests: 5, keyType: "Account Email" },
        { id: "auth_reset_submit", route: "/api/auth/reset-password", window: "1 hour", maxRequests: 10, keyType: "Client IP" },
      ],
      status: "active",
      store: "memory",
      resetSupported: false,
    });
  });

  const resetRateLimitSchema = z.object({
    target: z.string().min(1).max(250), // IP or email or "all"
    scope: z.enum(["all", "auth", "api"]).default("all"),
    reason: z.string().min(3).max(250),
  });

  app.post("/admin/platform/troubleshoot/rate-limits/reset", async (request, reply) => {
    const operator = await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
    const parsed = resetRateLimitSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });

    return withAudit(
      request,
      {
        ...userAuditEvent(request, operator, "rate_limiter", parsed.data.target, {
          scope: parsed.data.scope,
          reason: parsed.data.reason,
        }),
        action: "ratelimit.troubleshoot.reset",
        tenantId: null,
      },
      async () => {
        throw Object.assign(new Error("The configured rate-limit stores do not support targeted counter resets."), {
          statusCode: 501,
          code: "RATE_LIMIT_RESET_UNAVAILABLE",
        });
      },
    );
  });

  // ─── 9. GLOBAL AUDIT TRAIL LOGS ──────────────────────────────────────────────

  app.get<{
    Querystring: {
      tenantId?: string;
      action?: string;
      actorId?: string;
      outcome?: string;
      search?: string;
      limit?: string;
      offset?: string;
    };
  }>("/admin/platform/audit", async (request, reply) => {
    await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);

    const tenantId = request.query.tenantId?.trim();
    const action = request.query.action?.trim();
    const actorId = request.query.actorId?.trim();
    const outcome = request.query.outcome?.trim();
    const search = request.query.search?.trim();
    const limit = Math.min(Math.max(Number(request.query.limit) || 50, 1), 100);
    const offset = Math.max(Number(request.query.offset) || 0, 0);

    const where: string[] = ["1=1"];
    const params: unknown[] = [];

    if (tenantId) {
      params.push(tenantId);
      where.push(`tenant_id = $${params.length}`);
    }
    if (action) {
      params.push(`%${action}%`);
      where.push(`action ILIKE $${params.length}`);
    }
    if (actorId) {
      params.push(actorId);
      where.push(`actor_id = $${params.length}`);
    }
    if (outcome && outcome !== "all") {
      params.push(outcome);
      where.push(`outcome = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(action ILIKE $${params.length} OR resource_type ILIKE $${params.length} OR actor_id ILIKE $${params.length})`);
    }

    const whereSql = where.join(" AND ");

    const [countRes, rowsRes] = await Promise.all([
      pool.query<{ total: string }>(`SELECT count(*)::text AS total FROM public.platform_audit_events WHERE ${whereSql}`, params),
      pool.query<{
        id: string;
        tenant_id: string | null;
        tenant_name: string | null;
        actor_type: string;
        actor_id: string;
        actor_role: string | null;
        action: string;
        resource_type: string;
        resource_id: string | null;
        outcome: string;
        request_id: string | null;
        metadata: unknown;
        occurred_at: string;
      }>(
        `SELECT a.id, a.tenant_id, t.name AS tenant_name, a.actor_type, a.actor_id,
                a.actor_role, a.action, a.resource_type, a.resource_id, a.outcome,
                a.request_id, a.metadata, a.occurred_at::text
           FROM public.platform_audit_events a
           LEFT JOIN public.tenants t ON t.id = a.tenant_id
          WHERE ${whereSql}
          ORDER BY a.occurred_at DESC, a.id DESC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
    ]);

    return reply.send({
      items: rowsRes.rows,
      total: Number(countRes.rows[0]?.total ?? 0),
      limit,
      offset,
    });
  });
}
