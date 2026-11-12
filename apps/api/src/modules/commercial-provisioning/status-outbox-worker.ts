import { randomUUID } from "node:crypto";
import {
  DEFAULT_CALLBACK_AUDIENCE,
  DEFAULT_CALLBACK_ISSUER,
  createWebhookSignatureHeader,
  signMachineBearerToken,
} from "./auth.js";
import type { CommercialSqlPool } from "./service.js";

export interface ClaimedStatusOutboxItem {
  id: string;
  operationId: string;
  eventId: string;
  correlationId: string;
  payload: Record<string, unknown>;
  attemptCount: number;
  maxAttempts: number;
  leaseToken: string;
}

export interface StatusCallbackDeliveryOptions {
  callbackUrl: string;
  signingSecret: string;
  bearerSigningSecret?: string | undefined;
  bearerScope?: string | undefined;
  batchSize?: number | undefined;
  leaseSeconds?: number | undefined;
  retryBaseSeconds?: number | undefined;
  retryMaxSeconds?: number | undefined;
  requestTimeoutMs?: number | undefined;
  jitterRatio?: number | undefined;
}

export interface CallbackDeliveryBatchSummary {
  claimed: number;
  delivered: number;
  retried: number;
  deadLettered: number;
  leaseConflicts: number;
}

export type FetchLike = (input: string, init: RequestInit) => Promise<{ status: number; ok: boolean }>;

interface ClaimRow {
  id: string;
  operation_id: string;
  event_id: string;
  correlation_id: string;
  payload: Record<string, unknown>;
  max_attempts: number;
}

interface ClaimedRow {
  id: string;
  attempt_count: number;
}

export interface OutboxReplayResult {
  outboxId: string;
  operationId: string;
  status: string;
  maxAttempts: number;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function computeRetryDelaySeconds(
  attemptNumber: number,
  baseSeconds: number,
  maxSeconds: number,
  jitterRatio: number,
  randomFn: () => number,
): number {
  const exponent = Math.max(0, Math.min(12, attemptNumber - 1));
  const raw = Math.min(maxSeconds, baseSeconds * (2 ** exponent));
  const boundedRatio = Math.max(0, Math.min(0.5, jitterRatio));
  const jitter = Math.round(raw * boundedRatio * randomFn());
  return Math.max(1, Math.min(maxSeconds + jitter, 86_400));
}

function classifyFailure(status: number | null, error: unknown): { retryable: boolean; code: string } {
  if (status !== null) {
    if (status === 408 || status === 429 || status >= 500) {
      return { retryable: true, code: `HTTP_${status}` };
    }
    return { retryable: false, code: `HTTP_${status}_REJECTED` };
  }
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return { retryable: true, code: "CALLBACK_TIMEOUT" };
  }
  return { retryable: true, code: "CALLBACK_NETWORK_ERROR" };
}

interface OutboxDispatchTarget {
  tableName: "public.product_provisioning_status_outbox" | "public.product_subscription_lifecycle_outbox";
  referenceColumn: "operation_id" | "lifecycle_inbox_id";
  bearerSubject: string;
  defaultBearerScope: string;
}

class BoundedLeaseOutboxDispatcher {
  constructor(
    private readonly target: OutboxDispatchTarget,
    private readonly pool: CommercialSqlPool,
    private readonly fetchImpl: FetchLike = (url, init) => fetch(url, init),
    private readonly randomFn: () => number = () => Math.random(),
  ) {}

  private async deadLetterExhaustedLeases(): Promise<number> {
    const result = await this.pool.query(
      `UPDATE ${this.target.tableName}
          SET status = 'dead',
              last_error_code = 'CALLBACK_LEASE_EXHAUSTED',
              lease_token = NULL,
              lease_expires_at = NULL,
              dead_lettered_at = now(),
              updated_at = now()
        WHERE status = 'processing'
          AND lease_expires_at <= now()
          AND attempt_count >= max_attempts`,
    );
    return result.rowCount ?? 0;
  }

  async claimDueBatch(limit = 10, leaseSeconds = 120): Promise<ClaimedStatusOutboxItem[]> {
    const safeLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
    const safeLeaseSeconds = Math.max(30, Math.min(900, Math.trunc(leaseSeconds)));
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const due = await client.query<ClaimRow>(
        `SELECT id::text, ${this.target.referenceColumn}::text AS operation_id,
                event_id::text, correlation_id::text, payload, max_attempts
           FROM ${this.target.tableName}
          WHERE ((status = 'pending' AND next_attempt_at <= now())
             OR (status = 'processing' AND lease_expires_at <= now()))
            AND attempt_count < max_attempts
          ORDER BY next_attempt_at ASC, created_at ASC
          LIMIT $1
          FOR UPDATE SKIP LOCKED`,
        [safeLimit],
      );

      const claimed: ClaimedStatusOutboxItem[] = [];
      for (const row of due.rows) {
        const leaseToken = randomUUID();
        const updated = await client.query<ClaimedRow>(
          `UPDATE ${this.target.tableName}
              SET status = 'processing',
                  attempt_count = attempt_count + 1,
                  lease_token = $2,
                  lease_expires_at = now() + ($3::integer * interval '1 second'),
                  updated_at = now()
            WHERE id = $1
              AND attempt_count < max_attempts
              AND ((status = 'pending' AND next_attempt_at <= now()) OR (status = 'processing' AND lease_expires_at <= now()))
            RETURNING id, attempt_count`,
          [row.id, leaseToken, safeLeaseSeconds],
        );
        if (updated.rowCount !== 1) continue;
        const claimedRow = updated.rows[0]!;
        claimed.push({
          id: row.id,
          operationId: row.operation_id,
          eventId: row.event_id,
          correlationId: row.correlation_id,
          payload: row.payload,
          attemptCount: claimedRow.attempt_count,
          maxAttempts: row.max_attempts,
          leaseToken,
        });
      }

      await client.query("COMMIT");
      return claimed;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async processDueBatch(options: StatusCallbackDeliveryOptions): Promise<CallbackDeliveryBatchSummary> {
    const exhaustedLeases = await this.deadLetterExhaustedLeases();
    const claimed = await this.claimDueBatch(options.batchSize ?? 10, options.leaseSeconds ?? 120);
    const summary: CallbackDeliveryBatchSummary = {
      claimed: claimed.length,
      delivered: 0,
      retried: 0,
      deadLettered: exhaustedLeases,
      leaseConflicts: 0,
    };

    const retryBaseSeconds = options.retryBaseSeconds ?? 15;
    const retryMaxSeconds = options.retryMaxSeconds ?? 1800;
    const requestTimeoutMs = options.requestTimeoutMs ?? 5000;
    const jitterRatio = options.jitterRatio ?? 0.25;

    for (const item of claimed) {
      const body = JSON.stringify(item.payload);
      const signature = createWebhookSignatureHeader(body, options.signingSecret);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Bazion-Event-Id": item.eventId,
        "X-Correlation-Id": item.correlationId,
        "X-Bazion-Correlation-Id": item.correlationId,
        "X-Bazion-Signature": signature,
      };
      if (options.bearerSigningSecret) {
        headers.Authorization = `Bearer ${signMachineBearerToken(
          {
            subject: this.target.bearerSubject,
            issuer: DEFAULT_CALLBACK_ISSUER,
            audience: DEFAULT_CALLBACK_AUDIENCE,
            scopes: [options.bearerScope ?? this.target.defaultBearerScope],
            ttlSeconds: 120,
          },
          options.bearerSigningSecret,
        )}`;
      }

      let httpStatus: number | null = null;
      let dispatchError: unknown = null;
      let deliveredOk = false;

      try {
        const response = await this.fetchImpl(options.callbackUrl, {
          method: "POST",
          redirect: "error",
          headers,
          body,
          signal: AbortSignal.timeout(requestTimeoutMs),
        });
        httpStatus = response.status;
        deliveredOk = response.ok;
      } catch (error) {
        dispatchError = error;
      }

      if (deliveredOk) {
        const ack = await this.pool.query(
          `UPDATE ${this.target.tableName}
              SET status = 'delivered',
                  last_http_status = $3,
                  last_error_code = NULL,
                  lease_token = NULL,
                  lease_expires_at = NULL,
                  delivered_at = now(),
                  updated_at = now()
            WHERE id = $1 AND lease_token = $2 AND status = 'processing'`,
          [item.id, item.leaseToken, httpStatus ?? 200],
        );
        if (ack.rowCount === 1) summary.delivered += 1;
        else summary.leaseConflicts += 1;
        continue;
      }

      const failure = classifyFailure(httpStatus, dispatchError);
      const shouldDeadLetter = !failure.retryable || item.attemptCount >= item.maxAttempts;

      if (shouldDeadLetter) {
        const dead = await this.pool.query(
          `UPDATE ${this.target.tableName}
              SET status = 'dead',
                  attempt_count = $3,
                  last_http_status = $4,
                  last_error_code = $5,
                  lease_token = NULL,
                  lease_expires_at = NULL,
                  dead_lettered_at = now(),
                  updated_at = now()
            WHERE id = $1 AND lease_token = $2 AND status = 'processing'`,
          [item.id, item.leaseToken, item.attemptCount, httpStatus, failure.code],
        );
        if (dead.rowCount === 1) summary.deadLettered += 1;
        else summary.leaseConflicts += 1;
        continue;
      }

      const retryDelaySeconds = computeRetryDelaySeconds(
        item.attemptCount,
        retryBaseSeconds,
        retryMaxSeconds,
        jitterRatio,
        this.randomFn,
      );

      const retried = await this.pool.query(
        `UPDATE ${this.target.tableName}
            SET status = 'pending',
                attempt_count = $3,
                last_http_status = $4,
                last_error_code = $5,
                next_attempt_at = now() + ($6::integer * interval '1 second'),
                lease_token = NULL,
                lease_expires_at = NULL,
                updated_at = now()
          WHERE id = $1 AND lease_token = $2 AND status = 'processing'`,
        [item.id, item.leaseToken, item.attemptCount, httpStatus, failure.code, retryDelaySeconds],
      );
      if (retried.rowCount === 1) summary.retried += 1;
      else summary.leaseConflicts += 1;
    }

    return summary;
  }

  async replayOutboxEntry(outboxId: string): Promise<OutboxReplayResult | null> {
    if (!uuidPattern.test(outboxId)) {
      throw new Error("INVALID_OUTBOX_ID");
    }
    const result = await this.pool.query<{
      id: string;
      operation_id: string;
      status: string;
      max_attempts: number;
    }>(
      `UPDATE ${this.target.tableName}
          SET status = 'pending',
              next_attempt_at = now(),
              lease_token = NULL,
              lease_expires_at = NULL,
              dead_lettered_at = NULL,
              max_attempts = GREATEST(max_attempts, attempt_count + 3),
              updated_at = now()
        WHERE id = $1
          AND (status IN ('dead', 'pending') OR (status = 'processing' AND lease_expires_at <= now()))
        RETURNING id::text, ${this.target.referenceColumn}::text AS operation_id, status, max_attempts`,
      [outboxId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      outboxId: row.id,
      operationId: row.operation_id,
      status: row.status,
      maxAttempts: row.max_attempts,
    };
  }
}

/**
 * Bounded lease-fenced dispatcher for PostgreSQL `product_provisioning_status_outbox`.
 */
export class PlatformStatusOutboxDispatcher extends BoundedLeaseOutboxDispatcher {
  constructor(
    pool: CommercialSqlPool,
    fetchImpl: FetchLike = (url, init) => fetch(url, init),
    randomFn: () => number = () => Math.random(),
  ) {
    super(
      {
        tableName: "public.product_provisioning_status_outbox",
        referenceColumn: "operation_id",
        bearerSubject: "bazion-platform-status-dispatcher",
        defaultBearerScope: "provisioning:status:write",
      },
      pool,
      fetchImpl,
      randomFn,
    );
  }
}

/**
 * Bounded lease-fenced dispatcher for PostgreSQL `product_subscription_lifecycle_outbox`.
 */
export class PlatformLifecycleOutboxDispatcher extends BoundedLeaseOutboxDispatcher {
  constructor(
    pool: CommercialSqlPool,
    fetchImpl: FetchLike = (url, init) => fetch(url, init),
    randomFn: () => number = () => Math.random(),
  ) {
    super(
      {
        tableName: "public.product_subscription_lifecycle_outbox",
        referenceColumn: "lifecycle_inbox_id",
        bearerSubject: "bazion-platform-lifecycle-dispatcher",
        defaultBearerScope: "provisioning:status:write",
      },
      pool,
      fetchImpl,
      randomFn,
    );
  }
}
