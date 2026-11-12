import {
  provisionProductRequestV1Schema,
  provisioningOperationV1Schema,
  type ProvisioningOperationStatus,
  type ProvisioningOperationV1,
} from "@bazion/api-contracts";
import { computeProvisioningRequestFingerprint } from "./fingerprint.js";
import {
  platformProvisioningOfferBindings,
  ProvisioningOfferResolutionError,
  resolveProvisioningOfferBinding,
  type ProvisioningOfferBinding,
  type ProvisioningDistributionMode,
} from "./offer-resolution.js";

export interface SqlResult<T> {
  rows: T[];
  rowCount: number | null;
}

export interface SqlClient {
  query<T = Record<string, unknown>>(statement: string, values?: unknown[]): Promise<SqlResult<T>>;
  release(): void;
}

export interface CommercialSqlPool {
  connect(): Promise<SqlClient>;
  query<T = Record<string, unknown>>(statement: string, values?: unknown[]): Promise<SqlResult<T>>;
}

export class CommercialProvisioningError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly issues?: Array<{ path: string; code: string }>,
  ) {
    super(message);
    this.name = "CommercialProvisioningError";
  }
}

export interface AcceptProvisioningCommandResult {
  deduplicated: boolean;
  operation: ProvisioningOperationV1;
}

export interface CommercialDeliveryReconciliationReport {
  generatedAt: string;
  staleAcceptedThresholdSeconds: number;
  counts: {
    acceptedWithoutProgress: number;
    pendingOutbox: number;
    processingOutbox: number;
    overdueOutbox: number;
    deadOutbox: number;
  };
  stalledOperations: Array<{
    operationId: string;
    externalOrderId: string;
    status: string;
    currentStep: string | null;
    acceptedAt: string;
    updatedAt: string;
  }>;
  deadOutboxItems: Array<{
    outboxId: string;
    operationId: string;
    eventId: string;
    statusSnapshot: string;
    attemptCount: number;
    lastHttpStatus: number | null;
    lastErrorCode: string | null;
    deadLetteredAt: string | null;
  }>;
}

interface OperationRow {
  id: string;
  schema_version: string;
  correlation_id: string;
  external_order_id: string;
  status: string;
  current_step: string | null;
  tenant_id: string | null;
  installation_id: string | null;
  failure_code: string | null;
  failure_retryable: boolean | null;
  failure_disposition?: "retry" | "compensate" | "unknown" | "compensation_failed" | null;
  updated_at: Date | string;
}

interface InboxMatchRow extends OperationRow {
  inbox_id: string;
  inbox_event_id: string;
  inbox_correlation_id: string;
  inbox_idempotency_key: string;
  inbox_external_order_id: string;
  inbox_request_fingerprint: string;
}

interface LegacyOperationMatchRow extends OperationRow {
  event_id: string;
  idempotency_key: string;
  request_fingerprint: string;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function iso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("PROVISIONING_TIMESTAMP_INVALID");
  return date.toISOString();
}

function mapOperationRow(row: OperationRow): ProvisioningOperationV1 {
  return provisioningOperationV1Schema.parse({
    schemaVersion: row.schema_version,
    operationId: row.id,
    correlationId: row.correlation_id,
    externalOrderId: row.external_order_id,
    status: row.status,
    currentStep: row.current_step,
    tenantId: row.tenant_id,
    installationId: row.installation_id,
    failure: row.failure_code
      ? { code: row.failure_code, retryable: Boolean(row.failure_retryable) }
      : null,
    updatedAt: iso(row.updated_at),
  });
}

const allowedOperationTransitions: Readonly<Record<ProvisioningOperationStatus, readonly ProvisioningOperationStatus[]>> = {
  accepted: ["validating", "failed"],
  validating: ["provisioning_tenant", "configuring_installation", "provisioning_hosting", "failed", "compensating", "compensation_required"],
  provisioning_tenant: ["configuring_installation", "provisioning_hosting", "failed", "compensating", "compensation_required"],
  configuring_installation: ["provisioning_tenant", "provisioning_hosting", "ready", "failed", "compensating", "compensation_required"],
  provisioning_hosting: ["configuring_installation", "ready", "failed", "compensating", "compensation_required"],
  ready: [],
  compensating: ["compensation_required", "compensated"],
  compensation_required: ["compensating"],
  compensated: [],
  failed: [],
};

/**
 * Durable command intake, operation state transitions, and delivery reconciliation
 * backed by PostgreSQL tables from migrations 0018 and 0019.
 */
export class CommercialProvisioningService {
  constructor(
    private readonly pool: CommercialSqlPool,
    private readonly offerBindings: readonly ProvisioningOfferBinding[] = platformProvisioningOfferBindings,
    private readonly supportedDistributionModes: readonly ProvisioningDistributionMode[] = ["shared-managed"],
  ) {}

  async acceptCommand(rawInput: unknown): Promise<AcceptProvisioningCommandResult> {
    const parsed = provisionProductRequestV1Schema.safeParse(rawInput);
    if (!parsed.success) {
      throw new CommercialProvisioningError(
        400,
        "INVALID_PROVISIONING_REQUEST",
        "Provisioning request failed schema validation.",
        parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          code: issue.code,
        })),
      );
    }

    const request = parsed.data;
    const fingerprint = computeProvisioningRequestFingerprint(request);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext($1)), pg_advisory_xact_lock(hashtext($2)), pg_advisory_xact_lock(hashtext($3))",
        [
          `idem:${request.source}:${request.idempotencyKey}`,
          `event:${request.source}:${request.eventId}`,
          `order:${request.source}:${request.order.externalOrderId}`,
        ],
      );

      const matches = await client.query<InboxMatchRow>(
        `SELECT i.id AS inbox_id,
                i.event_id AS inbox_event_id,
                i.correlation_id AS inbox_correlation_id,
                i.idempotency_key AS inbox_idempotency_key,
                i.external_order_id AS inbox_external_order_id,
                i.request_fingerprint AS inbox_request_fingerprint,
                o.id::text, o.schema_version, o.correlation_id::text, o.external_order_id,
                o.status, o.current_step, o.tenant_id::text, o.installation_id::text,
                o.failure_code, o.failure_retryable, o.updated_at
           FROM public.product_provisioning_inbox i
           JOIN public.product_provisioning_operations o ON o.id = i.operation_id
          WHERE i.source = $1
            AND (i.idempotency_key = $2 OR i.event_id = $3 OR i.external_order_id = $4)`,
        [request.source, request.idempotencyKey, request.eventId, request.order.externalOrderId],
      );

      if (matches.rows.length > 0) {
        const match = matches.rows[0]!;
        const exactMatch =
          matches.rows.length === 1 &&
          match.inbox_idempotency_key === request.idempotencyKey &&
          match.inbox_event_id === request.eventId &&
          match.inbox_correlation_id === request.correlationId &&
          match.inbox_external_order_id === request.order.externalOrderId &&
          match.inbox_request_fingerprint === fingerprint;

        if (!exactMatch) {
          throw new CommercialProvisioningError(
            409,
            "PROVISIONING_IDEMPOTENCY_CONFLICT",
            "Provisioning command conflicts with an existing idempotency key, event ID, or order payload.",
          );
        }

        await client.query(
          `UPDATE public.product_provisioning_inbox
              SET received_count = received_count + 1,
                  last_received_at = now()
            WHERE id = $1`,
          [match.inbox_id],
        );

        await client.query("COMMIT");
        return {
          deduplicated: true,
          operation: mapOperationRow(match),
        };
      }

      // Check existing operations directly in case a row existed prior to inbox adoption.
      const legacyMatches = await client.query<LegacyOperationMatchRow>(
        `SELECT id::text, schema_version, event_id::text, correlation_id::text,
                idempotency_key, external_order_id,
                status, current_step, tenant_id::text, installation_id::text,
                failure_code, failure_retryable, updated_at, request_fingerprint
           FROM public.product_provisioning_operations
          WHERE source = $1
            AND (idempotency_key = $2 OR event_id = $3 OR external_order_id = $4)`,
        [request.source, request.idempotencyKey, request.eventId, request.order.externalOrderId],
      );
      if (legacyMatches.rows.length > 0) {
        const existing = legacyMatches.rows[0]!;
        const samePayload =
          legacyMatches.rows.length === 1 &&
          existing.idempotency_key === request.idempotencyKey &&
          existing.event_id === request.eventId &&
          existing.correlation_id === request.correlationId &&
          existing.external_order_id === request.order.externalOrderId &&
          existing.request_fingerprint === fingerprint;
        if (!samePayload) {
          throw new CommercialProvisioningError(
            409,
            "PROVISIONING_IDEMPOTENCY_CONFLICT",
            "Provisioning command conflicts with an existing provisioning operation.",
          );
        }
        await client.query(
          `INSERT INTO public.product_provisioning_inbox (
             source, event_id, correlation_id, idempotency_key,
             external_order_id, request_fingerprint, operation_id
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT DO NOTHING`,
          [
            request.source,
            request.eventId,
            request.correlationId,
            request.idempotencyKey,
            request.order.externalOrderId,
            fingerprint,
            existing.id,
          ],
        );
        await client.query("COMMIT");
        return {
          deduplicated: true,
          operation: mapOperationRow(existing),
        };
      }

      try {
        // The platform resolves authority from its own immutable binding before
        // inserting an operation. Client-supplied pins are checked, never trusted.
        resolveProvisioningOfferBinding(request, this.offerBindings, this.supportedDistributionModes);
      } catch (error) {
        if (!(error instanceof ProvisioningOfferResolutionError)) throw error;
        throw new CommercialProvisioningError(
          422,
          error.code,
          "The requested offer is not currently bound to a supported platform release.",
          [{ path: "order.offerId", code: error.code }],
        );
      }

      const insertedOperation = await client.query<OperationRow>(
        `INSERT INTO public.product_provisioning_operations (
           schema_version, source, event_id, correlation_id, idempotency_key,
           request_fingerprint, external_customer_id, external_order_id,
           offer_id, offer_version, product_id, product_version,
           solution_id, solution_version, template_id, template_version,
           requested_domain, status, current_step
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8,
           $9, $10, $11, $12,
           $13, $14, $15, $16,
           $17, 'accepted', 'accept_command'
         )
         RETURNING id::text, schema_version, correlation_id::text, external_order_id,
                   status, current_step, tenant_id::text, installation_id::text,
                   failure_code, failure_retryable, updated_at`,
        [
          request.schemaVersion,
          request.source,
          request.eventId,
          request.correlationId,
          request.idempotencyKey,
          fingerprint,
          request.customer.externalCustomerId,
          request.order.externalOrderId,
          request.order.offerId,
          request.order.offerVersion,
          request.composition.product.id,
          request.composition.product.version,
          request.composition.solution.id,
          request.composition.solution.version,
          request.composition.template.id,
          request.composition.template.version,
          request.requestedDomain ?? null,
        ],
      );

      const operationRow = insertedOperation.rows[0]!;
      await client.query(
        `INSERT INTO public.product_provisioning_inbox (
           source, event_id, correlation_id, idempotency_key,
           external_order_id, request_fingerprint, operation_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          request.source,
          request.eventId,
          request.correlationId,
          request.idempotencyKey,
          request.order.externalOrderId,
          fingerprint,
          operationRow.id,
        ],
      );

      await client.query("COMMIT");
      return {
        deduplicated: false,
        operation: mapOperationRow(operationRow),
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async getOperation(operationId: string): Promise<ProvisioningOperationV1> {
    if (!uuidPattern.test(operationId)) {
      throw new CommercialProvisioningError(400, "INVALID_OPERATION_ID", "Invalid operation identifier.");
    }
    const result = await this.pool.query<OperationRow>(
      `SELECT id::text, schema_version, correlation_id::text, external_order_id,
              status, current_step, tenant_id::text, installation_id::text,
              failure_code, failure_retryable, updated_at
         FROM public.product_provisioning_operations
        WHERE id = $1`,
      [operationId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new CommercialProvisioningError(404, "PROVISIONING_OPERATION_NOT_FOUND", "Provisioning operation was not found.");
    }
    return mapOperationRow(row);
  }

  async transitionOperation(input: {
    operationId: string;
    nextStatus: ProvisioningOperationStatus;
    currentStep?: string | null;
    tenantId?: string | null;
    installationId?: string | null;
    failure?: { code: string; retryable: boolean; disposition?: "retry" | "compensate" | "unknown" | "compensation_failed" } | null;
  }): Promise<ProvisioningOperationV1> {
    if (!uuidPattern.test(input.operationId)) {
      throw new CommercialProvisioningError(400, "INVALID_OPERATION_ID", "Invalid operation identifier.");
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const currentResult = await client.query<OperationRow>(
        `SELECT id::text, schema_version, correlation_id::text, external_order_id,
                status, current_step, tenant_id::text, installation_id::text,
                failure_code, failure_retryable, failure_disposition, updated_at
           FROM public.product_provisioning_operations
          WHERE id = $1
          FOR UPDATE`,
        [input.operationId],
      );
      const current = currentResult.rows[0];
      if (!current) {
        throw new CommercialProvisioningError(404, "PROVISIONING_OPERATION_NOT_FOUND", "Provisioning operation was not found.");
      }

      const currentStatus = current.status as ProvisioningOperationStatus;
      const retryDispositionAllowsTransition = currentStatus === "failed"
        && ((input.nextStatus === "validating" && current.failure_disposition === "retry")
          || (input.nextStatus === "compensating" && current.failure_disposition === "compensate"));
      const compensationDispositionAllowsTransition = currentStatus === "compensation_required"
        && input.nextStatus === "compensating"
        && current.failure_disposition === "compensation_failed";
      const isAllowed = currentStatus === input.nextStatus
        || allowedOperationTransitions[currentStatus].includes(input.nextStatus)
        || retryDispositionAllowsTransition
        || compensationDispositionAllowsTransition;
      if (!isAllowed) {
        throw new CommercialProvisioningError(
          409,
          "INVALID_OPERATION_TRANSITION",
          `Cannot transition provisioning operation from ${currentStatus} to ${input.nextStatus}.`,
        );
      }

      const nextIsFailureState = input.nextStatus === "failed" || input.nextStatus === "compensation_required";
      if (input.failure && !nextIsFailureState) {
        throw new CommercialProvisioningError(400, "FAILURE_REQUIRES_FAILURE_STATE", "Failure details require a failed or compensation-required operation state.");
      }
      if (nextIsFailureState && currentStatus !== input.nextStatus && !input.failure) {
        throw new CommercialProvisioningError(400, "FAILURE_DETAILS_REQUIRED", "A failure code and retry disposition are required for this operation state.");
      }
      if (input.failure && input.nextStatus === "failed"
        && ["unknown", "compensation_failed"].includes(input.failure.disposition ?? "")) {
        throw new CommercialProvisioningError(400, "FAILURE_DISPOSITION_INVALID", "Failed operations require retry or compensate disposition.");
      }
      if (input.failure && input.nextStatus === "compensation_required"
        && ["retry", "compensate"].includes(input.failure.disposition ?? "")) {
        throw new CommercialProvisioningError(400, "FAILURE_DISPOSITION_INVALID", "Compensation-required operations need unknown or compensation_failed disposition.");
      }

      const nextTenantId = input.tenantId ?? current.tenant_id;
      const nextInstallationId = input.installationId ?? current.installation_id;
      const nextStep = input.currentStep === undefined ? current.current_step : input.currentStep;
      const failureCode = input.failure
        ? input.failure.code
        : (nextIsFailureState ? current.failure_code : null);
      const failureRetryable = input.failure
        ? input.failure.retryable
        : (nextIsFailureState ? current.failure_retryable : null);
      const failureDisposition = input.failure
        ? input.failure.disposition ?? (input.nextStatus === "compensation_required"
            ? "unknown"
            : (input.failure.retryable ? "retry" : "compensate"))
        : (nextIsFailureState ? current.failure_disposition ?? null : null);

      const updatedResult = await client.query<OperationRow>(
        `UPDATE public.product_provisioning_operations
            SET status = $2,
                current_step = $3,
                tenant_id = $4,
                installation_id = $5,
                failure_code = $6,
                failure_retryable = $7,
                failure_disposition = $8
          WHERE id = $1
          RETURNING id::text, schema_version, correlation_id::text, external_order_id,
                    status, current_step, tenant_id::text, installation_id::text,
                    failure_code, failure_retryable, updated_at`,
        [
          input.operationId,
          input.nextStatus,
          nextStep,
          nextTenantId,
          nextInstallationId,
          failureCode,
          failureRetryable,
          failureDisposition,
        ],
      );

      await client.query("COMMIT");
      return mapOperationRow(updatedResult.rows[0]!);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async reconcile(staleAcceptedThresholdSeconds = 300): Promise<CommercialDeliveryReconciliationReport> {
    const threshold = Math.max(30, Math.min(86_400, Math.trunc(staleAcceptedThresholdSeconds)));
    const [countsResult, stalledResult, deadResult] = await Promise.all([
      this.pool.query<{
        accepted_without_progress: number;
        pending_outbox: number;
        processing_outbox: number;
        overdue_outbox: number;
        dead_outbox: number;
      }>(
        `SELECT
           (SELECT count(*)::int FROM public.product_provisioning_operations
             WHERE status = 'accepted' AND accepted_at <= now() - ($1::integer * interval '1 second')) AS accepted_without_progress,
           (SELECT count(*)::int FROM public.product_provisioning_status_outbox WHERE status = 'pending') AS pending_outbox,
           (SELECT count(*)::int FROM public.product_provisioning_status_outbox WHERE status = 'processing') AS processing_outbox,
           (SELECT count(*)::int FROM public.product_provisioning_status_outbox
             WHERE (status = 'pending' AND next_attempt_at <= now() - interval '60 seconds')
                OR (status = 'processing' AND lease_expires_at <= now())) AS overdue_outbox,
           (SELECT count(*)::int FROM public.product_provisioning_status_outbox WHERE status = 'dead') AS dead_outbox`,
        [threshold],
      ),
      this.pool.query<{
        id: string;
        external_order_id: string;
        status: string;
        current_step: string | null;
        accepted_at: Date | string;
        updated_at: Date | string;
      }>(
        `SELECT id::text, external_order_id, status, current_step, accepted_at, updated_at
           FROM public.product_provisioning_operations
          WHERE status IN ('accepted', 'validating', 'provisioning_tenant', 'configuring_installation', 'provisioning_hosting', 'compensating')
            AND updated_at <= now() - ($1::integer * interval '1 second')
          ORDER BY accepted_at ASC
          LIMIT 50`,
        [threshold],
      ),
      this.pool.query<{
        id: string;
        operation_id: string;
        event_id: string;
        status_snapshot: string;
        attempt_count: number;
        last_http_status: number | null;
        last_error_code: string | null;
        dead_lettered_at: Date | string | null;
      }>(
        `SELECT id::text, operation_id::text, event_id::text, status_snapshot,
                attempt_count, last_http_status, last_error_code, dead_lettered_at
           FROM public.product_provisioning_status_outbox
          WHERE status = 'dead'
          ORDER BY dead_lettered_at DESC NULLS LAST, created_at DESC
          LIMIT 50`,
      ),
    ]);

    const c = countsResult.rows[0] ?? {
      accepted_without_progress: 0,
      pending_outbox: 0,
      processing_outbox: 0,
      overdue_outbox: 0,
      dead_outbox: 0,
    };

    return {
      generatedAt: new Date().toISOString(),
      staleAcceptedThresholdSeconds: threshold,
      counts: {
        acceptedWithoutProgress: c.accepted_without_progress,
        pendingOutbox: c.pending_outbox,
        processingOutbox: c.processing_outbox,
        overdueOutbox: c.overdue_outbox,
        deadOutbox: c.dead_outbox,
      },
      stalledOperations: stalledResult.rows.map((row) => ({
        operationId: row.id,
        externalOrderId: row.external_order_id,
        status: row.status,
        currentStep: row.current_step,
        acceptedAt: iso(row.accepted_at),
        updatedAt: iso(row.updated_at),
      })),
      deadOutboxItems: deadResult.rows.map((row) => ({
        outboxId: row.id,
        operationId: row.operation_id,
        eventId: row.event_id,
        statusSnapshot: row.status_snapshot,
        attemptCount: row.attempt_count,
        lastHttpStatus: row.last_http_status,
        lastErrorCode: row.last_error_code,
        deadLetteredAt: row.dead_lettered_at ? iso(row.dead_lettered_at) : null,
      })),
    };
  }
}
