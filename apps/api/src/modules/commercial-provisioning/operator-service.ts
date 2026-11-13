import {
  provisioningManualReviewRequestSchema,
  provisioningOperationDetailV1Schema,
  provisioningOperationSummaryV1Schema,
  provisioningOperatorActionRequestSchema,
  type ProvisioningOperationDetailV1,
  type ProvisioningOperationSummaryV1,
} from "@bazion/api-contracts";
import { PostgresAuditEventWriter } from "@bazion/audit";
import type { CommercialProvisioningSagaOrchestrator } from "./saga-orchestrator.js";
import { CommercialProvisioningError, type CommercialSqlPool } from "./service.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface OperatorActor {
  userId: string;
  role: string;
}

function iso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("PROVISIONING_TIMESTAMP_INVALID");
  return date.toISOString();
}

export type ProvisioningOperationListItem = ProvisioningOperationSummaryV1;

/**
 * Operator inspection and audited manual intervention service for provisioning sagas.
 * Records actor, reason, and before/after state into immutable platform_audit_events.
 */
export class CommercialProvisioningOperatorService {
  constructor(
    private readonly provisionerPool: CommercialSqlPool,
    private readonly orchestrator: CommercialProvisioningSagaOrchestrator | null,
    private readonly auditWriter: PostgresAuditEventWriter,
  ) {}

  async listOperations(filter: {
    status?: string;
    externalOrderId?: string;
    tenantId?: string;
    limit?: number;
  } = {}): Promise<ProvisioningOperationListItem[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filter.status?.trim()) {
      params.push(filter.status.trim());
      clauses.push(`status = $${params.length}`);
    }
    if (filter.externalOrderId?.trim()) {
      params.push(filter.externalOrderId.trim());
      clauses.push(`external_order_id = $${params.length}`);
    }
    if (filter.tenantId?.trim()) {
      if (!UUID_REGEX.test(filter.tenantId.trim())) {
        throw new CommercialProvisioningError(400, "INVALID_INPUT", "tenantId must be a valid UUID.");
      }
      params.push(filter.tenantId.trim());
      clauses.push(`tenant_id = $${params.length}`);
    }

    const safeLimit = Math.max(1, Math.min(100, filter.limit ?? 40));
    params.push(safeLimit);

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const res = await this.provisionerPool.query<{
      id: string;
      schema_version: string;
      correlation_id: string;
      external_order_id: string;
      offer_id: string;
      offer_version: string;
      status: string;
      current_step: string | null;
      tenant_id: string | null;
      installation_id: string | null;
      failure_code: string | null;
      failure_retryable: boolean | null;
      failure_disposition: string | null;
      fencing_token: string | number;
      worker_id: string | null;
      lease_expires_at: Date | string | null;
      attempt_count: number;
      retry_after_at: Date | string | null;
      accepted_at: Date | string;
      updated_at: Date | string;
      finished_at: Date | string | null;
    }>(
      `SELECT id::text, schema_version, correlation_id::text, external_order_id,
              offer_id, offer_version, status, current_step, tenant_id::text, installation_id::text,
              failure_code, failure_retryable, failure_disposition, fencing_token, worker_id,
              lease_expires_at, attempt_count, retry_after_at, accepted_at, updated_at, finished_at
       FROM public.product_provisioning_operations
       ${whereClause}
       ORDER BY updated_at DESC, accepted_at DESC
       LIMIT $${params.length}`,
      params,
    );

    return res.rows.map((row) => provisioningOperationSummaryV1Schema.parse({
      operation: {
        schemaVersion: row.schema_version,
        operationId: row.id,
        correlationId: row.correlation_id,
        externalOrderId: row.external_order_id,
        status: row.status,
        currentStep: row.current_step,
        tenantId: row.tenant_id,
        installationId: row.installation_id,
        failure: row.failure_code ? { code: row.failure_code, retryable: Boolean(row.failure_retryable) } : null,
        updatedAt: iso(row.updated_at),
      },
      offerId: row.offer_id,
      offerVersion: row.offer_version,
      failureDisposition: row.failure_disposition,
      holderWorkerId: row.worker_id,
      fencingToken: Number(row.fencing_token ?? 0),
      leaseExpiresAt: row.lease_expires_at ? iso(row.lease_expires_at) : null,
      attemptCount: Number(row.attempt_count ?? 0),
      retryAfterAt: row.retry_after_at ? iso(row.retry_after_at) : null,
      acceptedAt: iso(row.accepted_at),
      finishedAt: row.finished_at ? iso(row.finished_at) : null,
    }));
  }

  async getOperationDetail(operationId: string): Promise<ProvisioningOperationDetailV1> {
    if (!UUID_REGEX.test(operationId)) {
      throw new CommercialProvisioningError(400, "INVALID_INPUT", "operationId must be a valid UUID.");
    }

    const opRes = await this.provisionerPool.query<{
      id: string;
      schema_version: string;
      source: string;
      correlation_id: string;
      external_customer_id: string;
      external_order_id: string;
      offer_id: string;
      offer_version: string;
      requested_domain: string | null;
      status: string;
      current_step: string | null;
      tenant_id: string | null;
      installation_id: string | null;
      failure_code: string | null;
      failure_retryable: boolean | null;
      failure_disposition: string | null;
      worker_id: string | null;
      fencing_token: string | number;
      lease_expires_at: Date | string | null;
      attempt_count: number;
      retry_after_at: Date | string | null;
      manual_review_note: string | null;
      last_operator_actor_id: string | null;
      accepted_at: Date | string;
      updated_at: Date | string;
      finished_at: Date | string | null;
    }>(
      `SELECT id::text, schema_version, source, correlation_id::text, external_customer_id,
              external_order_id, offer_id, offer_version, requested_domain, status,
              current_step, tenant_id::text, installation_id::text,
              failure_code, failure_retryable, failure_disposition,
              worker_id, fencing_token, lease_expires_at, attempt_count, retry_after_at,
              manual_review_note, last_operator_actor_id, accepted_at, updated_at, finished_at
       FROM public.product_provisioning_operations
       WHERE id = $1
       LIMIT 1`,
      [operationId],
    );
    const op = opRes.rows[0];
    if (!op) {
      throw new CommercialProvisioningError(404, "PROVISIONING_OPERATION_NOT_FOUND", "Provisioning operation was not found.");
    }

    const [attemptsRes, eventsRes] = await Promise.all([
      this.provisionerPool.query<{
        id: string;
        step_name: string;
        direction: string;
        attempt_number: number;
        status: string;
        fencing_token: string | number;
        correlation_id: string | null;
        effect_refs: Record<string, string> | null;
        error_code: string | null;
        retryable: boolean | null;
        failure_disposition: string | null;
        started_at: Date | string;
        finished_at: Date | string | null;
      }>(
        `SELECT id::text, step_name, direction, attempt_number, status,
                fencing_token, correlation_id::text, effect_refs, error_code,
                retryable, failure_disposition, started_at, finished_at
         FROM public.product_provisioning_step_attempts
         WHERE operation_id = $1
         ORDER BY started_at ASC, attempt_number ASC`,
        [operationId],
      ),
      this.provisionerPool.query<{
        id: string;
        event_type: string;
        status: string;
        current_step: string | null;
        failure_code: string | null;
        occurred_at: Date | string;
      }>(
        `SELECT id::text, event_type, status, current_step, failure_code, occurred_at
         FROM public.product_provisioning_operation_events
         WHERE operation_id = $1
         ORDER BY occurred_at ASC, id ASC
         LIMIT 100`,
        [operationId],
      ),
    ]);

    return provisioningOperationDetailV1Schema.parse({
      operation: {
        schemaVersion: op.schema_version,
        operationId: op.id,
        correlationId: op.correlation_id,
        externalOrderId: op.external_order_id,
        status: op.status,
        currentStep: op.current_step,
        tenantId: op.tenant_id,
        installationId: op.installation_id,
        failure: op.failure_code ? { code: op.failure_code, retryable: Boolean(op.failure_retryable) } : null,
        updatedAt: iso(op.updated_at),
      },
      source: op.source,
      externalCustomerId: op.external_customer_id,
      offerId: op.offer_id,
      offerVersion: op.offer_version,
      requestedDomain: op.requested_domain,
      lease: {
        holderWorkerId: op.worker_id,
        fencingToken: Number(op.fencing_token ?? 0),
        leaseExpiresAt: op.lease_expires_at ? iso(op.lease_expires_at) : null,
        attemptCount: Number(op.attempt_count ?? 0),
        retryAfterAt: op.retry_after_at ? iso(op.retry_after_at) : null,
      },
      failureDisposition: op.failure_disposition,
      manualReviewNote: op.manual_review_note,
      lastOperatorActorId: op.last_operator_actor_id,
      acceptedAt: iso(op.accepted_at),
      finishedAt: op.finished_at ? iso(op.finished_at) : null,
      stepAttempts: attemptsRes.rows.map((row) => ({
        id: row.id,
        stepName: row.step_name,
        direction: row.direction,
        attemptNumber: Number(row.attempt_number),
        status: row.status,
        fencingToken: Number(row.fencing_token ?? 0),
        correlationId: row.correlation_id,
        effectRefs: row.effect_refs ?? {},
        errorCode: row.error_code,
        retryable: row.retryable,
        failureDisposition: row.failure_disposition,
        startedAt: iso(row.started_at),
        finishedAt: row.finished_at ? iso(row.finished_at) : null,
      })),
      events: eventsRes.rows.map((row) => ({
        id: row.id,
        eventType: row.event_type,
        status: row.status,
        currentStep: row.current_step,
        failureCode: row.failure_code,
        occurredAt: iso(row.occurred_at),
      })),
    });
  }

  async performOperatorAction(input: {
    operationId: string;
    action: "retry" | "resume" | "reconcile" | "compensate";
    actor: OperatorActor;
    body: unknown;
    requestId: string;
  }): Promise<ProvisioningOperationDetailV1> {
    const parsed = provisioningOperatorActionRequestSchema.safeParse(input.body);
    if (!parsed.success) {
      throw new CommercialProvisioningError(
        400,
        "INVALID_INPUT",
        parsed.error.issues[0]?.message ?? "Operator action requires a descriptive reason (min 8 characters).",
      );
    }

    if (input.action === "compensate" && !parsed.data.confirmDestructive) {
      throw new CommercialProvisioningError(
        400,
        "DESTRUCTIVE_CONFIRMATION_REQUIRED",
        "Compensation requires explicit confirmDestructive: true confirmation.",
      );
    }

    const before = await this.getOperationDetail(input.operationId);
    const prevStatus = before.operation.status;

    if (["ready", "compensated"].includes(prevStatus)) {
      throw new CommercialProvisioningError(
        409,
        "OPERATION_ALREADY_TERMINAL",
        `Cannot run ${input.action} on terminal operation status '${prevStatus}'.`,
      );
    }

    await this.auditWriter.append({
      actorType: "user",
      actorId: input.actor.userId,
      actorRole: input.actor.role,
      tenantId: before.operation.tenantId,
      action: `commercial.provisioning.operation.${input.action}.requested`,
      resourceType: "product_provisioning_operation",
      resourceId: input.operationId,
      outcome: "succeeded",
      requestId: input.requestId,
      metadata: {
        beforeStatus: prevStatus,
        reasonLength: parsed.data.reason.length,
        fencingEpoch: before.lease.fencingToken,
      },
    });

    try {
      // Clear expired lease or retry cooldown so operator action can claim immediately
      await this.provisionerPool.query(
        `UPDATE public.product_provisioning_operations
         SET last_operator_actor_id = $2,
             retry_after_at = NULL,
             lease_expires_at = CASE WHEN lease_expires_at > now() THEN lease_expires_at ELSE NULL END
         WHERE id = $1`,
        [input.operationId, input.actor.userId],
      );

      if (this.orchestrator) {
        if (input.action === "compensate") {
          const outcome = await this.orchestrator.runOperation(input.operationId, {
            resumeCompensation: true,
          });
          if (!outcome.claimed) {
            throw new CommercialProvisioningError(409, "OPERATION_LEASE_ACTIVE", "Operation is currently locked by another worker.");
          }
        } else {
          const outcome = await this.orchestrator.runOperation(input.operationId, {
            resumeForward: true,
            forceInspect: input.action === "reconcile",
          });
          if (!outcome.claimed) {
            throw new CommercialProvisioningError(409, "OPERATION_LEASE_ACTIVE", "Operation is currently locked by another worker.");
          }
        }
      } else {
        // State-only fallback when orchestrator is not injected
        const nextStatus =
          input.action === "compensate"
            ? "compensating"
            : "validating";
        await this.provisionerPool.query(
          `UPDATE public.product_provisioning_operations
           SET status = $2, last_operator_actor_id = $3
           WHERE id = $1`,
          [input.operationId, nextStatus, input.actor.userId],
        );
      }

      const after = await this.getOperationDetail(input.operationId);
      await this.auditWriter.append({
        actorType: "user",
        actorId: input.actor.userId,
        actorRole: input.actor.role,
        tenantId: after.operation.tenantId,
        action: `commercial.provisioning.operation.${input.action}.completed`,
        resourceType: "product_provisioning_operation",
        resourceId: input.operationId,
        outcome: "succeeded",
        requestId: input.requestId,
        metadata: {
          beforeStatus: prevStatus,
          afterStatus: after.operation.status,
          fencingEpoch: after.lease.fencingToken,
        },
      });
      return after;
    } catch (error) {
      await this.auditWriter
        .append({
          actorType: "user",
          actorId: input.actor.userId,
          actorRole: input.actor.role,
          tenantId: before.operation.tenantId,
          action: `commercial.provisioning.operation.${input.action}.failed`,
          resourceType: "product_provisioning_operation",
          resourceId: input.operationId,
          outcome: "failed",
          requestId: input.requestId,
          metadata: {
            beforeStatus: prevStatus,
            errorCode: error instanceof CommercialProvisioningError ? error.code : "OPERATOR_ACTION_FAILED",
          },
        })
        .catch(() => undefined);
      throw error;
    }
  }

  async completeManualReview(input: {
    operationId: string;
    actor: OperatorActor;
    body: unknown;
    requestId: string;
  }): Promise<ProvisioningOperationDetailV1> {
    const parsed = provisioningManualReviewRequestSchema.safeParse(input.body);
    if (!parsed.success) {
      throw new CommercialProvisioningError(
        400,
        "INVALID_INPUT",
        parsed.error.issues[0]?.message ?? "Manual review requires resolution, note, and reason.",
      );
    }

    const before = await this.getOperationDetail(input.operationId);
    if (before.operation.status !== "compensation_required") {
      throw new CommercialProvisioningError(
        409,
        "MANUAL_REVIEW_NOT_APPLICABLE",
        "Manual review is only applicable when operation status is compensation_required.",
      );
    }
    if (parsed.data.resolution === "trigger_compensate" && !parsed.data.confirmDestructive) {
      throw new CommercialProvisioningError(
        400,
        "DESTRUCTIVE_CONFIRMATION_REQUIRED",
        "Triggering compensation from manual review requires confirmDestructive: true.",
      );
    }

    await this.auditWriter.append({
      actorType: "user",
      actorId: input.actor.userId,
      actorRole: input.actor.role,
      tenantId: before.operation.tenantId,
      action: "commercial.provisioning.operation.manual_review.requested",
      resourceType: "product_provisioning_operation",
      resourceId: input.operationId,
      outcome: "succeeded",
      requestId: input.requestId,
      metadata: {
        beforeStatus: before.operation.status,
        resolution: parsed.data.resolution,
      },
    });

    await this.provisionerPool.query(
      `UPDATE public.product_provisioning_operations
       SET manual_review_note = $2,
           last_operator_actor_id = $3
       WHERE id = $1`,
      [input.operationId, parsed.data.note, input.actor.userId],
    );

    if (parsed.data.resolution === "mark_failed") {
      const updated = await this.provisionerPool.query(
        `UPDATE public.product_provisioning_operations
         SET status = 'failed',
             failure_code = COALESCE(failure_code, 'MANUAL_REVIEW_FAILED'),
             failure_retryable = false,
             failure_disposition = 'compensate',
             last_operator_actor_id = $2
         WHERE id = $1
           AND status = 'compensation_required'`,
        [input.operationId, input.actor.userId],
      );
      if ((updated.rowCount ?? 0) === 0) {
        throw new CommercialProvisioningError(
          409,
          "MANUAL_REVIEW_CONFLICT",
          "Operation status changed concurrently before manual review could be finalized.",
        );
      }
    } else if (this.orchestrator) {
      const outcome = await this.orchestrator.runOperation(input.operationId, {
        resumeForward: parsed.data.resolution === "resume_forward",
        resumeCompensation: parsed.data.resolution === "trigger_compensate",
      });
      if (!outcome.claimed) {
        throw new CommercialProvisioningError(
          409,
          "OPERATION_LEASE_ACTIVE",
          "Operation is currently locked by another worker.",
        );
      }
    }

    const after = await this.getOperationDetail(input.operationId);
    await this.auditWriter.append({
      actorType: "user",
      actorId: input.actor.userId,
      actorRole: input.actor.role,
      tenantId: after.operation.tenantId,
      action: "commercial.provisioning.operation.manual_review.completed",
      resourceType: "product_provisioning_operation",
      resourceId: input.operationId,
      outcome: "succeeded",
      requestId: input.requestId,
      metadata: {
        beforeStatus: before.operation.status,
        afterStatus: after.operation.status,
        resolution: parsed.data.resolution,
      },
    });
    return after;
  }

  async listTenantInstallations(tenantId: string): Promise<Array<{
    id: string;
    productId: string;
    productVersion: string;
    solutionId: string;
    templateId: string;
    distributionMode: string;
    status: string;
    suspendedReason: string | null;
    currentConfigurationVersion: number;
    externalOrderId: string | null;
    createdAt: string;
    readyAt: string | null;
    offboardedAt: string | null;
    archive: {
      id: string;
      retentionExpiresAt: string;
      recoveredAt: string | null;
      archivePurgedAt: string | null;
    } | null;
  }>> {
    if (!UUID_REGEX.test(tenantId)) {
      throw new CommercialProvisioningError(400, "INVALID_INPUT", "tenantId must be a valid UUID.");
    }
    const client = await this.provisionerPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      const res = await client.query<{
        id: string;
        product_id: string;
        product_version: string;
        solution_id: string;
        template_id: string;
        distribution_mode: string;
        status: string;
        suspended_reason: string | null;
        current_configuration_version: number;
        external_order_id: string | null;
        created_at: Date | string;
        ready_at: Date | string | null;
        offboarded_at: Date | string | null;
        archive_id: string | null;
        retention_expires_at: Date | string | null;
        recovered_at: Date | string | null;
        archive_purged_at: Date | string | null;
      }>(
        `SELECT i.id::text, i.product_id, i.product_version, i.solution_id, i.template_id,
                i.distribution_mode, i.status, i.suspended_reason,
                i.current_configuration_version, i.external_order_id,
                i.created_at, i.ready_at, i.offboarded_at,
                a.id::text AS archive_id, a.retention_expires_at, a.recovered_at, a.archive_purged_at
         FROM public.product_installations i
         LEFT JOIN LATERAL (
           SELECT id, retention_expires_at, recovered_at, archive_purged_at
           FROM public.installation_offboarding_archives
           WHERE tenant_id = i.tenant_id
             AND installation_id = i.id
           ORDER BY created_at DESC
           LIMIT 1
         ) a ON true
         WHERE i.tenant_id = $1
         ORDER BY i.created_at DESC
         LIMIT 50`,
        [tenantId],
      );
      await client.query("COMMIT");
      return res.rows.map((row) => ({
        id: row.id,
        productId: row.product_id,
        productVersion: row.product_version,
        solutionId: row.solution_id,
        templateId: row.template_id,
        distributionMode: row.distribution_mode,
        status: row.status,
        suspendedReason: row.suspended_reason,
        currentConfigurationVersion: Number(row.current_configuration_version),
        externalOrderId: row.external_order_id,
        createdAt: iso(row.created_at),
        readyAt: row.ready_at ? iso(row.ready_at) : null,
        offboardedAt: row.offboarded_at ? iso(row.offboarded_at) : null,
        archive: row.archive_id && row.retention_expires_at
          ? {
              id: row.archive_id,
              retentionExpiresAt: iso(row.retention_expires_at),
              recoveredAt: row.recovered_at ? iso(row.recovered_at) : null,
              archivePurgedAt: row.archive_purged_at ? iso(row.archive_purged_at) : null,
            }
          : null,
      }));
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
