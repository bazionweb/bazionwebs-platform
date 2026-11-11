import { randomUUID } from "node:crypto";
import type {
  TenantHostingDeploymentReference,
  TenantHostingDeploymentState,
  TenantHostingProvider,
} from "@bazion/platform-contracts";

interface SqlResult<T> { rows: T[]; rowCount: number | null }
interface SqlClient {
  query<T = Record<string, unknown>>(statement: string, values?: unknown[]): Promise<SqlResult<T>>;
  release(): void;
}
export interface HostingLifecyclePool { connect(): Promise<SqlClient> }

export type TenantHostingLifecycleAction = "start" | "stop" | "redeploy" | "remove";
export interface TenantHostingLifecycleInput {
  tenantId: string;
  deploymentId: string;
  action: TenantHostingLifecycleAction;
  actorId: string;
  requestId?: string;
}
export interface TenantHostingLifecycleResult {
  action: TenantHostingLifecycleAction;
  state: TenantHostingDeploymentState;
  confirmed: boolean;
  already: boolean;
}
export interface HostingLifecycleClaim {
  deploymentId: string;
  leaseToken: string;
  reference: TenantHostingDeploymentReference;
  previousState: TenantHostingDeploymentState;
}
export type HostingLifecycleClaimResult =
  | { kind: "claimed"; claim: HostingLifecycleClaim }
  | { kind: "already"; state: TenantHostingDeploymentState }
  | { kind: "not_found" | "tenant_not_active" | "tenant_not_closed" | "in_progress" | "invalid_state" | "removed" | "provider_mismatch" };

export interface HostingLifecycleStore {
  claim(input: TenantHostingLifecycleInput & { expectedProvider: string }): Promise<HostingLifecycleClaimResult>;
  complete(input: {
    claim: HostingLifecycleClaim;
    action: TenantHostingLifecycleAction;
    state: TenantHostingDeploymentState;
    confirmed: boolean;
    lastDeployedAt: string | null;
    actorId: string;
    requestId?: string;
  }): Promise<boolean>;
  fail(input: {
    claim: HostingLifecycleClaim;
    action: TenantHostingLifecycleAction;
    errorCode: string;
    actorId: string;
    requestId?: string;
  }): Promise<void>;
}

interface LifecycleRow {
  id: string;
  tenant_id: string;
  provider: string;
  provider_resource_id: string | null;
  state: TenantHostingDeploymentState;
  created_at: Date | string;
  tenant_status: string;
  lease_expires_at: Date | string | null;
}
function iso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("HOSTING_LIFECYCLE_TIMESTAMP_INVALID");
  return date.toISOString();
}
function leaseActive(value: Date | string | null): boolean {
  if (value === null) return false;
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}
const canStart = new Set<TenantHostingDeploymentState>(["stopped", "ready", "failed"]);
const canStop = new Set<TenantHostingDeploymentState>(["running", "deploying", "ready", "failed"]);
const canRedeploy = new Set<TenantHostingDeploymentState>(["running", "stopped", "ready", "failed"]);

/** Serializes provider operations with the same database lease used by provisioning and reconciliation. */
export class PostgresHostingLifecycleStore implements HostingLifecycleStore {
  constructor(private readonly pool: HostingLifecyclePool, private readonly leaseSeconds = 300) {
    if (!Number.isInteger(leaseSeconds) || leaseSeconds < 60 || leaseSeconds > 900) {
      throw new Error("HOSTING_LIFECYCLE_LEASE_INVALID");
    }
  }

  async claim(input: TenantHostingLifecycleInput & { expectedProvider: string }): Promise<HostingLifecycleClaimResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<LifecycleRow>(
        "SELECT d.id::text,d.tenant_id::text,d.provider,d.provider_resource_id,d.state,d.created_at," +
        "d.lease_expires_at,t.status AS tenant_status " +
        "FROM public.tenant_hosting_deployments d JOIN public.tenants t ON t.id=d.tenant_id " +
        "WHERE d.id=$1 AND d.tenant_id=$2 FOR UPDATE OF d,t",
        [input.deploymentId, input.tenantId],
      );
      const row = result.rows[0];
      if (!row) { await client.query("ROLLBACK"); return { kind: "not_found" }; }
      if (row.state === "removed") { await client.query("ROLLBACK"); return { kind: "removed" }; }
      if (row.provider !== input.expectedProvider) { await client.query("ROLLBACK"); return { kind: "provider_mismatch" }; }
      if (row.provider_resource_id === null) { await client.query("ROLLBACK"); return { kind: "invalid_state" }; }
      if (leaseActive(row.lease_expires_at)) { await client.query("ROLLBACK"); return { kind: "in_progress" }; }

      if ((input.action === "start" || input.action === "redeploy") && row.tenant_status !== "active") {
        await client.query("ROLLBACK"); return { kind: "tenant_not_active" };
      }
      if (input.action === "remove" && row.tenant_status !== "closed") {
        await client.query("ROLLBACK"); return { kind: "tenant_not_closed" };
      }
      if (input.action === "start" && row.state === "running") {
        await client.query("COMMIT"); return { kind: "already", state: row.state };
      }
      if (input.action === "stop" && row.state === "stopped") {
        await client.query("COMMIT"); return { kind: "already", state: row.state };
      }
      if (input.action === "remove" && row.state !== "stopped") {
        await client.query("ROLLBACK"); return { kind: "invalid_state" };
      }
      if (input.action === "start" && !canStart.has(row.state)) {
        await client.query("ROLLBACK"); return { kind: "invalid_state" };
      }
      if (input.action === "stop" && !canStop.has(row.state)) {
        await client.query("ROLLBACK"); return { kind: "invalid_state" };
      }
      if (input.action === "redeploy" && !canRedeploy.has(row.state)) {
        await client.query("ROLLBACK"); return { kind: "invalid_state" };
      }

      const leaseToken = randomUUID();
      const nextState = input.action === "start" || input.action === "redeploy" ? "deploying" : row.state;
      const updated = await client.query(
        "UPDATE public.tenant_hosting_deployments SET state=$3,lease_token=$4," +
        "lease_expires_at=now()+($5::integer*interval '1 second'),updated_at=now() " +
        "WHERE id=$1 AND tenant_id=$2 AND (lease_expires_at IS NULL OR lease_expires_at<=now())",
        [input.deploymentId,input.tenantId,nextState,leaseToken,this.leaseSeconds],
      );
      if (updated.rowCount !== 1) {
        await client.query("ROLLBACK"); return { kind: "in_progress" };
      }
      await this.appendEvent(client, input, row.state, nextState,
        "hosting.lifecycle." + input.action + ".requested", { provider: row.provider });
      await client.query("COMMIT");
      return {
        kind: "claimed",
        claim: {
          deploymentId: row.id,
          leaseToken,
          previousState: row.state,
          reference: {
            provider: row.provider,
            resourceId: row.provider_resource_id,
            tenantId: row.tenant_id as TenantHostingDeploymentReference["tenantId"],
            createdAt: iso(row.created_at),
          },
        },
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  async complete(input: {
    claim: HostingLifecycleClaim;
    action: TenantHostingLifecycleAction;
    state: TenantHostingDeploymentState;
    confirmed: boolean;
    lastDeployedAt: string | null;
    actorId: string;
    requestId?: string;
  }): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const isRemoved = input.action === "remove" || input.state === "removed";
      const result = await client.query<{ tenant_id: string; state: string }>(
        "UPDATE public.tenant_hosting_deployments SET state=$3," +
        "provider_resource_id=CASE WHEN $4 THEN NULL ELSE provider_resource_id END," +
        "error_code=NULL,last_deployed_at=COALESCE($5::timestamptz,last_deployed_at)," +
        "last_inspected_at=CASE WHEN $4 THEN last_inspected_at ELSE now() END," +
        "next_reconcile_at=now()+interval '30 seconds',lease_token=NULL,lease_expires_at=NULL,updated_at=now() " +
        "WHERE id=$1 AND lease_token=$2 RETURNING tenant_id::text,state",
        [input.claim.deploymentId, input.claim.leaseToken,
          isRemoved ? "removed" : input.state, isRemoved, input.lastDeployedAt],
      );
      const row = result.rows[0];
      if (!row) { await client.query("ROLLBACK"); return false; }
      const eventType = "hosting.lifecycle." + input.action + ".completed";
      await client.query(
        "INSERT INTO public.tenant_hosting_deployment_events " +
        "(deployment_id,tenant_id,event_type,from_state,to_state,actor_type,actor_id,request_id,metadata) " +
        "VALUES ($1,$2,$3,$4,$5,'user',$6,$7,$8::jsonb)",
        [input.claim.deploymentId, row.tenant_id, eventType,
          input.claim.previousState, row.state, input.actorId, input.requestId ?? null,
          JSON.stringify({ action: input.action, confirmed: input.confirmed, provider: input.claim.reference.provider })],
      );
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  async fail(input: {
    claim: HostingLifecycleClaim;
    action: TenantHostingLifecycleAction;
    errorCode: string;
    actorId: string;
    requestId?: string;
  }): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{ tenant_id: string }>(
        "UPDATE public.tenant_hosting_deployments SET state='unknown',error_code=$3," +
        "lease_token=NULL,lease_expires_at=NULL,last_inspected_at=now(),next_reconcile_at=now(),updated_at=now() " +
        "WHERE id=$1 AND lease_token=$2 RETURNING tenant_id::text",
        [input.claim.deploymentId, input.claim.leaseToken, input.errorCode],
      );
      const tenantId = result.rows[0]?.tenant_id;
      if (tenantId) {
        await client.query(
          "INSERT INTO public.tenant_hosting_deployment_events " +
          "(deployment_id,tenant_id,event_type,from_state,to_state,actor_type,actor_id,request_id,metadata) " +
          "VALUES ($1,$2,$3,$4,'unknown','user',$5,$6,$7::jsonb)",
          [input.claim.deploymentId, tenantId,
            "hosting.lifecycle." + input.action + ".failed", input.claim.previousState,
            input.actorId, input.requestId ?? null, JSON.stringify({ errorCode: input.errorCode })],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  private async appendEvent(
    client: SqlClient, input: TenantHostingLifecycleInput, fromState: string, toState: string,
    eventType: string, metadata: Record<string, string>,
  ): Promise<void> {
    await client.query(
      "INSERT INTO public.tenant_hosting_deployment_events " +
      "(deployment_id,tenant_id,event_type,from_state,to_state,actor_type,actor_id,request_id,metadata) " +
      "VALUES ($1,$2,$3,$4,$5,'user',$6,$7,$8::jsonb)",
      [input.deploymentId,input.tenantId,eventType,fromState,toState,input.actorId,input.requestId ?? null,JSON.stringify(metadata)],
    );
  }
}

/** Executes one explicit provider action; ambiguous POST failures become unknown and are reconciled, never replayed. */
export class TenantHostingLifecycleService {
  constructor(
    private readonly store: HostingLifecycleStore,
    private readonly provider: TenantHostingProvider,
    private readonly providerId: string,
  ) {
    if (!providerId.trim()) throw new Error("HOSTING_PROVIDER_ID_REQUIRED");
  }

  async execute(input: TenantHostingLifecycleInput): Promise<TenantHostingLifecycleResult> {
    const claimed = await this.store.claim({ ...input, expectedProvider: this.providerId });
    if (claimed.kind === "already") return { action: input.action, state: claimed.state, confirmed: true, already: true };
    const errors: Record<Exclude<HostingLifecycleClaimResult["kind"], "claimed" | "already">, string> = {
      not_found: "HOSTING_DEPLOYMENT_NOT_FOUND",
      tenant_not_active: "TENANT_NOT_ACTIVE",
      tenant_not_closed: "TENANT_NOT_CLOSED",
      in_progress: "HOSTING_LIFECYCLE_IN_PROGRESS",
      invalid_state: "HOSTING_LIFECYCLE_STATE_INVALID",
      removed: "HOSTING_DEPLOYMENT_REMOVED",
      provider_mismatch: "HOSTING_PROVIDER_MISMATCH",
    };
    if (claimed.kind !== "claimed") throw new Error(errors[claimed.kind]);
    const { claim } = claimed;
    if (claim.reference.provider !== this.providerId) {
      await this.store.fail({ claim, action: input.action, errorCode: "HOSTING_PROVIDER_MISMATCH", actorId: input.actorId, requestId: input.requestId });
      throw new Error("HOSTING_PROVIDER_MISMATCH");
    }

    try {
      switch (input.action) {
        case "start": await this.provider.start(claim.reference); break;
        case "stop": await this.provider.stop(claim.reference); break;
        case "redeploy": await this.provider.redeploy(claim.reference); break;
        case "remove": await this.provider.remove(claim.reference); break;
      }
    } catch (error) {
      const code = error instanceof Error && /^[A-Z][A-Z0-9_]{1,63}$/.test(error.message)
        ? error.message : "HOSTING_PROVIDER_ACTION_FAILED";
      await this.store.fail({ claim, action: input.action, errorCode: code, actorId: input.actorId, requestId: input.requestId });
      throw new Error("HOSTING_PROVIDER_ACTION_FAILED");
    }

    if (input.action === "remove") {
      const saved = await this.store.complete({
        claim, action: input.action, state: "removed", confirmed: true,
        lastDeployedAt: null, actorId: input.actorId, requestId: input.requestId,
      });
      if (!saved) throw new Error("HOSTING_LIFECYCLE_LEASE_LOST");
      return { action: input.action, state: "removed", confirmed: true, already: false };
    }

    let state: TenantHostingDeploymentState = "unknown";
    let lastDeployedAt: string | null = null;
    try {
      const observed = await this.provider.inspect(claim.reference);
      if (observed.reference.provider !== claim.reference.provider ||
          observed.reference.resourceId !== claim.reference.resourceId ||
          observed.reference.tenantId !== claim.reference.tenantId) {
        throw new Error("HOSTING_PROVIDER_REFERENCE_MISMATCH");
      }
      state = observed.state;
      lastDeployedAt = observed.lastDeployedAt;
    } catch {
      // The provider action may have succeeded. Preserve that uncertainty and let
      // the read-only reconciler determine the actual state on its next poll.
      state = "unknown";
    }
    const confirmed = input.action === "stop"
      ? state === "stopped"
      : state === "running" || state === "deploying" || state === "ready";
    const saved = await this.store.complete({
      claim, action: input.action, state, confirmed, lastDeployedAt,
      actorId: input.actorId, requestId: input.requestId,
    });
    if (!saved) throw new Error("HOSTING_LIFECYCLE_LEASE_LOST");
    return { action: input.action, state, confirmed, already: false };
  }
}
