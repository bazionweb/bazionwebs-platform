import { randomUUID } from "node:crypto";
import type {
  TenantHostingDeploymentReference,
  TenantHostingDeploymentState,
  TenantHostingProvider,
  TenantId,
} from "@bazion/platform-contracts";

interface SqlResult<T> { rows: T[]; rowCount: number | null }
interface SqlClient {
  query<T = Record<string, unknown>>(statement: string, values?: unknown[]): Promise<SqlResult<T>>;
  release(): void;
}
export interface HostingReconciliationPool { connect(): Promise<SqlClient> }

export interface HostingReconciliationCandidate {
  deploymentId: string;
  reference: TenantHostingDeploymentReference;
  leaseToken: string;
}

export interface HostingReconciliationStore {
  claimBatch(input: { provider: string; limit: number; leaseSeconds: number }): Promise<HostingReconciliationCandidate[]>;
  recordInspection(input: {
    deploymentId: string;
    leaseToken: string;
    state: Exclude<TenantHostingDeploymentState, "unknown">;
    lastDeployedAt: string | null;
    intervalSeconds: number;
    actorId: string;
  }): Promise<{ changed: boolean; state: string } | null>;
  recordInspectionFailure(input: {
    deploymentId: string;
    leaseToken: string;
    errorCode: string;
    retryBaseSeconds: number;
    retryMaxSeconds: number;
    actorId: string;
  }): Promise<{ failureCount: number; retryInSeconds: number } | null>;
}

interface ReconciliationRow {
  id: string;
  tenant_id: string;
  provider: string;
  provider_resource_id: string;
  created_at: Date | string;
}

function iso(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("HOSTING_RECONCILIATION_TIMESTAMP_INVALID");
  return parsed.toISOString();
}

function validLastDeployedAt(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** The worker receives a dedicated DB role with read-only deployment identity and narrowly scoped updates. */
export class PostgresHostingReconciliationStore implements HostingReconciliationStore {
  constructor(private readonly pool: HostingReconciliationPool) {}

  async claimBatch(input: { provider: string; limit: number; leaseSeconds: number }): Promise<HostingReconciliationCandidate[]> {
    if (!input.provider.trim() || !Number.isInteger(input.limit) || input.limit < 1 || input.limit > 20 ||
        !Number.isInteger(input.leaseSeconds) || input.leaseSeconds < 60 || input.leaseSeconds > 900) {
      throw new Error("HOSTING_RECONCILIATION_CLAIM_INPUT_INVALID");
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const due = await client.query<ReconciliationRow>(
        "SELECT id::text,tenant_id::text,provider,provider_resource_id,created_at " +
        "FROM public.tenant_hosting_deployments " +
        "WHERE provider=$1 AND provider_resource_id IS NOT NULL " +
        "AND (lease_expires_at IS NULL OR lease_expires_at <= now()) " +
        "AND (next_reconcile_at IS NULL OR next_reconcile_at <= now()) " +
        "ORDER BY next_reconcile_at ASC,created_at ASC " +
        "LIMIT $2 FOR UPDATE SKIP LOCKED",
        [input.provider, input.limit],
      );

      const claimed: HostingReconciliationCandidate[] = [];
      for (const row of due.rows) {
        const leaseToken = randomUUID();
        const updated = await client.query(
          "UPDATE public.tenant_hosting_deployments " +
          "SET lease_token=$2,lease_expires_at=now()+($3::integer*interval '1 second') " +
          "WHERE id=$1 AND (lease_expires_at IS NULL OR lease_expires_at <= now()) " +
          "RETURNING id",
          [row.id, leaseToken, input.leaseSeconds],
        );
        if (updated.rowCount !== 1) continue;
        claimed.push({
          deploymentId: row.id,
          leaseToken,
          reference: {
            provider: row.provider,
            resourceId: row.provider_resource_id,
            tenantId: row.tenant_id as TenantId,
            createdAt: iso(row.created_at),
          },
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

  async recordInspection(input: {
    deploymentId: string;
    leaseToken: string;
    state: Exclude<TenantHostingDeploymentState, "unknown">;
    lastDeployedAt: string | null;
    intervalSeconds: number;
    actorId: string;
  }): Promise<{ changed: boolean; state: string } | null> {
    if (!Number.isInteger(input.intervalSeconds) || input.intervalSeconds < 10 || input.intervalSeconds > 3600) {
      throw new Error("HOSTING_RECONCILIATION_INTERVAL_INVALID");
    }
    const lastDeployedAt = validLastDeployedAt(input.lastDeployedAt);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const previous = await client.query<{ tenant_id: string; state: string }>(
        "SELECT tenant_id::text,state FROM public.tenant_hosting_deployments " +
        "WHERE id=$1 AND lease_token=$2 FOR UPDATE",
        [input.deploymentId, input.leaseToken],
      );
      const row = previous.rows[0];
      if (!row) {
        await client.query("ROLLBACK");
        return null;
      }
      const changed = row.state !== input.state;
      const updated = await client.query(
        "UPDATE public.tenant_hosting_deployments SET state=$3," +
        "error_code=CASE WHEN $3='failed' THEN error_code ELSE NULL END," +
        "last_deployed_at=COALESCE($4::timestamptz,last_deployed_at)," +
        "last_inspected_at=now(),next_reconcile_at=now()+($5::integer*interval '1 second')," +
        "reconcile_failure_count=0,lease_token=NULL,lease_expires_at=NULL," +
        "updated_at=CASE WHEN state IS DISTINCT FROM $3 THEN now() ELSE updated_at END " +
        "WHERE id=$1 AND lease_token=$2",
        [input.deploymentId, input.leaseToken, input.state, lastDeployedAt, input.intervalSeconds],
      );
      if (updated.rowCount !== 1) {
        await client.query("ROLLBACK");
        return null;
      }
      if (changed) {
        await client.query(
          "INSERT INTO public.tenant_hosting_deployment_events " +
          "(deployment_id,tenant_id,event_type,from_state,to_state,actor_type,actor_id,metadata) " +
          "VALUES ($1,$2,'hosting.reconciliation.state_changed',$3,$4,'system',$5,$6::jsonb)",
          [input.deploymentId,row.tenant_id,row.state,input.state,input.actorId,JSON.stringify({
            providerState: input.state,
            ...(lastDeployedAt ? { lastDeployedAt } : {}),
          })],
        );
      }
      await client.query("COMMIT");
      return { changed, state: input.state };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async recordInspectionFailure(input: {
    deploymentId: string;
    leaseToken: string;
    errorCode: string;
    retryBaseSeconds: number;
    retryMaxSeconds: number;
    actorId: string;
  }): Promise<{ failureCount: number; retryInSeconds: number } | null> {
    if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(input.errorCode) ||
        !Number.isInteger(input.retryBaseSeconds) || input.retryBaseSeconds < 5 ||
        !Number.isInteger(input.retryMaxSeconds) || input.retryMaxSeconds < input.retryBaseSeconds ||
        input.retryMaxSeconds > 86_400) {
      throw new Error("HOSTING_RECONCILIATION_FAILURE_INPUT_INVALID");
    }
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const previous = await client.query<{ tenant_id: string; state: string; reconcile_failure_count: number }>(
        "SELECT tenant_id::text,state,reconcile_failure_count FROM public.tenant_hosting_deployments " +
        "WHERE id=$1 AND lease_token=$2 FOR UPDATE",
        [input.deploymentId, input.leaseToken],
      );
      const row = previous.rows[0];
      if (!row) {
        await client.query("ROLLBACK");
        return null;
      }

      const failureCount = row.reconcile_failure_count + 1;
      const retryInSeconds = Math.min(input.retryMaxSeconds, input.retryBaseSeconds * (2 ** Math.min(failureCount - 1, 20)));
      const updated = await client.query(
        "UPDATE public.tenant_hosting_deployments SET last_inspected_at=now()," +
        "next_reconcile_at=now()+($3::integer*interval '1 second'),reconcile_failure_count=$4," +
        "lease_token=NULL,lease_expires_at=NULL " +
        "WHERE id=$1 AND lease_token=$2",
        [input.deploymentId,input.leaseToken,retryInSeconds,failureCount],
      );
      if (updated.rowCount !== 1) {
        await client.query("ROLLBACK");
        return null;
      }

      // Keep history useful during outages without appending an event every poll:
      // record the first failure and then powers of two (2, 4, 8, 16, ...).
      if ((failureCount & (failureCount - 1)) === 0) {
        await client.query(
          "INSERT INTO public.tenant_hosting_deployment_events " +
          "(deployment_id,tenant_id,event_type,from_state,to_state,actor_type,actor_id,metadata) " +
          "VALUES ($1,$2,'hosting.reconciliation.inspection_failed',$3,$3,'system',$4,$5::jsonb)",
          [input.deploymentId,row.tenant_id,row.state,input.actorId,JSON.stringify({
            errorCode: input.errorCode,
            failureCount,
            retryInSeconds,
          })],
        );
      }
      await client.query("COMMIT");
      return { failureCount, retryInSeconds };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

export interface HostingReconcilerOptions {
  providerId: string;
  batchSize: number;
  leaseSeconds: number;
  intervalSeconds: number;
  retryBaseSeconds: number;
  retryMaxSeconds: number;
  actorId?: string;
}

export interface HostingReconciliationBatchResult {
  claimed: number;
  inspected: number;
  changed: number;
  failed: number;
  leaseLost: number;
}

function safeProviderErrorCode(error: unknown): string {
  const candidate = error instanceof Error ? error.message : "";
  return /^[A-Z][A-Z0-9_]{1,63}$/.test(candidate) ? candidate : "HOSTING_PROVIDER_INSPECTION_FAILED";
}

/** Polls provider state only. It never creates, deploys, stops, or deletes provider resources. */
export class TenantHostingDeploymentReconciler {
  private readonly actorId: string;

  constructor(
    private readonly store: HostingReconciliationStore,
    private readonly provider: TenantHostingProvider,
    private readonly options: HostingReconcilerOptions,
  ) {
    this.actorId = options.actorId ?? "hosting-reconciler";
    if (!options.providerId.trim() ||
        !Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 20 ||
        !Number.isInteger(options.leaseSeconds) || options.leaseSeconds < 60 || options.leaseSeconds > 900 ||
        !Number.isInteger(options.intervalSeconds) || options.intervalSeconds < 10 || options.intervalSeconds > 3600 ||
        !Number.isInteger(options.retryBaseSeconds) || options.retryBaseSeconds < 5 ||
        !Number.isInteger(options.retryMaxSeconds) || options.retryMaxSeconds < options.retryBaseSeconds ||
        options.retryMaxSeconds > 86_400) {
      throw new Error("HOSTING_RECONCILER_OPTIONS_INVALID");
    }
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(this.actorId)) throw new Error("HOSTING_RECONCILER_ACTOR_INVALID");
  }

  async runBatch(): Promise<HostingReconciliationBatchResult> {
    const candidates = await this.store.claimBatch({
      provider: this.options.providerId,
      limit: this.options.batchSize,
      leaseSeconds: this.options.leaseSeconds,
    });
    const result: HostingReconciliationBatchResult = {
      claimed: candidates.length, inspected: 0, changed: 0, failed: 0, leaseLost: 0,
    };

    await Promise.all(candidates.map(async (candidate) => {
      try {
        const observed = await this.provider.inspect(candidate.reference);
        if (observed.state === "unknown") {
          const failure = await this.store.recordInspectionFailure({
            deploymentId: candidate.deploymentId,
            leaseToken: candidate.leaseToken,
            errorCode: "HOSTING_PROVIDER_STATE_UNKNOWN",
            retryBaseSeconds: this.options.retryBaseSeconds,
            retryMaxSeconds: this.options.retryMaxSeconds,
            actorId: this.actorId,
          });
          if (!failure) result.leaseLost += 1;
          else result.failed += 1;
          return;
        }
        const recorded = await this.store.recordInspection({
          deploymentId: candidate.deploymentId,
          leaseToken: candidate.leaseToken,
          state: observed.state,
          lastDeployedAt: observed.lastDeployedAt,
          intervalSeconds: this.options.intervalSeconds,
          actorId: this.actorId,
        });
        if (!recorded) {
          result.leaseLost += 1;
          return;
        }
        result.inspected += 1;
        if (recorded.changed) result.changed += 1;
      } catch (error) {
        const failure = await this.store.recordInspectionFailure({
          deploymentId: candidate.deploymentId,
          leaseToken: candidate.leaseToken,
          errorCode: safeProviderErrorCode(error),
          retryBaseSeconds: this.options.retryBaseSeconds,
          retryMaxSeconds: this.options.retryMaxSeconds,
          actorId: this.actorId,
        });
        if (!failure) result.leaseLost += 1;
        else result.failed += 1;
      }
    }));

    return result;
  }
}
