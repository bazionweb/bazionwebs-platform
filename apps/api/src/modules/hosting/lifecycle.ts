import { randomUUID } from "node:crypto";
import type { TenantHostingDeploymentReference } from "@bazion/platform-contracts";
import type { HostingProvisioningRuntime } from "./runtime.js";

interface SqlResult<T> { rows: T[]; rowCount: number | null }
interface SqlClient {
  query<T = Record<string, unknown>>(statement: string, values?: unknown[]): Promise<SqlResult<T>>;
  release(): void;
}
export interface HostingLifecyclePool { connect(): Promise<SqlClient> }

interface DeploymentRow {
  id: string;
  tenant_id: string;
  provider: string;
  template: string;
  state: string;
  provider_resource_id: string | null;
  created_at: Date | string;
  lease_expires_at: Date | string | null;
}

export class HostingLifecycleError extends Error {
  constructor(public readonly code: string, public readonly statusCode: number) {
    super(code);
    this.name = "HostingLifecycleError";
  }
}

function isLeaseActive(value: Date | string | null): boolean {
  if (value === null) return false;
  const expiresAt = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function makeReference(row: DeploymentRow): TenantHostingDeploymentReference {
  const createdAt = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
  if (Number.isNaN(createdAt.getTime()) || !row.provider_resource_id) {
    throw new HostingLifecycleError("HOSTING_PROVIDER_REFERENCE_MISSING", 409);
  }
  return {
    provider: row.provider,
    resourceId: row.provider_resource_id,
    tenantId: row.tenant_id as TenantHostingDeploymentReference["tenantId"],
    createdAt: createdAt.toISOString(),
  };
}

function safeReason(reason: string): string {
  const value = reason.trim();
  if (value.length < 8 || value.length > 500) throw new HostingLifecycleError("HOSTING_REASON_INVALID", 400);
  return value;
}

/**
 * Audited, lease-fenced provider lifecycle operations. Remove always calls the
 * provider's non-volume-deleting operation and clears the live resource pointer
 * only after the provider confirms the resource is absent.
 */
export class HostingLifecycleService {
  constructor(
    private readonly pool: HostingLifecyclePool,
    private readonly runtime: HostingProvisioningRuntime,
  ) {}

  async inspect(input: { tenantId: string; tenantSlug: string; deploymentId: string }): Promise<{
    deploymentId: string;
    provider: string;
    resourceId: string;
    deploymentState: string;
    providerState: string;
    lastDeployedAt: string | null;
    inspectedAt: string;
  }> {
    const client = await this.pool.connect();
    let row: DeploymentRow | undefined;
    try {
      const result = await client.query<DeploymentRow>(
        "SELECT id::text,tenant_id::text,provider,template,state,provider_resource_id,created_at,lease_expires_at " +
        "FROM public.tenant_hosting_deployments WHERE id=$1 AND tenant_id=$2",
        [input.deploymentId, input.tenantId],
      );
      row = result.rows[0];
    } finally {
      client.release();
    }
    if (!row) throw new HostingLifecycleError("HOSTING_DEPLOYMENT_NOT_FOUND", 404);
    if (row.provider !== this.runtime.providerId) throw new HostingLifecycleError("HOSTING_PROVIDER_MISMATCH", 409);
    if (isLeaseActive(row.lease_expires_at)) throw new HostingLifecycleError("HOSTING_OPERATION_IN_PROGRESS", 409);
    const reference = makeReference(row);

    let observed: Awaited<ReturnType<HostingProvisioningRuntime["inspect"]>>;
    try {
      observed = await this.runtime.inspect(reference);
    } catch (error) {
      if (error instanceof Error && error.message === "HOSTING_RESOURCE_NOT_FOUND") {
        return {
          deploymentId: row.id,
          provider: row.provider,
          resourceId: reference.resourceId,
          deploymentState: row.state,
          providerState: "missing",
          lastDeployedAt: null,
          inspectedAt: new Date().toISOString(),
        };
      }
      throw new HostingLifecycleError("HOSTING_PROVIDER_OPERATION_FAILED", 502);
    }
    this.assertProviderIdentity(row, reference, observed, input.tenantSlug);

    const lastDeployedAt = observed.lastDeployedAt
      ? new Date(observed.lastDeployedAt).toISOString()
      : null;
    return {
      deploymentId: row.id,
      provider: row.provider,
      resourceId: reference.resourceId,
      deploymentState: row.state,
      providerState: observed.state,
      lastDeployedAt,
      inspectedAt: new Date().toISOString(),
    };
  }

  stop(input: { tenantId: string; tenantSlug: string; deploymentId: string; actorId: string; requestId: string; reason: string }) {
    return this.run("stop", input);
  }

  remove(input: { tenantId: string; tenantSlug: string; deploymentId: string; actorId: string; requestId: string; reason: string }) {
    return this.run("remove", input);
  }

  private async run(
    action: "stop" | "remove",
    input: { tenantId: string; tenantSlug: string; deploymentId: string; actorId: string; requestId: string; reason: string },
  ): Promise<{ deploymentId: string; state: "stopped"; removed: boolean; alreadyApplied: boolean }> {
    const reason = safeReason(input.reason);
    const claimed = await this.claim(action, { ...input, reason });
    if (claimed.alreadyRemoved) {
      return { deploymentId: input.deploymentId, state: "stopped", removed: true, alreadyApplied: true };
    }
    const { row, reference, leaseToken } = claimed;
    const lease = this.startLeaseHeartbeat(input, leaseToken);
    let mutationStarted = false;

    try {
      let inspected: Awaited<ReturnType<HostingProvisioningRuntime["inspect"]>>;
      try {
        inspected = await this.runtime.inspect(reference);
      } catch (error) {
        if (action === "remove" && error instanceof Error && error.message === "HOSTING_RESOURCE_NOT_FOUND") {
          lease.assertHeld();
          lease.stop();
          await this.finish(action, input, row, leaseToken, "stopped", {
            providerResourceId: reference.resourceId,
            reason,
            providerWasAlreadyAbsent: true,
            persistentVolumesDeleted: false,
          }, { clearProviderReference: true });
          return { deploymentId: row.id, state: "stopped", removed: true, alreadyApplied: true };
        }
        throw error;
      }
      this.assertProviderIdentity(row, reference, inspected, input.tenantSlug);
      lease.assertHeld();

      if (action === "stop") {
        if (inspected.state !== "stopped") {
          lease.assertHeld();
          mutationStarted = true;
          await this.runtime.stop(reference);
          lease.assertHeld();
        }
        const after = inspected.state === "stopped" ? inspected : await this.runtime.inspect(reference);
        this.assertProviderIdentity(row, reference, after, input.tenantSlug);
        lease.assertHeld();
        if (after.state !== "stopped") throw new HostingLifecycleError("HOSTING_STOP_NOT_CONFIRMED", 502);
        lease.stop();
        await this.finish(action, input, row, leaseToken, "stopped", {
          providerResourceId: reference.resourceId,
          reason,
          providerState: after.state,
        });
        return { deploymentId: row.id, state: "stopped", removed: false, alreadyApplied: inspected.state === "stopped" };
      }

      if (inspected.state !== "stopped") {
        throw new HostingLifecycleError("HOSTING_REMOVE_REQUIRES_STOPPED_RESOURCE", 409);
      }
      lease.assertHeld();
      mutationStarted = true;
      await this.runtime.remove(reference);
      lease.assertHeld();
      let absent = false;
      try {
        const after = await this.runtime.inspect(reference);
        this.assertProviderIdentity(row, reference, after, input.tenantSlug);
        absent = false;
      } catch (error) {
        if (error instanceof Error && error.message === "HOSTING_RESOURCE_NOT_FOUND") absent = true;
        else throw error;
      }
      lease.assertHeld();
      if (!absent) throw new HostingLifecycleError("HOSTING_REMOVE_NOT_CONFIRMED", 502);
      lease.stop();
      await this.finish(action, input, row, leaseToken, "stopped", {
        providerResourceId: reference.resourceId,
        reason,
        persistentVolumesDeleted: false,
      }, { clearProviderReference: true });
      return { deploymentId: row.id, state: "stopped", removed: true, alreadyApplied: false };
    } catch (error) {
      await this.fail(action, input, row, leaseToken, mutationStarted, reason).catch(() => undefined);
      if (error instanceof HostingLifecycleError) throw error;
      throw new HostingLifecycleError("HOSTING_PROVIDER_OPERATION_FAILED", 502);
    } finally {
      lease.stop();
    }
  }

  private startLeaseHeartbeat(
    input: { tenantId: string; deploymentId: string },
    leaseToken: string,
  ): { assertHeld(): void; stop(): void } {
    let stopped = false;
    let lost = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      timer = setTimeout(() => { void renew(); }, 25_000);
      timer.unref?.();
    };
    const renew = async () => {
      if (stopped) return;
      const client = await this.pool.connect().catch(() => null);
      if (!client) {
        lost = true;
        return;
      }
      try {
        const result = await client.query(
          "UPDATE public.tenant_hosting_deployments SET lease_expires_at=now()+interval '90 seconds',updated_at=now() " +
          "WHERE id=$1 AND tenant_id=$2 AND lease_token=$3 AND lease_expires_at > now()",
          [input.deploymentId, input.tenantId, leaseToken],
        );
        if (result.rowCount !== 1) lost = true;
      } catch {
        lost = true;
      } finally {
        client.release();
      }
      if (!stopped && !lost) schedule();
    };
    schedule();
    return {
      assertHeld() {
        if (lost) throw new HostingLifecycleError("HOSTING_OPERATION_LEASE_LOST", 409);
      },
      stop() {
        stopped = true;
        if (timer) clearTimeout(timer);
      },
    };
  }

  private async claim(
    action: "stop" | "remove",
    input: { tenantId: string; tenantSlug: string; deploymentId: string; actorId: string; requestId: string; reason: string },
  ): Promise<{ row: DeploymentRow; reference: TenantHostingDeploymentReference; leaseToken: string; alreadyRemoved: false } | { alreadyRemoved: true }> {
    const client = await this.pool.connect();
    const leaseToken = randomUUID();
    try {
      await client.query("BEGIN");
      const result = await client.query<DeploymentRow>(
        "SELECT id::text,tenant_id::text,provider,template,state,provider_resource_id,created_at,lease_expires_at " +
        "FROM public.tenant_hosting_deployments WHERE id=$1 AND tenant_id=$2 FOR UPDATE",
        [input.deploymentId, input.tenantId],
      );
      const row = result.rows[0];
      if (!row) throw new HostingLifecycleError("HOSTING_DEPLOYMENT_NOT_FOUND", 404);
      if (row.provider !== this.runtime.providerId) throw new HostingLifecycleError("HOSTING_PROVIDER_MISMATCH", 409);
      if (isLeaseActive(row.lease_expires_at)) throw new HostingLifecycleError("HOSTING_OPERATION_IN_PROGRESS", 409);
      if (action === "remove") {
        const tenantResult = await client.query<{ status: string }>(
          "SELECT status FROM public.tenants WHERE id=$1 FOR UPDATE",
          [input.tenantId],
        );
        if (tenantResult.rows[0]?.status !== "suspended") {
          throw new HostingLifecycleError("HOSTING_TENANT_MUST_BE_SUSPENDED", 409);
        }
      }

      if (!row.provider_resource_id) {
        if (action === "remove" && row.state === "stopped") {
          const removed = await client.query<{ exists: boolean }>(
            "SELECT EXISTS (SELECT 1 FROM public.tenant_hosting_deployment_events " +
            "WHERE deployment_id=$1 AND tenant_id=$2 AND event_type='hosting.deployment.removed') AS exists",
            [input.deploymentId, input.tenantId],
          );
          if (removed.rows[0]?.exists) {
            await client.query("COMMIT");
            return { alreadyRemoved: true };
          }
        }
        throw new HostingLifecycleError("HOSTING_PROVIDER_REFERENCE_MISSING", 409);
      }
      if (action === "remove" && row.state !== "stopped") {
        const priorRemoval = row.state === "unknown"
          ? await this.hasPriorLifecycleRequest(client, input, "remove")
          : false;
        if (!priorRemoval) throw new HostingLifecycleError("HOSTING_REMOVE_REQUIRES_STOPPED_RESOURCE", 409);
      }
      if (action === "stop" && !["ready", "running", "stopped", "failed"].includes(row.state)) {
        const priorStop = row.state === "unknown"
          ? await this.hasPriorLifecycleRequest(client, input, "stop")
          : false;
        if (!priorStop) throw new HostingLifecycleError("HOSTING_DEPLOYMENT_NOT_STOPPABLE", 409);
      }

      const reference = makeReference(row);

      const claimed = await client.query(
        "UPDATE public.tenant_hosting_deployments SET lease_token=$3,lease_expires_at=now()+interval '90 seconds',updated_at=now() " +
        "WHERE id=$1 AND tenant_id=$2 AND (lease_expires_at IS NULL OR lease_expires_at <= now())",
        [input.deploymentId, input.tenantId, leaseToken],
      );
      if (claimed.rowCount !== 1) throw new HostingLifecycleError("HOSTING_OPERATION_IN_PROGRESS", 409);
      await client.query(
        "INSERT INTO public.tenant_hosting_deployment_events " +
        "(deployment_id,tenant_id,event_type,from_state,to_state,actor_type,actor_id,request_id,metadata) " +
        "VALUES ($1,$2,$3,$4,$4,'user',$5,$6,$7::jsonb)",
        [input.deploymentId, input.tenantId, `hosting.deployment.${action}_requested`, row.state, input.actorId, input.requestId,
          JSON.stringify({ provider: row.provider, template: row.template, reason: input.reason })],
      );
      await client.query("COMMIT");
      return { row, reference, leaseToken, alreadyRemoved: false };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async hasPriorLifecycleRequest(
    client: SqlClient,
    input: { tenantId: string; deploymentId: string },
    action: "stop" | "remove",
  ): Promise<boolean> {
    const result = await client.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM public.tenant_hosting_deployment_events " +
      "WHERE deployment_id=$1 AND tenant_id=$2 AND event_type=$3) AS exists",
      [input.deploymentId, input.tenantId, `hosting.deployment.${action}_requested`],
    );
    return result.rows[0]?.exists === true;
  }

  private assertProviderIdentity(
    row: DeploymentRow,
    reference: TenantHostingDeploymentReference,
    observed: Awaited<ReturnType<HostingProvisioningRuntime["inspect"]>>,
    tenantSlug: string,
  ): void {
    const expectedName = `${tenantSlug}-${row.template}`;
    if (
      observed.reference.provider !== reference.provider ||
      observed.reference.resourceId !== reference.resourceId ||
      observed.reference.tenantId !== reference.tenantId ||
      observed.providerEnvironmentId !== this.runtime.environmentId ||
      !observed.providerResourceName ||
      observed.providerResourceName !== expectedName
    ) {
      throw new HostingLifecycleError("HOSTING_PROVIDER_IDENTITY_MISMATCH", 409);
    }
  }

  private async finish(
    action: "stop" | "remove",
    input: { tenantId: string; tenantSlug: string; deploymentId: string; actorId: string; requestId: string; reason: string },
    row: DeploymentRow,
    leaseToken: string,
    state: "stopped",
    metadata: Record<string, string | number | boolean | null>,
    options: { clearProviderReference?: boolean } = {},
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const updated = await client.query(
        "UPDATE public.tenant_hosting_deployments SET state=$4,error_code=NULL," +
        "provider_resource_id=CASE WHEN $5 THEN NULL ELSE provider_resource_id END," +
        "last_inspected_at=now(),lease_token=NULL,lease_expires_at=NULL,updated_at=now() " +
        "WHERE id=$1 AND tenant_id=$2 AND lease_token=$3",
        [input.deploymentId, input.tenantId, leaseToken, state, options.clearProviderReference === true],
      );
      if (updated.rowCount !== 1) throw new HostingLifecycleError("HOSTING_OPERATION_LEASE_LOST", 409);
      await client.query(
        "INSERT INTO public.tenant_hosting_deployment_events " +
        "(deployment_id,tenant_id,event_type,from_state,to_state,actor_type,actor_id,request_id,metadata) " +
        "VALUES ($1,$2,$3,$4,$5,'user',$6,$7,$8::jsonb)",
        [input.deploymentId, input.tenantId, `hosting.deployment.${action === "remove" ? "removed" : "stopped"}`,
          row.state, state, input.actorId, input.requestId, JSON.stringify(metadata)],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async fail(
    action: "stop" | "remove",
    input: { tenantId: string; deploymentId: string; actorId: string; requestId: string; reason: string },
    row: DeploymentRow,
    leaseToken: string,
    mutationStarted: boolean,
    reason: string,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const nextState = mutationStarted ? "unknown" : row.state;
      const updated = await client.query(
        "UPDATE public.tenant_hosting_deployments SET state=$4,error_code=$5,lease_token=NULL,lease_expires_at=NULL,updated_at=now() " +
        "WHERE id=$1 AND tenant_id=$2 AND lease_token=$3",
        [input.deploymentId, input.tenantId, leaseToken, nextState, mutationStarted ? "HOSTING_EFFECT_UNCERTAIN" : "HOSTING_PROVIDER_OPERATION_FAILED"],
      );
      if (updated.rowCount !== 1) {
        await client.query("ROLLBACK");
        return;
      }
      await client.query(
        "INSERT INTO public.tenant_hosting_deployment_events " +
        "(deployment_id,tenant_id,event_type,from_state,to_state,actor_type,actor_id,request_id,metadata) " +
        "VALUES ($1,$2,$3,$4,$5,'user',$6,$7,$8::jsonb)",
        [input.deploymentId, input.tenantId, `hosting.deployment.${action}_failed`, row.state, nextState, input.actorId, input.requestId,
          JSON.stringify({ reason, errorCode: mutationStarted ? "HOSTING_EFFECT_UNCERTAIN" : "HOSTING_PROVIDER_OPERATION_FAILED" })],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
