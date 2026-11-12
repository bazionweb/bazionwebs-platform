import type { ProvisioningOperationStatus } from "@bazion/api-contracts";
import {
  assertSafeEffect,
  StaleSagaLeaseError,
  type CompletedProvisioningStep,
  type ProvisioningFailureDisposition,
  type ProvisioningSagaFailure,
  type ProvisioningSagaJournal,
  type ProvisioningSagaLease,
  type ProvisioningSagaSnapshot,
  type ProvisioningSagaStepName,
  type ProvisioningStepEffect,
} from "./saga.js";

export interface SqlQueryExecutor {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
}

export interface ClaimedProvisioningOperation {
  operationId: string;
  correlationId: string;
  externalCustomerId: string;
  externalOrderId: string;
  offerId: string;
  offerVersion: string;
  productId: string;
  productVersion: string;
  solutionId: string;
  solutionVersion: string;
  templateId: string;
  templateVersion: string;
  requestedDomain: string | null;
  tenantId: string | null;
  installationId: string | null;
  status: ProvisioningOperationStatus;
  attemptCount: number;
  lease: ProvisioningSagaLease;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

/**
 * PostgreSQL-backed provisioning saga journal with per-operation leases and monotonic
 * fencing tokens so concurrent or stale workers can never advance or corrupt the same saga.
 */
export class PostgresProvisioningSagaJournal implements ProvisioningSagaJournal {
  constructor(private readonly db: SqlQueryExecutor) {}

  private async assertLease(operationId: string, lease?: ProvisioningSagaLease): Promise<string | null> {
    if (!lease) {
      const res = await this.db.query<{ correlation_id: string }>(
        `SELECT correlation_id FROM public.product_provisioning_operations WHERE id = $1`,
        [operationId],
      );
      return res.rows[0]?.correlation_id ?? null;
    }

    const res = await this.db.query<{ correlation_id: string }>(
      `SELECT correlation_id
       FROM public.product_provisioning_operations
       WHERE id = $1 AND lease_token = $2 AND fencing_token = $3`,
      [operationId, lease.leaseToken, lease.fencingToken],
    );
    if (!res.rows[0]) {
      throw new StaleSagaLeaseError(operationId, lease.fencingToken);
    }
    return res.rows[0].correlation_id;
  }

  async claimOperation(input: {
    operationId: string;
    workerId: string;
    leaseDurationMs?: number;
  }): Promise<ClaimedProvisioningOperation | null> {
    const leaseSeconds = Math.max(5, Math.ceil((input.leaseDurationMs ?? 30_000) / 1000));
    const res = await this.db.query<Record<string, unknown>>(
      `UPDATE public.product_provisioning_operations
       SET lease_token = gen_random_uuid(),
           lease_expires_at = now() + ($3 * interval '1 second'),
           fencing_token = fencing_token + 1,
           worker_id = $2,
           attempt_count = attempt_count + 1
       WHERE id = $1
         AND status NOT IN ('ready', 'compensated')
         AND (lease_expires_at IS NULL OR lease_expires_at < now())
       RETURNING id, correlation_id, external_customer_id, external_order_id,
                 offer_id, offer_version, product_id, product_version,
                 solution_id, solution_version, template_id, template_version,
                 requested_domain, tenant_id, installation_id, status,
                 attempt_count, lease_token, fencing_token, worker_id`,
      [input.operationId, input.workerId, leaseSeconds],
    );
    const row = res.rows[0];
    return row ? this.mapClaimedRow(row) : null;
  }

  async claimDueOperations(input: {
    workerId: string;
    leaseDurationMs?: number;
    limit?: number;
  }): Promise<ClaimedProvisioningOperation[]> {
    const leaseSeconds = Math.max(5, Math.ceil((input.leaseDurationMs ?? 30_000) / 1000));
    const safeLimit = Math.max(1, Math.min(50, input.limit ?? 10));
    const res = await this.db.query<Record<string, unknown>>(
      `WITH candidate AS (
         SELECT id
         FROM public.product_provisioning_operations
         WHERE (
           status IN ('accepted', 'validating', 'provisioning_tenant', 'configuring_installation', 'provisioning_hosting', 'compensating')
           OR (
             status = 'failed'
             AND failure_disposition = 'retry'
             AND failure_retryable = true
             AND (retry_after_at IS NULL OR retry_after_at <= now())
           )
         )
           AND (lease_expires_at IS NULL OR lease_expires_at < now())
         ORDER BY accepted_at ASC, id ASC
         LIMIT $3
         FOR UPDATE SKIP LOCKED
       )
       UPDATE public.product_provisioning_operations op
       SET lease_token = gen_random_uuid(),
           lease_expires_at = now() + ($2 * interval '1 second'),
           fencing_token = op.fencing_token + 1,
           worker_id = $1,
           attempt_count = op.attempt_count + 1
       FROM candidate
       WHERE op.id = candidate.id
       RETURNING op.id, op.correlation_id, op.external_customer_id, op.external_order_id,
                 op.offer_id, op.offer_version, op.product_id, op.product_version,
                 op.solution_id, op.solution_version, op.template_id, op.template_version,
                 op.requested_domain, op.tenant_id, op.installation_id, op.status,
                 op.attempt_count, op.lease_token, op.fencing_token, op.worker_id`,
      [input.workerId, leaseSeconds, safeLimit],
    );
    return res.rows.map((row) => this.mapClaimedRow(row));
  }

  async renewLease(input: {
    operationId: string;
    lease: ProvisioningSagaLease;
    leaseDurationMs?: number;
  }): Promise<void> {
    const leaseSeconds = Math.max(5, Math.ceil((input.leaseDurationMs ?? 30_000) / 1000));
    const res = await this.db.query(
      `UPDATE public.product_provisioning_operations
       SET lease_expires_at = now() + ($4 * interval '1 second')
       WHERE id = $1 AND lease_token = $2 AND fencing_token = $3
       RETURNING id`,
      [input.operationId, input.lease.leaseToken, input.lease.fencingToken, leaseSeconds],
    );
    if (!res.rows[0]) {
      throw new StaleSagaLeaseError(input.operationId, input.lease.fencingToken);
    }
  }

  async releaseLease(input: {
    operationId: string;
    lease: ProvisioningSagaLease;
    retryAfterAt?: Date | null;
  }): Promise<void> {
    await this.db.query(
      `UPDATE public.product_provisioning_operations
       SET lease_token = NULL,
           lease_expires_at = NULL,
           worker_id = NULL,
           retry_after_at = COALESCE($4, retry_after_at)
       WHERE id = $1 AND lease_token = $2 AND fencing_token = $3`,
      [input.operationId, input.lease.leaseToken, input.lease.fencingToken, input.retryAfterAt ?? null],
    );
  }

  async load(operationId: string): Promise<ProvisioningSagaSnapshot> {
    const opRes = await this.db.query<{
      status: ProvisioningOperationStatus;
      failure_code: string | null;
      failure_retryable: boolean | null;
      failure_disposition: ProvisioningFailureDisposition | null;
      tenant_id: string | null;
      installation_id: string | null;
      fencing_token: string | number;
    }>(
      `SELECT status, failure_code, failure_retryable, failure_disposition,
              tenant_id, installation_id, fencing_token
       FROM public.product_provisioning_operations
       WHERE id = $1`,
      [operationId],
    );
    const op = opRes.rows[0];
    if (!op) throw new Error(`PROVISIONING_OPERATION_NOT_FOUND:${operationId}`);

    const attemptsRes = await this.db.query<{
      step_name: ProvisioningSagaStepName;
      direction: "forward" | "compensate";
      attempt_number: number;
      status: "running" | "succeeded" | "failed" | "unknown";
      effect_refs: ProvisioningStepEffect;
      error_code: string | null;
      fencing_token: string | number | null;
    }>(
      `SELECT step_name, direction, attempt_number, status, effect_refs, error_code, fencing_token
       FROM public.product_provisioning_step_attempts
       WHERE operation_id = $1
       ORDER BY started_at ASC, attempt_number ASC`,
      [operationId],
    );

    const completedMap = new Map<ProvisioningSagaStepName, CompletedProvisioningStep>();
    const compensatedSet = new Set<ProvisioningSagaStepName>();
    let runningStep: ProvisioningSagaSnapshot["runningStep"] = null;
    let unknownStep: ProvisioningSagaSnapshot["unknownStep"] = null;

    for (const row of attemptsRes.rows) {
      if (row.direction === "forward") {
        if (row.status === "succeeded") {
          completedMap.set(row.step_name, { name: row.step_name, effect: row.effect_refs ?? {} });
          if (runningStep?.name === row.step_name && runningStep.direction === "forward") runningStep = null;
          if (unknownStep?.name === row.step_name && unknownStep.direction === "forward") unknownStep = null;
        } else if (row.status === "running") {
          runningStep = {
            name: row.step_name,
            direction: "forward",
            attemptNumber: Number(row.attempt_number),
            fencingToken: Number(row.fencing_token ?? 0),
          };
        } else if (row.status === "unknown") {
          unknownStep = {
            name: row.step_name,
            direction: "forward",
            attemptNumber: Number(row.attempt_number),
            errorCode: row.error_code ?? "UNKNOWN_STEP_OUTCOME",
          };
        }
      } else if (row.direction === "compensate") {
        if (row.status === "succeeded") {
          compensatedSet.add(row.step_name);
        }
      }
    }

    const failure: ProvisioningSagaFailure | null = op.failure_code
      ? {
          code: op.failure_code,
          retryable: Boolean(op.failure_retryable),
          disposition: op.failure_disposition ?? "unknown",
        }
      : null;

    return {
      status: op.status,
      completedSteps: [...completedMap.values()],
      compensatedSteps: [...compensatedSet],
      failure,
      runningStep,
      unknownStep,
      tenantId: op.tenant_id,
      installationId: op.installation_id,
      fencingToken: Number(op.fencing_token ?? 0),
    };
  }

  async setStatus(
    operationId: string,
    status: ProvisioningOperationStatus,
    failure: ProvisioningSagaFailure | null = null,
    lease?: ProvisioningSagaLease,
  ): Promise<void> {
    const failureCode = failure?.code ?? null;
    const failureRetryable = failure ? failure.retryable : null;
    const failureDisposition = failure?.disposition ?? null;
    const clearStep = status === "ready" || status === "compensated" ? null : undefined;

    const params: unknown[] = [operationId, status, failureCode, failureRetryable, failureDisposition];
    let fenceClause = "";
    if (lease) {
      params.push(lease.leaseToken, lease.fencingToken);
      fenceClause = ` AND lease_token = $6 AND fencing_token = $7`;
    }

    const res = await this.db.query(
      `UPDATE public.product_provisioning_operations
       SET status = $2,
           ${clearStep === null ? "current_step = NULL," : ""}
           failure_code = $3,
           failure_retryable = $4,
           failure_disposition = $5
       WHERE id = $1${fenceClause}
       RETURNING id`,
      params,
    );
    if (!res.rows[0]) {
      if (lease) throw new StaleSagaLeaseError(operationId, lease.fencingToken);
      throw new Error(`PROVISIONING_OPERATION_NOT_FOUND:${operationId}`);
    }
  }

  async startStep(
    operationId: string,
    step: ProvisioningSagaStepName,
    lease?: ProvisioningSagaLease,
  ): Promise<number> {
    return this.insertAttempt(operationId, step, "forward", lease, true);
  }

  async completeStep(
    operationId: string,
    step: ProvisioningSagaStepName,
    effect: ProvisioningStepEffect,
    lease?: ProvisioningSagaLease,
  ): Promise<void> {
    assertSafeEffect(effect);
    const correlationId = await this.assertLease(operationId, lease);

    const tenantId = isUuid(effect.tenant_id) ? effect.tenant_id : null;
    const installationId = isUuid(effect.installation_id) ? effect.installation_id : null;
    if (tenantId || installationId) {
      const updateParams: unknown[] = [operationId, tenantId, installationId];
      const fenceClause = lease
        ? (() => {
            updateParams.push(lease.leaseToken, lease.fencingToken);
            return " AND lease_token = $4 AND fencing_token = $5";
          })()
        : "";
      const bindRes = await this.db.query(
        `UPDATE public.product_provisioning_operations
         SET tenant_id = COALESCE(tenant_id, $2),
             installation_id = COALESCE(installation_id, $3)
         WHERE id = $1${fenceClause}
         RETURNING id`,
        updateParams,
      );
      if (!bindRes.rows[0] && lease) throw new StaleSagaLeaseError(operationId, lease.fencingToken);
    }

    const updated = await this.db.query(
      `UPDATE public.product_provisioning_step_attempts
       SET status = 'succeeded',
           effect_refs = $3::jsonb,
           error_code = NULL,
           retryable = NULL,
           failure_disposition = NULL,
           finished_at = now()
       WHERE id = (
         SELECT id
         FROM public.product_provisioning_step_attempts
         WHERE operation_id = $1 AND step_name = $2 AND direction = 'forward'
           AND status IN ('running', 'unknown')
         ORDER BY attempt_number DESC
         LIMIT 1
       )
       RETURNING id`,
      [operationId, step, JSON.stringify(effect)],
    );

    if (!updated.rows[0]) {
      const nextRes = await this.db.query<{ next_attempt: number }>(
        `SELECT COALESCE(MAX(attempt_number), 0) + 1 AS next_attempt
         FROM public.product_provisioning_step_attempts
         WHERE operation_id = $1 AND step_name = $2 AND direction = 'forward'`,
        [operationId, step],
      );
      const nextAttempt = Number(nextRes.rows[0]?.next_attempt ?? 1);
      await this.db.query(
        `INSERT INTO public.product_provisioning_step_attempts (
          operation_id, step_name, direction, attempt_number, status,
          fencing_token, correlation_id, effect_refs, finished_at
        ) VALUES ($1, $2, 'forward', $3, 'succeeded', $4, $5, $6::jsonb, now())`,
        [
          operationId,
          step,
          nextAttempt,
          lease?.fencingToken ?? 0,
          correlationId,
          JSON.stringify(effect),
        ],
      );
    }
  }

  async failStep(
    operationId: string,
    step: ProvisioningSagaStepName,
    failure: ProvisioningSagaFailure,
    lease?: ProvisioningSagaLease,
  ): Promise<void> {
    await this.markAttemptFailed(operationId, step, "forward", failure, lease);
  }

  async startCompensation(
    operationId: string,
    step: ProvisioningSagaStepName,
    lease?: ProvisioningSagaLease,
  ): Promise<number> {
    return this.insertAttempt(operationId, step, "compensate", lease, true);
  }

  async completeCompensation(
    operationId: string,
    step: ProvisioningSagaStepName,
    lease?: ProvisioningSagaLease,
  ): Promise<void> {
    await this.assertLease(operationId, lease);
    await this.db.query(
      `UPDATE public.product_provisioning_step_attempts
       SET status = 'succeeded',
           finished_at = now()
       WHERE id = (
         SELECT id
         FROM public.product_provisioning_step_attempts
         WHERE operation_id = $1 AND step_name = $2 AND direction = 'compensate' AND status = 'running'
         ORDER BY attempt_number DESC
         LIMIT 1
       )`,
      [operationId, step],
    );
  }

  async failCompensation(
    operationId: string,
    step: ProvisioningSagaStepName,
    failure: ProvisioningSagaFailure,
    lease?: ProvisioningSagaLease,
  ): Promise<void> {
    await this.markAttemptFailed(operationId, step, "compensate", failure, lease);
  }

  private async insertAttempt(
    operationId: string,
    step: ProvisioningSagaStepName,
    direction: "forward" | "compensate",
    lease: ProvisioningSagaLease | undefined,
    updateCurrentStep: boolean,
  ): Promise<number> {
    const correlationId = await this.assertLease(operationId, lease);
    if (updateCurrentStep) {
      const params: unknown[] = [operationId, step];
      const fenceClause = lease
        ? (() => {
            params.push(lease.leaseToken, lease.fencingToken);
            return " AND lease_token = $3 AND fencing_token = $4";
          })()
        : "";
      const opUpdate = await this.db.query(
        `UPDATE public.product_provisioning_operations
         SET current_step = $2
         WHERE id = $1${fenceClause}
         RETURNING id`,
        params,
      );
      if (!opUpdate.rows[0] && lease) throw new StaleSagaLeaseError(operationId, lease.fencingToken);
    }

    const res = await this.db.query<{ attempt_number: number }>(
      `INSERT INTO public.product_provisioning_step_attempts (
        operation_id, step_name, direction, attempt_number, status,
        fencing_token, correlation_id, effect_refs
      )
      SELECT $1::uuid, $2::varchar, $3::varchar, COALESCE(MAX(attempt_number), 0) + 1, 'running', $4, $5, '{}'::jsonb
      FROM public.product_provisioning_step_attempts
      WHERE operation_id = $1::uuid AND step_name = $2::varchar AND direction = $3::varchar
      RETURNING attempt_number`,
      [operationId, step, direction, lease?.fencingToken ?? 0, correlationId],
    );
    return Number(res.rows[0]?.attempt_number ?? 1);
  }

  private async markAttemptFailed(
    operationId: string,
    step: ProvisioningSagaStepName,
    direction: "forward" | "compensate",
    failure: ProvisioningSagaFailure,
    lease?: ProvisioningSagaLease,
  ): Promise<void> {
    const correlationId = await this.assertLease(operationId, lease);
    const attemptStatus = failure.disposition === "unknown" ? "unknown" : "failed";
    const updated = await this.db.query(
      `UPDATE public.product_provisioning_step_attempts
       SET status = $4,
           error_code = $5,
           retryable = $6,
           failure_disposition = $7,
           finished_at = now()
       WHERE id = (
         SELECT id
         FROM public.product_provisioning_step_attempts
         WHERE operation_id = $1 AND step_name = $2 AND direction = $3 AND status = 'running'
         ORDER BY attempt_number DESC
         LIMIT 1
       )
       RETURNING id`,
      [operationId, step, direction, attemptStatus, failure.code, failure.retryable, failure.disposition],
    );
    if (!updated.rows[0]) {
      const nextRes = await this.db.query<{ next_attempt: number }>(
        `SELECT COALESCE(MAX(attempt_number), 0) + 1 AS next_attempt
         FROM public.product_provisioning_step_attempts
         WHERE operation_id = $1 AND step_name = $2 AND direction = $3`,
        [operationId, step, direction],
      );
      await this.db.query(
        `INSERT INTO public.product_provisioning_step_attempts (
          operation_id, step_name, direction, attempt_number, status,
          fencing_token, correlation_id, effect_refs,
          error_code, retryable, failure_disposition, finished_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, '{}'::jsonb, $8, $9, $10, now())`,
        [
          operationId,
          step,
          direction,
          Number(nextRes.rows[0]?.next_attempt ?? 1),
          attemptStatus,
          lease?.fencingToken ?? 0,
          correlationId,
          failure.code,
          failure.retryable,
          failure.disposition,
        ],
      );
    }
  }

  private mapClaimedRow(row: Record<string, unknown>): ClaimedProvisioningOperation {
    return {
      operationId: String(row.id),
      correlationId: String(row.correlation_id),
      externalCustomerId: String(row.external_customer_id),
      externalOrderId: String(row.external_order_id),
      offerId: String(row.offer_id),
      offerVersion: String(row.offer_version),
      productId: String(row.product_id),
      productVersion: String(row.product_version),
      solutionId: String(row.solution_id),
      solutionVersion: String(row.solution_version),
      templateId: String(row.template_id),
      templateVersion: String(row.template_version),
      requestedDomain: row.requested_domain ? String(row.requested_domain) : null,
      tenantId: row.tenant_id ? String(row.tenant_id) : null,
      installationId: row.installation_id ? String(row.installation_id) : null,
      status: row.status as ProvisioningOperationStatus,
      attemptCount: Number(row.attempt_count ?? 1),
      lease: {
        leaseToken: String(row.lease_token),
        fencingToken: Number(row.fencing_token ?? 1),
        workerId: String(row.worker_id ?? "unknown"),
      },
    };
  }
}
