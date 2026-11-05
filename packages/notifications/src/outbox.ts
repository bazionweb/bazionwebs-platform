import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type NotificationChannel = "email" | "sms";

export interface NotificationPayload {
  to: string;
  subject?: string;
  template: string;
  variables: Record<string, string | number>;
}

export interface EnqueueNotificationInput {
  idempotencyKey: string;
  tenantId?: string | null;
  channel: NotificationChannel;
  payload: NotificationPayload;
  maxAttempts?: number;
}

export interface OutboxDelivery {
  id: string;
  tenantId: string | null;
  channel: NotificationChannel;
  payload: NotificationPayload;
  attempts: number;
}

export interface SqlQueryResult<Row> {
  rows: Row[];
  rowCount: number | null;
}

export interface SqlExecutor {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    statement: string,
    values?: unknown[],
  ): Promise<SqlQueryResult<Row>>;
}

export interface SqlConnection extends SqlExecutor {
  release(): void;
}

export interface SqlPool extends SqlExecutor {
  connect(): Promise<SqlConnection>;
}

export interface OutboxPayloadCodec {
  encrypt(value: string): string;
  decrypt(value: string): string;
}

/** AES-256-GCM codec. Keep the 32-byte key in a secret manager, never in source control. */
export function createOutboxPayloadCodec(encryptionKey: Uint8Array): OutboxPayloadCodec {
  if (encryptionKey.byteLength !== 32) {
    throw new Error("Notification outbox encryption key must be exactly 32 bytes.");
  }
  const key = Buffer.from(encryptionKey);

  return {
    encrypt(value) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
      const authTag = cipher.getAuthTag();
      return ["v1", iv.toString("base64url"), authTag.toString("base64url"), ciphertext.toString("base64url")].join(".");
    },
    decrypt(value) {
      const [version, ivPart, tagPart, ciphertextPart, ...extra] = value.split(".");
      if (version !== "v1" || !ivPart || !tagPart || !ciphertextPart || extra.length) {
        throw new Error("Unsupported or malformed notification payload ciphertext.");
      }
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivPart, "base64url"));
      decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertextPart, "base64url")),
        decipher.final(),
      ]).toString("utf8");
    },
  };
}

interface OutboxRow extends Record<string, unknown> {
  id: string;
  tenant_id: string | null;
  channel: NotificationChannel;
  payload_ciphertext: string;
  attempts: number;
}

interface InsertedRow extends Record<string, unknown> {
  id: string;
  payload_hash: string;
}

interface StatusRow extends Record<string, unknown> {
  status: "pending" | "processing" | "sent" | "dead";
}

function serializePayload(payload: NotificationPayload): string {
  if (!payload.to.trim() || !payload.template.trim()) {
    throw new Error("Notification recipient and template are required.");
  }
  for (const [key, value] of Object.entries(payload.variables)) {
    if (!key.trim() || (typeof value !== "string" && typeof value !== "number") ||
        (typeof value === "number" && !Number.isFinite(value))) {
      throw new Error("Notification variables must have non-empty keys and finite string/number values.");
    }
  }
  const variables = Object.fromEntries(
    Object.entries(payload.variables).sort(([left], [right]) => left.localeCompare(right)),
  );
  return JSON.stringify({
    to: payload.to,
    ...(payload.subject === undefined ? {} : { subject: payload.subject }),
    template: payload.template,
    variables,
  });
}

function parsePayload(serialized: string): NotificationPayload {
  const value: unknown = JSON.parse(serialized);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid decrypted notification payload.");
  }
  const payload = value as Partial<NotificationPayload>;
  if (typeof payload.to !== "string" || typeof payload.template !== "string" ||
      !payload.variables || typeof payload.variables !== "object" || Array.isArray(payload.variables)) {
    throw new Error("Invalid decrypted notification payload.");
  }
  return {
    to: payload.to,
    ...(typeof payload.subject === "string" ? { subject: payload.subject } : {}),
    template: payload.template,
    variables: payload.variables,
  };
}

export class PostgresNotificationOutbox {
  constructor(
    private readonly pool: SqlPool,
    private readonly codec: OutboxPayloadCodec,
    private readonly leaseMilliseconds = 300_000,
  ) {
    if (!Number.isInteger(leaseMilliseconds) || leaseMilliseconds < 30_000) {
      throw new Error("Notification outbox lease must be at least 30 seconds.");
    }
  }

  async enqueue(input: EnqueueNotificationInput): Promise<string> {
    if (!input.idempotencyKey.trim() || input.idempotencyKey.length > 200) {
      throw new Error("A notification idempotency key of 1–200 characters is required.");
    }
    const serialized = serializePayload(input.payload);
    const payloadHash = createHash("sha256").update(serialized).digest("hex");
    const ciphertext = this.codec.encrypt(serialized);
    const maxAttempts = input.maxAttempts ?? 8;
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) {
      throw new Error("Notification maxAttempts must be an integer between 1 and 20.");
    }

    const result = await this.pool.query<InsertedRow>(
      `INSERT INTO public.notification_outbox
         (tenant_id, channel, payload_ciphertext, payload_hash, idempotency_key, max_attempts)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (idempotency_key)
       DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
       RETURNING id, payload_hash`,
      [input.tenantId ?? null, input.channel, ciphertext, payloadHash, input.idempotencyKey, maxAttempts],
    );
    const row = result.rows[0];
    if (!row) throw new Error("Notification could not be queued.");
    if (row.payload_hash !== payloadHash) {
      throw new Error("Notification idempotency key was reused with a different payload.");
    }
    return row.id;
  }

  async claimBatch(limit = 20): Promise<OutboxDelivery[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error("Notification batch size must be an integer between 1 and 100.");
    }
    const connection = await this.pool.connect();
    let rows: OutboxRow[] = [];
    try {
      await connection.query("BEGIN");
      await connection.query(
        `UPDATE public.notification_outbox
            SET status = CASE WHEN attempts >= max_attempts THEN 'dead' ELSE 'pending' END,
                locked_at = NULL,
                updated_at = now()
          WHERE status = 'processing'
            AND locked_at < now() - ($1::double precision * interval '1 millisecond')`,
        [this.leaseMilliseconds],
      );
      const result = await connection.query<OutboxRow>(
        `WITH candidates AS (
           SELECT id
             FROM public.notification_outbox
            WHERE status = 'pending' AND available_at <= now()
            ORDER BY available_at ASC, created_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT $1
         )
         UPDATE public.notification_outbox AS queued
            SET status = 'processing',
                attempts = queued.attempts + 1,
                locked_at = now(),
                updated_at = now()
           FROM candidates
          WHERE queued.id = candidates.id
         RETURNING queued.id, queued.tenant_id, queued.channel,
                   queued.payload_ciphertext, queued.attempts`,
        [limit],
      );
      rows = result.rows;
      await connection.query("COMMIT");
    } catch (error) {
      await connection.query("ROLLBACK");
      throw error;
    } finally {
      connection.release();
    }

    const deliveries: OutboxDelivery[] = [];
    for (const row of rows) {
      try {
        deliveries.push({
          id: row.id,
          tenantId: row.tenant_id,
          channel: row.channel,
          payload: parsePayload(this.codec.decrypt(row.payload_ciphertext)),
          attempts: row.attempts,
        });
      } catch {
        await this.markRetryableFailure(row.id, "PAYLOAD_DECRYPTION_FAILED");
      }
    }
    return deliveries;
  }

  async markSent(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE public.notification_outbox
          SET status = 'sent', sent_at = now(), locked_at = NULL,
              last_error_code = NULL, updated_at = now()
        WHERE id = $1 AND status = 'processing'`,
      [id],
    );
    return result.rowCount === 1;
  }

  async markRetryableFailure(id: string, errorCode: string): Promise<StatusRow["status"] | null> {
    const safeCode = errorCode.replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 64) || "DELIVERY_FAILED";
    const result = await this.pool.query<StatusRow>(
      `UPDATE public.notification_outbox
          SET status = CASE WHEN attempts >= max_attempts THEN 'dead' ELSE 'pending' END,
              available_at = CASE
                WHEN attempts >= max_attempts THEN available_at
                ELSE now() + make_interval(secs => LEAST(30 * power(2, LEAST(attempts - 1, 10)), 21600))
              END,
              locked_at = NULL,
              last_error_code = $2,
              updated_at = now()
        WHERE id = $1 AND status = 'processing'
        RETURNING status`,
      [id, safeCode],
    );
    return result.rows[0]?.status ?? null;
  }

  async requeueDeadLetter(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE public.notification_outbox
          SET status = 'pending', attempts = 0, available_at = now(),
              locked_at = NULL, last_error_code = NULL, updated_at = now()
        WHERE id = $1 AND status = 'dead'`,
      [id],
    );
    return result.rowCount === 1;
  }
}

export interface NotificationOutboxWorker {
  claimBatch(limit?: number): Promise<OutboxDelivery[]>;
  markSent(id: string): Promise<boolean>;
  markRetryableFailure(id: string, errorCode: string): Promise<string | null>;
}

export async function deliverOutboxBatch(
  outbox: NotificationOutboxWorker,
  deliver: (delivery: OutboxDelivery) => Promise<void>,
  limit = 20,
): Promise<{ claimed: number; sent: number; failed: number }> {
  const deliveries = await outbox.claimBatch(limit);
  let sent = 0;
  let failed = 0;
  for (const delivery of deliveries) {
    try {
      await deliver(delivery);
      if (await outbox.markSent(delivery.id)) sent += 1;
    } catch (error) {
      const errorCode = error instanceof Error ? error.name : "DELIVERY_FAILED";
      const status = await outbox.markRetryableFailure(delivery.id, errorCode);
      if (status) failed += 1;
    }
  }
  return { claimed: deliveries.length, sent, failed };
}
