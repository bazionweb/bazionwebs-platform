import { randomUUID } from "node:crypto";
import type { TenantHostingDeploymentReference, TenantHostingProvider, TenantHostingTemplate, TenantId } from "@bazion/platform-contracts";

interface SqlResult<T> { rows: T[]; rowCount: number | null }
interface SqlClient {
  query<T = Record<string, unknown>>(statement: string, values?: unknown[]): Promise<SqlResult<T>>;
  release(): void;
}
export interface HostingSqlPool { connect(): Promise<SqlClient> }
export type HostingActorType = "user" | "service" | "system";

export interface BeginHostingProvisionInput {
  tenantId: string; provider: string; template: TenantHostingTemplate; templateVersion: string;
  idempotencyKey: string; actorType: HostingActorType; actorId: string; requestId?: string;
}
export type BeginHostingProvisionResult =
  | { kind: "claimed"; deploymentId: string; tenantSlug: string; leaseToken: string; attemptCount: number; reference: TenantHostingDeploymentReference | null }
  | { kind: "already_running"; reference: TenantHostingDeploymentReference; attemptCount: number }
  | { kind: "in_progress" }
  | { kind: "reconciliation_required" }
  | { kind: "tenant_not_found" }
  | { kind: "tenant_inactive" }
  | { kind: "idempotency_conflict" };

export interface HostingProvisioningStore {
  begin(input: BeginHostingProvisionInput): Promise<BeginHostingProvisionResult>;
  attachReference(input: { deploymentId: string; leaseToken: string; reference: TenantHostingDeploymentReference; actorType: HostingActorType; actorId: string; requestId?: string }): Promise<boolean>;
  markDeploying(input: { deploymentId: string; leaseToken: string; actorType: HostingActorType; actorId: string; requestId?: string }): Promise<boolean>;
  markRunning(input: { deploymentId: string; leaseToken: string; actorType: HostingActorType; actorId: string; requestId?: string }): Promise<boolean>;
  markFailed(input: { deploymentId: string; leaseToken: string; errorCode: string; actorType: HostingActorType; actorId: string; requestId?: string }): Promise<void>;
}

interface DeploymentRow {
  id: string; tenant_id: string; provider: string; template: TenantHostingTemplate;
  template_version: string; provider_resource_id: string | null; state: string;
  attempt_count: number; lease_expires_at: Date | string | null; created_at: Date | string;
}

function rowReference(row: DeploymentRow): TenantHostingDeploymentReference | null {
  if (!row.provider_resource_id) return null;
  const createdAt = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
  return { provider: row.provider, resourceId: row.provider_resource_id, tenantId: row.tenant_id as TenantId, createdAt: createdAt.toISOString() };
}
function leaseActive(value: Date | string | null): boolean {
  return value !== null && (value instanceof Date ? value.getTime() : Date.parse(value)) > Date.now();
}

/** PostgreSQL implementation. All state claims and their history events commit atomically. */
export class PostgresHostingProvisioningStore implements HostingProvisioningStore {
  constructor(private readonly pool: HostingSqlPool, private readonly leaseSeconds = 300) {
    if (!Number.isInteger(leaseSeconds) || leaseSeconds < 30 || leaseSeconds > 1800) throw new Error("HOSTING_LEASE_DURATION_INVALID");
  }

  async begin(input: BeginHostingProvisionInput): Promise<BeginHostingProvisionResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const tenantResult = await client.query<{ slug: string; status: string }>(
        "SELECT slug, status FROM public.tenants WHERE id = $1 FOR UPDATE", [input.tenantId],
      );
      const tenant = tenantResult.rows[0];
      if (!tenant) { await client.query("ROLLBACK"); return { kind: "tenant_not_found" }; }
      if (tenant.status !== "active") { await client.query("ROLLBACK"); return { kind: "tenant_inactive" }; }

      const leaseToken = randomUUID();
      const inserted = await client.query<DeploymentRow>(
        "INSERT INTO public.tenant_hosting_deployments " +
        "(tenant_id, provider, template, template_version, idempotency_key, state, attempt_count, requested_by, request_id, lease_token, lease_expires_at) " +
        "VALUES ($1,$2,$3,$4,$5,'provisioning',1,$6,$7,$8,now()+($9::integer*interval '1 second')) " +
        "ON CONFLICT (tenant_id,idempotency_key) DO NOTHING " +
        "RETURNING id,tenant_id,provider,template,template_version,provider_resource_id,state,attempt_count,lease_expires_at,created_at",
        [input.tenantId,input.provider,input.template,input.templateVersion,input.idempotencyKey,input.actorId,input.requestId ?? null,leaseToken,this.leaseSeconds],
      );
      if (inserted.rows[0]) {
        const row = inserted.rows[0];
        await this.appendEvent(client, row.id, input.tenantId, "hosting.provisioning.claimed", null, "provisioning", input, { template: input.template, attempt: 1 });
        await client.query("COMMIT");
        return { kind: "claimed", deploymentId: row.id, tenantSlug: tenant.slug, leaseToken, attemptCount: 1, reference: null };
      }

      const existingResult = await client.query<DeploymentRow>(
        "SELECT id,tenant_id,provider,template,template_version,provider_resource_id,state,attempt_count,lease_expires_at,created_at " +
        "FROM public.tenant_hosting_deployments WHERE tenant_id=$1 AND idempotency_key=$2 FOR UPDATE",
        [input.tenantId,input.idempotencyKey],
      );
      const existing = existingResult.rows[0];
      if (!existing) throw new Error("HOSTING_DEPLOYMENT_LOOKUP_FAILED");
      if (existing.provider !== input.provider || existing.template !== input.template || existing.template_version !== input.templateVersion) {
        await client.query("ROLLBACK"); return { kind: "idempotency_conflict" };
      }
      const reference = rowReference(existing);
      if (existing.state === "running" && reference) {
        await client.query("COMMIT"); return { kind: "already_running", reference, attemptCount: existing.attempt_count };
      }
      if (leaseActive(existing.lease_expires_at)) {
        await client.query("ROLLBACK"); return { kind: "in_progress" };
      }
      if (existing.state === "unknown" || !reference) {
        if (existing.state !== "unknown") {
          await client.query(
            "UPDATE public.tenant_hosting_deployments SET state='unknown',error_code='PROVISION_RESULT_UNCERTAIN'," +
            "lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=$1", [existing.id],
          );
          await this.appendEvent(client, existing.id, input.tenantId, "hosting.provisioning.reconciliation_required",
            existing.state, "unknown", input, { reason: "provider_resource_reference_missing" });
        }
        await client.query("COMMIT"); return { kind: "reconciliation_required" };
      }
      if (!["ready","failed","stopped","deploying"].includes(existing.state)) {
        await client.query("COMMIT"); return { kind: "reconciliation_required" };
      }
      const claimed = await client.query<{ attempt_count: number }>(
        "UPDATE public.tenant_hosting_deployments SET state='deploying',attempt_count=attempt_count+1,error_code=NULL," +
        "lease_token=$2,lease_expires_at=now()+($3::integer*interval '1 second'),updated_at=now() " +
        "WHERE id=$1 RETURNING attempt_count",
        [existing.id,leaseToken,this.leaseSeconds],
      );
      const attemptCount = claimed.rows[0]?.attempt_count;
      if (!attemptCount) throw new Error("HOSTING_DEPLOYMENT_CLAIM_FAILED");
      await this.appendEvent(client, existing.id, input.tenantId, "hosting.deployment.retry_claimed",
        existing.state, "deploying", input, { template: input.template, attempt: attemptCount });
      await client.query("COMMIT");
      return { kind: "claimed", deploymentId: existing.id, tenantSlug: tenant.slug, leaseToken, attemptCount, reference };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined); throw error;
    } finally { client.release(); }
  }

  async attachReference(input: { deploymentId: string; leaseToken: string; reference: TenantHostingDeploymentReference; actorType: HostingActorType; actorId: string; requestId?: string }): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        "UPDATE public.tenant_hosting_deployments SET provider_resource_id=$3,state='ready',updated_at=now() " +
        "WHERE id=$1 AND lease_token=$2 AND state='provisioning' AND provider_resource_id IS NULL",
        [input.deploymentId,input.leaseToken,input.reference.resourceId],
      );
      if (result.rowCount !== 1) { await client.query("ROLLBACK"); return false; }
      await this.appendRawEvent(client, input.deploymentId, input.reference.tenantId, "hosting.provider_resource.persisted",
        "provisioning","ready",input.actorType,input.actorId,input.requestId,{ provider: input.reference.provider });
      await client.query("COMMIT"); return true;
    } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
    finally { client.release(); }
  }

  async markDeploying(input: { deploymentId: string; leaseToken: string; actorType: HostingActorType; actorId: string; requestId?: string }): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const previous = await client.query<{ state: string }>(
        "SELECT state FROM public.tenant_hosting_deployments WHERE id=$1 AND lease_token=$2 FOR UPDATE",
        [input.deploymentId,input.leaseToken],
      );
      const previousState = previous.rows[0]?.state ?? null;
      const result = await client.query<{ tenant_id: string }>(
        "UPDATE public.tenant_hosting_deployments SET state='deploying',updated_at=now() " +
        "WHERE id=$1 AND lease_token=$2 AND state IN ('ready','deploying') RETURNING tenant_id",
        [input.deploymentId,input.leaseToken],
      );
      const tenantId = result.rows[0]?.tenant_id;
      if (!tenantId) { await client.query("ROLLBACK"); return false; }
      await this.appendRawEvent(client,input.deploymentId,tenantId,"hosting.deployment.deploying",previousState,"deploying",
        input.actorType,input.actorId,input.requestId,{});
      await client.query("COMMIT"); return true;
    } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
    finally { client.release(); }
  }

  async markRunning(input: { deploymentId: string; leaseToken: string; actorType: HostingActorType; actorId: string; requestId?: string }): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const previous = await client.query<{ state: string }>(
        "SELECT state FROM public.tenant_hosting_deployments WHERE id=$1 AND lease_token=$2 FOR UPDATE",
        [input.deploymentId,input.leaseToken],
      );
      const previousState = previous.rows[0]?.state ?? null;
      const result = await client.query<{ tenant_id: string }>(
        "UPDATE public.tenant_hosting_deployments SET state='running',error_code=NULL,last_deployed_at=now()," +
        "lease_token=NULL,lease_expires_at=NULL,updated_at=now() " +
        "WHERE id=$1 AND lease_token=$2 AND state IN ('ready','deploying') RETURNING tenant_id",
        [input.deploymentId,input.leaseToken],
      );
      const tenantId = result.rows[0]?.tenant_id;
      if (!tenantId) { await client.query("ROLLBACK"); return false; }
      await this.appendRawEvent(client,input.deploymentId,tenantId,"hosting.deployment.running",previousState,"running",
        input.actorType,input.actorId,input.requestId,{});
      await client.query("COMMIT"); return true;
    } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
    finally { client.release(); }
  }

  async markFailed(input: { deploymentId: string; leaseToken: string; errorCode: string; actorType: HostingActorType; actorId: string; requestId?: string }): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const previous = await client.query<{ state: string }>(
        "SELECT state FROM public.tenant_hosting_deployments WHERE id=$1 AND lease_token=$2 FOR UPDATE",
        [input.deploymentId,input.leaseToken],
      );
      const previousState = previous.rows[0]?.state ?? null;
      const result = await client.query<{ tenant_id: string; state: string; provider_resource_id: string | null }>(
        "UPDATE public.tenant_hosting_deployments SET state=CASE WHEN provider_resource_id IS NULL THEN 'unknown' ELSE 'failed' END," +
        "error_code=$3,lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=$1 AND lease_token=$2 " +
        "RETURNING tenant_id,state,provider_resource_id",
        [input.deploymentId,input.leaseToken,input.errorCode],
      );
      const row = result.rows[0];
      if (!row) { await client.query("ROLLBACK"); return; }
      await this.appendRawEvent(client,input.deploymentId,row.tenant_id,
        row.state === "unknown" ? "hosting.provisioning.uncertain" : "hosting.deployment.failed",
        previousState,row.state,
        input.actorType,input.actorId,input.requestId,{ errorCode: input.errorCode });
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
    finally { client.release(); }
  }

  private async appendEvent(client: SqlClient, deploymentId: string, tenantId: string, eventType: string,
    fromState: string | null, toState: string | null, input: BeginHostingProvisionInput,
    metadata: Record<string, string | number | boolean | null>): Promise<void> {
    await this.appendRawEvent(client,deploymentId,tenantId,eventType,fromState,toState,input.actorType,input.actorId,input.requestId,metadata);
  }

  private async appendRawEvent(client: SqlClient, deploymentId: string, tenantId: string, eventType: string,
    fromState: string | null, toState: string | null, actorType: HostingActorType, actorId: string,
    requestId: string | undefined, metadata: Record<string, string | number | boolean | null>): Promise<void> {
    await client.query(
      "INSERT INTO public.tenant_hosting_deployment_events " +
      "(deployment_id,tenant_id,event_type,from_state,to_state,actor_type,actor_id,request_id,metadata) " +
      "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)",
      [deploymentId,tenantId,eventType,fromState,toState,actorType,actorId,requestId ?? null,JSON.stringify(metadata)],
    );
  }
}

function safeProviderErrorCode(error: unknown): string {
  const candidate = error instanceof Error ? error.message : "";
  return /^[A-Z][A-Z0-9_]{1,63}$/.test(candidate) ? candidate : "HOSTING_PROVIDER_ERROR";
}

export interface ProvisionTenantHostingInput {
  tenantId: string; template: TenantHostingTemplate; templateVersion: string; idempotencyKey: string;
  composeFile: string; environmentSecretRef: string; actorType: HostingActorType; actorId: string; requestId?: string;
}
export interface ProvisionTenantHostingResult {
  reference: TenantHostingDeploymentReference; state: "running" | "deploying"; attemptCount: number; reused: boolean;
}

/**
 * A provider-create timeout is ambiguous because Dokploy compose.create has no
 * idempotency-key parameter. Such attempts become unknown and require reconciliation,
 * rather than issuing a second create and risking duplicate tenant resources.
 */
export class TenantHostingProvisioningService {
  constructor(private readonly store: HostingProvisioningStore, private readonly provider: TenantHostingProvider, private readonly providerId: string) {
    if (!providerId.trim()) throw new Error("HOSTING_PROVIDER_ID_REQUIRED");
  }

  async provision(input: ProvisionTenantHostingInput): Promise<ProvisionTenantHostingResult> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.tenantId) ||
        !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/.test(input.idempotencyKey) ||
        !input.templateVersion.trim() || !input.composeFile.trim() || !input.environmentSecretRef.trim() ||
        !input.actorId.trim() || input.actorId.length > 128) throw new Error("HOSTING_PROVISION_INPUT_INVALID");

    const started = await this.store.begin({
      tenantId: input.tenantId, provider: this.providerId, template: input.template,
      templateVersion: input.templateVersion, idempotencyKey: input.idempotencyKey,
      actorType: input.actorType, actorId: input.actorId, ...(input.requestId !== undefined ? { requestId: input.requestId } : {}),
    });
    if (started.kind === "already_running") return { reference: started.reference, state: "running", attemptCount: started.attemptCount, reused: true };
    if (started.kind === "in_progress") throw new Error("HOSTING_PROVISIONING_IN_PROGRESS");
    if (started.kind === "reconciliation_required") throw new Error("HOSTING_RECONCILIATION_REQUIRED");
    if (started.kind === "tenant_not_found") throw new Error("TENANT_NOT_FOUND");
    if (started.kind === "tenant_inactive") throw new Error("TENANT_NOT_ACTIVE");
    if (started.kind === "idempotency_conflict") throw new Error("HOSTING_IDEMPOTENCY_CONFLICT");

    let reference = started.reference;
    try {
      if (!reference) {
        reference = await this.provider.provision({
          tenantId: input.tenantId as TenantId, tenantSlug: started.tenantSlug,
          template: input.template, composeFile: input.composeFile,
          environmentSecretRef: input.environmentSecretRef,
        });
        if (reference.tenantId !== input.tenantId || reference.provider !== this.providerId || !reference.resourceId.trim()) {
          throw new Error("HOSTING_PROVIDER_REFERENCE_INVALID");
        }
        const persisted = await this.store.attachReference({
          deploymentId: started.deploymentId, leaseToken: started.leaseToken, reference,
          actorType: input.actorType, actorId: input.actorId, ...(input.requestId !== undefined ? { requestId: input.requestId } : {}),
        });
        if (!persisted) throw new Error("HOSTING_DEPLOYMENT_LEASE_LOST");
      }
      await this.provider.deploy(reference);
      const deploying = await this.store.markDeploying({
        deploymentId: started.deploymentId, leaseToken: started.leaseToken,
        actorType: input.actorType, actorId: input.actorId, ...(input.requestId !== undefined ? { requestId: input.requestId } : {}),
      });
      if (!deploying) throw new Error("HOSTING_DEPLOYMENT_LEASE_LOST");

      // Dokploy's deploy endpoint acknowledges the request; only compose.one can
      // confirm that the workload has reached the running state.
      let observedRunning = false;
      try {
        const observed = await this.provider.inspect(reference);
        if (observed.state === "failed") throw new Error("HOSTING_PROVIDER_REPORTED_FAILURE");
        observedRunning = observed.state === "running";
      } catch (error) {
        if (error instanceof Error && error.message === "HOSTING_PROVIDER_REPORTED_FAILURE") throw error;
        // An unavailable status read is inconclusive, not proof of a failed deployment.
      }

      if (observedRunning) {
        const running = await this.store.markRunning({
          deploymentId: started.deploymentId, leaseToken: started.leaseToken,
          actorType: input.actorType, actorId: input.actorId, ...(input.requestId !== undefined ? { requestId: input.requestId } : {}),
        });
        if (!running) throw new Error("HOSTING_DEPLOYMENT_LEASE_LOST");
      }
      return { reference, state: observedRunning ? "running" : "deploying", attemptCount: started.attemptCount, reused: Boolean(started.reference) };
    } catch (error) {
      await this.store.markFailed({
        deploymentId: started.deploymentId, leaseToken: started.leaseToken,
        errorCode: safeProviderErrorCode(error), actorType: input.actorType,
        actorId: input.actorId, ...(input.requestId !== undefined ? { requestId: input.requestId } : {}),
      }).catch(() => undefined);
      throw new Error("HOSTING_DEPLOYMENT_FAILED");
    }
  }
}
