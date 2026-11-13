import { createHmac, randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import * as readline from "node:readline";
import { fileURLToPath } from "node:url";
import { PostgresAuditEventWriter } from "@bazion/audit";
import Fastify, { type FastifyInstance } from "fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  DEFAULT_CALLBACK_AUDIENCE,
  DEFAULT_CALLBACK_ISSUER,
  DEFAULT_COMMAND_AUDIENCE,
  DEFAULT_COMMAND_ISSUER,
  createWebhookSignatureHeader,
  signMachineBearerToken,
} from "./auth.js";
import { commercialProvisioningRoutes, type CommercialProvisioningRuntime } from "./routes.js";
import { InstallationChangeService } from "./installation-change-service.js";
import { createDefaultTenantLifecycleAdapter, SubscriptionLifecycleService } from "./lifecycle-service.js";
import type { ProvisioningOfferBinding } from "./offer-resolution.js";
import { CommercialProvisioningService } from "./service.js";
import { integrationOfferBinding } from "./offer-resolution.test-fixtures.js";
import {
  PlatformLifecycleOutboxDispatcher,
  PlatformStatusOutboxDispatcher,
} from "./status-outbox-worker.js";

async function readTenantAndInstallationStatus(
  pool: Pool,
  tenantId: string,
  installationId: string,
): Promise<{ t_status: string; i_status: string } | undefined> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const res = await client.query<{ t_status: string; i_status: string }>(
      `SELECT t.status AS t_status, pi.status AS i_status
         FROM public.tenants t
         JOIN public.product_installations pi ON pi.tenant_id = t.id
        WHERE t.id = $1::uuid AND pi.id = $2::uuid`,
      [tenantId, installationId],
    );
    await client.query("COMMIT");
    return res.rows[0];
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

const crossRepoE2eOfferBindings: ProvisioningOfferBinding[] = [integrationOfferBinding];

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRootDir = resolve(currentDir, "../../../../..");

function resolveBazionwebApiDir(): string {
  const explicit = process.env.BAZIONWEB_API_DIR?.trim();
  const candidates = [
    explicit ? resolve(repoRootDir, explicit) : null,
    explicit ? resolve(explicit) : null,
    resolve(repoRootDir, ".bazionweb/apps/api"),
    resolve(repoRootDir, "../bazionweb/apps/api"),
    resolve(currentDir, "../../../../../../../bazionweb/apps/api"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (existsSync(resolve(candidate, "scripts/phase3-e2e-bridge.ts"))) {
      return candidate;
    }
  }
  return candidates[0] ?? resolve(repoRootDir, ".bazionweb/apps/api");
}

const bazionwebApiDir = resolveBazionwebApiDir();
const bridgeScriptPath = resolve(bazionwebApiDir, "scripts/phase3-e2e-bridge.ts");

function isSafeLocalBazionwebTestDb(urlString: string | undefined): boolean {
  if (!urlString?.trim()) return false;
  try {
    const parsed = new URL(urlString.trim());
    if (process.env.ALLOW_REMOTE_TEST_DB === "true") return true;
    const isLocalHost = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
    const isTestDbName = parsed.pathname.toLowerCase().includes("test");
    return isLocalHost && isTestDbName;
  } catch {
    return false;
  }
}

const enabled = Boolean(
  process.env.MIGRATION_DATABASE_URL
  && process.env.PRODUCT_PROVISIONER_DATABASE_URL
  && isSafeLocalBazionwebTestDb(process.env.BAZIONWEB_TEST_DATABASE_URL)
  && existsSync(bridgeScriptPath),
);

interface PendingRpc {
  resolve: (value: any) => void;
  reject: (reason: Error) => void;
}

class BazionwebBridgeClient {
  private child: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<string, PendingRpc>();
  private stderrLogs: string[] = [];
  public baseUrl = "";

  async start(envVars: Record<string, string>): Promise<void> {
    const req = createRequire(resolve(bazionwebApiDir, "package.json"));
    const tsNodeBin = req.resolve("ts-node/dist/bin.js");

    this.child = spawn(process.execPath, [tsNodeBin, "--transpile-only", bridgeScriptPath], {
      cwd: bazionwebApiDir,
      env: { ...process.env, ...envVars },
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.child.stderr.on("data", (chunk: Buffer) => {
      this.stderrLogs.push(chunk.toString("utf8"));
    });

    const rl = readline.createInterface({ input: this.child.stdout, crlfDelay: Infinity });

    await new Promise<void>((resolveReady, rejectReady) => {
      const timeout = setTimeout(() => {
        rejectReady(new Error(`Timed out waiting for Bazionweb E2E bridge startup.\nLogs:\n${this.stderrLogs.join("")}`));
      }, 25_000);

      rl.on("line", (line) => {
        if (!line.trim()) return;
        let parsed: Record<string, any>;
        try {
          parsed = JSON.parse(line);
        } catch {
          return;
        }

        if (parsed.type === "ready") {
          clearTimeout(timeout);
          this.baseUrl = String(parsed.bazionwebBaseUrl);
          resolveReady();
          return;
        }

        const reqId = typeof parsed.reqId === "string" ? parsed.reqId : "";
        const entry = this.pending.get(reqId);
        if (!entry) return;
        this.pending.delete(reqId);
        if (parsed.ok) {
          entry.resolve(parsed.result);
        } else {
          entry.reject(new Error(String(parsed.error || "BRIDGE_RPC_ERROR")));
        }
      });

      this.child?.once("exit", (code) => {
        clearTimeout(timeout);
        if (!this.baseUrl) {
          rejectReady(new Error(`Bazionweb E2E bridge exited early (${code}).\nLogs:\n${this.stderrLogs.join("")}`));
        }
        for (const [, waiter] of this.pending) {
          waiter.reject(new Error(`Bridge process exited (${code})`));
        }
        this.pending.clear();
      });
    });
  }

  async call<T = any>(op: string, args: Record<string, unknown> = {}): Promise<T> {
    if (!this.child) throw new Error("Bridge process not started");
    const reqId = randomUUID();
    return new Promise<T>((resolveCall, rejectCall) => {
      this.pending.set(reqId, { resolve: resolveCall, reject: rejectCall });
      this.child!.stdin.write(`${JSON.stringify({ reqId, op, args })}\n`);
    });
  }

  async stop(): Promise<void> {
    if (!this.child) return;
    try {
      await Promise.race([
        this.call("shutdown"),
        new Promise((resolveTimeout) => setTimeout(resolveTimeout, 4000)),
      ]);
    } catch {
      // ignore if already exited
    }
    this.child.kill();
    this.child = null;
  }
}

async function advanceOperationToReadyWithTenant(
  migrationPool: Pool,
  provisionerPool: Pool,
  service: CommercialProvisioningService,
  operationId: string,
  slug: string,
): Promise<{ tenantId: string; installationId: string }> {
  const opRowRes = await provisionerPool.query<{
    source: string;
    external_customer_id: string;
    external_order_id: string;
    product_id: string;
    product_version: string;
    solution_id: string;
    solution_version: string;
    template_id: string;
    template_version: string;
    idempotency_key: string;
    request_fingerprint: string;
  }>(
    `SELECT source, external_customer_id, external_order_id, product_id, product_version,
            solution_id, solution_version, template_id, template_version, idempotency_key, request_fingerprint
       FROM public.product_provisioning_operations
      WHERE id = $1`,
    [operationId],
  );
  const opRow = opRowRes.rows[0]!;

  const client = await migrationPool.connect();
  let tenantId = "";
  let installationId = "";
  try {
    await client.query("BEGIN");
    const tenantInsert = await client.query<{ id: string }>(
      "INSERT INTO public.tenants (slug, name, default_currency) VALUES ($1, $2, 'KES') RETURNING id",
      [slug, `E2E Tenant ${slug}`],
    );
    tenantId = tenantInsert.rows[0]!.id;
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const installInsert = await client.query<{ id: string }>(
      `INSERT INTO public.product_installations (
         tenant_id, source, external_customer_id, external_order_id,
         product_id, product_version, solution_id, solution_version,
         template_id, template_version, configuration_schema_version,
         distribution_mode, idempotency_key, request_fingerprint, status, ready_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, '1.0.0', 'shared-managed', $11, $12, 'ready', now())
       RETURNING id`,
      [
        tenantId,
        opRow.source,
        opRow.external_customer_id,
        opRow.external_order_id,
        opRow.product_id,
        opRow.product_version,
        opRow.solution_id,
        opRow.solution_version,
        opRow.template_id,
        opRow.template_version,
        opRow.idempotency_key,
        opRow.request_fingerprint,
      ],
    );
    installationId = installInsert.rows[0]!.id;
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  for (const step of [
    { nextStatus: "validating", currentStep: "validating_request" },
    { nextStatus: "provisioning_tenant", currentStep: "provisioning_tenant", tenantId },
    { nextStatus: "configuring_installation", currentStep: "configuring_installation", tenantId, installationId },
    { nextStatus: "provisioning_hosting", currentStep: "provisioning_hosting", tenantId, installationId },
    { nextStatus: "ready", currentStep: "installation_ready", tenantId, installationId },
  ] as const) {
    await service.transitionOperation({
      operationId,
      nextStatus: step.nextStatus,
      currentStep: step.currentStep,
      ...("tenantId" in step ? { tenantId: step.tenantId } : {}),
      ...("installationId" in step ? { installationId: step.installationId } : {}),
    });
  }

  return { tenantId, installationId };
}

describe.skipIf(!enabled)("Cross-repo live end-to-end commercial-to-platform delivery", () => {
  const commandSecret = "cross-repo-command-secret-32-chars!!";
  const callbackSigningSecret = "cross-repo-callback-secret-32-char!!";
  const callbackBearerSecret = "cross-repo-callback-bearer-32-char!!";

  let platformApp: FastifyInstance;
  let platformBaseUrl = "";
  let runtime: CommercialProvisioningRuntime | null = null;
  let provisionerPool: Pool;
  let migrationPool: Pool;
  let closeTenantDatabaseResources: (() => Promise<void>) | null = null;
  let service: CommercialProvisioningService;
  let dispatcher: PlatformStatusOutboxDispatcher;
  let lifecycleService: SubscriptionLifecycleService;
  let lifecycleDispatcher: PlatformLifecycleOutboxDispatcher;
  let installationChangeService: InstallationChangeService;
  let bridge: BazionwebBridgeClient;

  const createdOperationIds: string[] = [];
  const createdLifecycleSubscriptionIds: string[] = [];

  beforeAll(async () => {
    migrationPool = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL, max: 2 });
    provisionerPool = new Pool({ connectionString: process.env.PRODUCT_PROVISIONER_DATABASE_URL, max: 4 });
    service = new CommercialProvisioningService(provisionerPool, crossRepoE2eOfferBindings);
    dispatcher = new PlatformStatusOutboxDispatcher(provisionerPool);
    const databaseModule = await import("../../lib/database.js");
    closeTenantDatabaseResources = databaseModule.closeTenantDatabaseResources;

    lifecycleService = new SubscriptionLifecycleService(
      provisionerPool,
      new PostgresAuditEventWriter(databaseModule.pool),
      createDefaultTenantLifecycleAdapter(migrationPool),
    );
    lifecycleDispatcher = new PlatformLifecycleOutboxDispatcher(provisionerPool);
    installationChangeService = new InstallationChangeService(
      provisionerPool,
      new PostgresAuditEventWriter(databaseModule.pool),
    );

    runtime = {
      commandAuth: {
        secret: commandSecret,
        issuer: DEFAULT_COMMAND_ISSUER,
        audience: DEFAULT_COMMAND_AUDIENCE,
      },
      service,
      dispatcher,
      lifecycleService,
      lifecycleDispatcher,
      installationChangeService,
      close: async () => undefined,
    };

    platformApp = Fastify({ logger: false });
    await platformApp.register(commercialProvisioningRoutes, {
      prefix: "/v1",
      runtime,
    });
    await platformApp.listen({ port: 0, host: "127.0.0.1" });
    const addr = platformApp.server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    platformBaseUrl = `http://127.0.0.1:${port}`;

    bridge = new BazionwebBridgeClient();
    await bridge.start({
      BAZIONWEB_TEST_DATABASE_URL: process.env.BAZIONWEB_TEST_DATABASE_URL!,
      PLATFORM_PROVISIONING_COMMAND_SECRET: commandSecret,
      PLATFORM_PROVISIONING_COMMAND_ISSUER: DEFAULT_COMMAND_ISSUER,
      PLATFORM_PROVISIONING_COMMAND_AUDIENCE: DEFAULT_COMMAND_AUDIENCE,
      PLATFORM_CALLBACK_SIGNING_SECRET: callbackSigningSecret,
      PLATFORM_CALLBACK_BEARER_SECRET: callbackBearerSecret,
    });
  }, 35_000);

  afterAll(async () => {
    await bridge?.stop();

    if (createdOperationIds.length > 0 && provisionerPool) {
      await provisionerPool.query(
        `UPDATE public.product_provisioning_status_outbox
            SET status = 'delivered',
                lease_token = NULL,
                lease_expires_at = NULL,
                delivered_at = COALESCE(delivered_at, now())
          WHERE operation_id = ANY($1::uuid[]) AND status <> 'delivered'`,
        [createdOperationIds],
      ).catch(() => undefined);
    }

    if (createdLifecycleSubscriptionIds.length > 0 && provisionerPool) {
      await provisionerPool.query(
        `UPDATE public.product_subscription_lifecycle_outbox
            SET status = 'delivered',
                lease_token = NULL,
                lease_expires_at = NULL,
                delivered_at = COALESCE(delivered_at, now())
          WHERE lifecycle_inbox_id IN (
            SELECT id FROM public.product_subscription_lifecycle_inbox WHERE subscription_id = ANY($1::text[])
          ) AND status <> 'delivered'`,
        [createdLifecycleSubscriptionIds],
      ).catch(() => undefined);
    }

    await platformApp?.close();
    await runtime?.close();
    await provisionerPool?.end();
    await migrationPool?.end();
    await closeTenantDatabaseResources?.();
  }, 15_000);

  it("delivers settled Bazionweb purchases to Platform Fastify+PG, survives downtime, returns signed callbacks to NestJS+PG, and reconciles lag", async () => {
    const suffix = randomUUID().slice(0, 8);

    // 1. Bazionweb transaction atomicity rollback check in bazionweb_test PG
    const rollback = await bridge.call<{
      rolledBack: boolean;
      invoiceStatus: string;
      paidAt: string | null;
      outboxCount: number;
    }>("verify_rollback", { suffix });
    expect(rollback.rolledBack).toBe(true);
    expect(rollback.invoiceStatus).toBe("SENT");
    expect(rollback.paidAt).toBeNull();
    expect(rollback.outboxCount).toBe(0);

    // 2. Settle paid invoice on Bazionweb -> commits invoice, subscription & PENDING outbox row in one PG tx
    const settled = await bridge.call<{
      settleStatus: string;
      invoiceId: string;
      invoiceNumber: string;
      outbox: { id: string; status: string; externalOrderId: string; idempotencyKey: string; payload: Record<string, any> };
    }>("settle_invoice", { suffix, offerId: "website-business" });
    expect(settled.settleStatus).toBe("PROCESSED");
    expect(settled.outbox.status).toBe("PENDING");
    expect(settled.outbox.externalOrderId).toBe(`${settled.invoiceNumber}:line:0`);

    // 3. Platform downtime -> Bazionweb worker hits closed local port -> retry scheduled with backoff
    const downBatch = await bridge.call<{ retried: number; accepted: number }>("run_worker_batch", {
      platformApiBaseUrl: "http://127.0.0.1:1",
    });
    expect(downBatch.retried).toBeGreaterThanOrEqual(1);

    const stateAfterDown = await bridge.call<{
      outbox: { status: string; attemptCount: number; lastErrorCode: string | null; leaseToken: string | null };
    }>("get_state", { outboxId: settled.outbox.id });
    expect(stateAfterDown.outbox.status).toBe("PENDING");
    expect(stateAfterDown.outbox.attemptCount).toBe(1);
    expect(stateAfterDown.outbox.leaseToken).toBeNull();
    expect(stateAfterDown.outbox.lastErrorCode).toBe("DELIVERY_NETWORK_ERROR");

    // 4. Platform comes back online -> Bazionweb worker posts signed command over real HTTP to Platform Fastify
    await bridge.call("backdate_outbox", {
      outboxId: settled.outbox.id,
      nextAttemptAt: new Date(Date.now() - 1000).toISOString(),
    });
    const deliveredBatch = await bridge.call<{ accepted: number }>("run_worker_batch", {
      platformApiBaseUrl: platformBaseUrl,
    });
    const deliveryState = await bridge.call<{
      outbox: { status: string; lastHttpStatus: number | null; lastErrorCode: string | null };
    }>("get_state", { outboxId: settled.outbox.id });
    expect(deliveredBatch.accepted, JSON.stringify({ deliveredBatch, outbox: deliveryState.outbox }))
      .toBeGreaterThanOrEqual(1);

    const stateAfterAccept = await bridge.call<{
      outbox: { status: string; platformOperationId: string | null };
    }>("get_state", { outboxId: settled.outbox.id });
    expect(stateAfterAccept.outbox.status).toBe("ACCEPTED");
    const operationId = stateAfterAccept.outbox.platformOperationId!;
    expect(operationId).toMatch(/^[0-9a-f-]{36}$/i);
    createdOperationIds.push(operationId);

    // Confirm Platform PG inbox + status outbox atomic creation via trigger
    const platformInboxRes = await provisionerPool.query<{ idempotency_key: string }>(
      "SELECT idempotency_key FROM public.product_provisioning_inbox WHERE operation_id = $1",
      [operationId],
    );
    expect(platformInboxRes.rows).toHaveLength(1);
    expect(platformInboxRes.rows[0]?.idempotency_key).toBe(settled.outbox.idempotencyKey);

    // 5. Direct HTTP replay with identical idempotencyKey -> deduplicated 202; mutated content -> 409 conflict
    const writeJwt = signMachineBearerToken(
      {
        subject: "cross-repo-e2e-verifier",
        issuer: DEFAULT_COMMAND_ISSUER,
        audience: DEFAULT_COMMAND_AUDIENCE,
        scopes: ["commercial:provisioning:write"],
        ttlSeconds: 120,
      },
      commandSecret,
    );

    const dupHttp = await fetch(`${platformBaseUrl}/v1/internal/commercial/provisioning-requests`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${writeJwt}`,
      },
      body: JSON.stringify(settled.outbox.payload),
    });
    expect(dupHttp.status).toBe(202);
    const dupBody = (await dupHttp.json()) as { deduplicated: boolean; operation: { operationId: string } };
    expect(dupBody.deduplicated).toBe(true);
    expect(dupBody.operation.operationId).toBe(operationId);

    const conflictPayload = {
      ...settled.outbox.payload,
      eventId: randomUUID(),
      order: {
        ...settled.outbox.payload.order,
        offerVersion: "9.9.9",
      },
    };
    const conflictWriteJwt = signMachineBearerToken(
      {
        subject: "cross-repo-e2e-verifier",
        issuer: DEFAULT_COMMAND_ISSUER,
        audience: DEFAULT_COMMAND_AUDIENCE,
        scopes: ["commercial:provisioning:write"],
        ttlSeconds: 120,
      },
      commandSecret,
    );
    const conflictHttp = await fetch(`${platformBaseUrl}/v1/internal/commercial/provisioning-requests`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${conflictWriteJwt}`,
      },
      body: JSON.stringify(conflictPayload),
    });
    expect(conflictHttp.status).toBe(409);

    // 6. Platform creates tenant + product_installation (under forced RLS) and advances operation to ready -> PG trigger writes status outbox
    const { tenantId, installationId } = await advanceOperationToReadyWithTenant(
      migrationPool,
      provisionerPool,
      service,
      operationId,
      `e2e-prov-${suffix}`,
    );

    // 7. Callback downtime simulation first -> Platform status outbox retries safely
    const cbDown = await dispatcher.processDueBatch({
      callbackUrl: "http://127.0.0.1:1/api/v1/webhooks/platform/provisioning-status",
      signingSecret: callbackSigningSecret,
      bearerSigningSecret: callbackBearerSecret,
      batchSize: 50,
      retryBaseSeconds: 10,
      retryMaxSeconds: 60,
    });
    expect(cbDown.retried).toBeGreaterThanOrEqual(1);

    // 8. Reset due timestamps and deliver signed callbacks over real HTTP to live NestJS Bazionweb app
    await provisionerPool.query(
      "UPDATE public.product_provisioning_status_outbox SET next_attempt_at = now() - interval '1 second' WHERE operation_id = $1 AND status = 'pending'",
      [operationId],
    );

    const callbackEndpoint = `${bridge.baseUrl}/api/v1/webhooks/platform/provisioning-status`;
    const cbUp = await dispatcher.processDueBatch({
      callbackUrl: callbackEndpoint,
      signingSecret: callbackSigningSecret,
      bearerSigningSecret: callbackBearerSecret,
      batchSize: 50,
    });
    expect(cbUp.delivered).toBeGreaterThanOrEqual(6);

    const stateAfterCallbacks = await bridge.call<{
      inboxCount: number;
      outbox: {
        projection: {
          status: string;
          platformTenantId: string | null;
          installationId: string | null;
        } | null;
      };
    }>("get_state", { outboxId: settled.outbox.id, operationId });
    expect(stateAfterCallbacks.inboxCount).toBe(6);
    expect(stateAfterCallbacks.outbox.projection?.status).toBe("ready");
    expect(stateAfterCallbacks.outbox.projection?.platformTenantId).toBe(tenantId);
    expect(stateAfterCallbacks.outbox.projection?.installationId).toBe(installationId);

    // Verify replayed webhook event over live HTTP is idempotent in Bazionweb PG inbox
    const oneDelivered = await provisionerPool.query<{ payload: Record<string, unknown> }>(
      "SELECT payload FROM public.product_provisioning_status_outbox WHERE operation_id = $1 LIMIT 1",
      [operationId],
    );
    const replayRaw = JSON.stringify(oneDelivered.rows[0]!.payload);
    const replaySig = createWebhookSignatureHeader(replayRaw, callbackSigningSecret);
    const replayJwt = signMachineBearerToken(
      {
        subject: "cross-repo-replay-test",
        issuer: DEFAULT_CALLBACK_ISSUER,
        audience: DEFAULT_CALLBACK_AUDIENCE,
        scopes: ["provisioning:status:write"],
        ttlSeconds: 120,
      },
      callbackBearerSecret,
    );
    const replayResp = await fetch(callbackEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-bazion-signature": replaySig,
        authorization: `Bearer ${replayJwt}`,
      },
      body: replayRaw,
    });
    expect(replayResp.status).toBe(202);
    const replayJson = (await replayResp.json()) as { deduplicated: boolean };
    expect(replayJson.deduplicated).toBe(true);

    // Verify tampered HMAC is rejected with 401 by NestJS over live HTTP
    const tamperedJwt = signMachineBearerToken(
      {
        subject: "cross-repo-replay-test",
        issuer: DEFAULT_CALLBACK_ISSUER,
        audience: DEFAULT_CALLBACK_AUDIENCE,
        scopes: ["provisioning:status:write"],
        ttlSeconds: 120,
      },
      callbackBearerSecret,
    );
    const badHmac = createHmac("sha256", "wrong-secret-32-chars-minimum-1234").update(`1.${replayRaw}`).digest("hex");
    const tamperedResp = await fetch(callbackEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-bazion-signature": `t=${Math.floor(Date.now() / 1000)},v1=${badHmac}`,
        authorization: `Bearer ${tamperedJwt}`,
      },
      body: replayRaw,
    });
    expect(tamperedResp.status).toBe(401);

    // 9. Second invoice: accepted on Platform, callbacks suppressed -> Bazionweb reconciliation polls live GET /operations/:id
    const lagSuffix = `${suffix}-lag`;
    const settledLag = await bridge.call<{
      outbox: { id: string };
    }>("settle_invoice", { suffix: lagSuffix, offerId: "website-business" });

    const lagBatch = await bridge.call<{ accepted: number }>("run_worker_batch", {
      platformApiBaseUrl: platformBaseUrl,
    });
    const lagDeliveryState = await bridge.call<{
      outbox: { lastHttpStatus: number | null; lastErrorCode: string | null };
    }>("get_state", { outboxId: settledLag.outbox.id });
    expect(lagBatch.accepted, JSON.stringify({ lagBatch, outbox: lagDeliveryState.outbox }))
      .toBeGreaterThanOrEqual(1);

    const lagStateBefore = await bridge.call<{
      outbox: { platformOperationId: string };
    }>("get_state", { outboxId: settledLag.outbox.id });
    const lagOpId = lagStateBefore.outbox.platformOperationId;
    createdOperationIds.push(lagOpId);

    const { installationId: lagInstallationId } = await advanceOperationToReadyWithTenant(
      migrationPool,
      provisionerPool,
      service,
      lagOpId,
      `e2e-lag-${suffix}`,
    );

    // Backdate Bazionweb acceptedAt so reconciliation recognizes callback lag and polls live Platform Fastify
    await bridge.call("backdate_outbox", {
      outboxId: settledLag.outbox.id,
      acceptedAt: new Date(Date.now() - 180_000).toISOString(),
    });

    const reconResult = await bridge.call<{
      reportBefore: { laggingAcceptedOutbox: Array<{ outboxId: string }> };
      poll: { checked: number; updated: number; errors: number };
      reportAfter: { laggingAcceptedOutbox: Array<{ outboxId: string }> };
    }>("reconcile_and_poll", {
      staleMinutes: 1,
      platformApiBaseUrl: platformBaseUrl,
    });

    expect(reconResult.reportBefore.laggingAcceptedOutbox.some((item) => item.outboxId === settledLag.outbox.id)).toBe(true);
    expect(reconResult.poll.updated).toBeGreaterThanOrEqual(1);
    expect(reconResult.poll.errors).toBe(0);
    expect(reconResult.reportAfter.laggingAcceptedOutbox.some((item) => item.outboxId === settledLag.outbox.id)).toBe(false);

    const lagStateAfter = await bridge.call<{
      outbox: { projection: { status: string; installationId: string | null } | null };
    }>("get_state", { outboxId: settledLag.outbox.id, operationId: lagOpId });
    expect(lagStateAfter.outbox.projection?.status).toBe("ready");
    expect(lagStateAfter.outbox.projection?.installationId).toBe(lagInstallationId);
  }, 45_000);

  it("executes live Phase 6 dual-DB dunning grace -> suspend -> invoice settlement reactivate synchronization", async () => {
    const suffix = `p6-${randomUUID().slice(0, 8)}`;

    // 1. Settle initial purchase on Bazionweb & advance Platform tenant/installation to `ready`
    const settled = await bridge.call<{
      clientId: string;
      subscriptionId: string;
      planId: string;
      outbox: { id: string; externalOrderId: string };
    }>("settle_invoice", { suffix, offerId: "website-business" });
    createdLifecycleSubscriptionIds.push(settled.subscriptionId);

    const deliverInit = await bridge.call<{ accepted: number }>("run_worker_batch", {
      platformApiBaseUrl: platformBaseUrl,
    });
    const initDeliveryState = await bridge.call<{
      outbox: { status: string; lastHttpStatus: number | null; lastErrorCode: string | null };
    }>("get_state", { outboxId: settled.outbox.id });
    expect(deliverInit.accepted, JSON.stringify({ deliverInit, outbox: initDeliveryState.outbox }))
      .toBeGreaterThanOrEqual(1);

    const stateInit = await bridge.call<{ outbox: { platformOperationId: string } }>("get_state", {
      outboxId: settled.outbox.id,
    });
    const opId = stateInit.outbox.platformOperationId;
    createdOperationIds.push(opId);

    const { tenantId, installationId } = await advanceOperationToReadyWithTenant(
      migrationPool,
      provisionerPool,
      service,
      opId,
      `e2e-${suffix}`,
    );

    const provisionCbUrl = `${bridge.baseUrl}/api/v1/webhooks/platform/provisioning-status`;
    const lifecycleCbUrl = `${bridge.baseUrl}/api/v1/webhooks/platform/lifecycle-status`;
    await dispatcher.processDueBatch({
      callbackUrl: provisionCbUrl,
      signingSecret: callbackSigningSecret,
      bearerSigningSecret: callbackBearerSecret,
      batchSize: 50,
    });

    // 2. Seed overdue renewal invoice and sweep dunning day 1 -> PAST_DUE grace period (not suspended)
    const renewal = await bridge.call<{ invoiceId: string }>("create_overdue_renewal", {
      clientId: settled.clientId,
      subscriptionId: settled.subscriptionId,
      planId: settled.planId,
      offerId: "website-business",
      dueDateIso: "2026-10-31T00:00:00.000Z",
      suffix,
    });

    const graceSweep = await bridge.call<{ gracedCount: number; suspendedCount: number }>("run_dunning_sweep", {
      nowIso: "2026-11-02T06:00:00.000Z",
    });
    expect(graceSweep.gracedCount).toBe(1);
    expect(graceSweep.suspendedCount).toBe(0);

    const lcDeliverGrace = await bridge.call<{
      claimed: number;
      accepted: number;
      retried: number;
      deadLettered: number;
    }>("deliver_lifecycle_outbox", {
      platformApiBaseUrl: platformBaseUrl,
    });
    expect(lcDeliverGrace.accepted).toBe(1);

    await lifecycleDispatcher.processDueBatch({
      callbackUrl: lifecycleCbUrl,
      signingSecret: callbackSigningSecret,
      bearerSigningSecret: callbackBearerSecret,
      batchSize: 50,
    });

    const stateAfterGrace = await bridge.call<{
      subscription: { status: string };
      projection: { status: string; subscriptionStatus: string | null } | null;
    }>("get_lifecycle_state", {
      subscriptionId: settled.subscriptionId,
      clientId: settled.clientId,
      externalOrderId: settled.outbox.externalOrderId,
    });
    expect(stateAfterGrace.subscription.status).toBe("PAST_DUE");
    expect(stateAfterGrace.projection?.subscriptionStatus).toBe("PAST_DUE");
    expect(stateAfterGrace.projection?.status).toBe("ready");

    // 3. Exhaust dunning retries + grace expiry -> SUSPENDED on both Bazionweb and Platform
    await bridge.call("run_dunning_sweep", { nowIso: "2026-11-05T06:00:00.000Z" });
    const suspendSweep = await bridge.call<{ suspendedCount: number }>("run_dunning_sweep", {
      nowIso: "2026-11-10T06:00:00.000Z",
    });
    expect(suspendSweep.suspendedCount).toBe(1);

    const lcDeliverSuspend = await bridge.call<{ accepted: number }>("deliver_lifecycle_outbox", {
      platformApiBaseUrl: platformBaseUrl,
    });
    expect(lcDeliverSuspend.accepted).toBe(1);

    await lifecycleDispatcher.processDueBatch({
      callbackUrl: lifecycleCbUrl,
      signingSecret: callbackSigningSecret,
      bearerSigningSecret: callbackBearerSecret,
      batchSize: 50,
    });

    const platformSuspended = await readTenantAndInstallationStatus(
      migrationPool,
      tenantId,
      installationId,
    );
    expect(platformSuspended?.t_status).toBe("suspended");
    expect(platformSuspended?.i_status).toBe("suspended");

    const stateAfterSuspend = await bridge.call<{
      subscription: { status: string };
      client: { status: string };
      projection: { status: string; subscriptionStatus: string | null; customerStatusMessage: string | null } | null;
    }>("get_lifecycle_state", {
      subscriptionId: settled.subscriptionId,
      clientId: settled.clientId,
      externalOrderId: settled.outbox.externalOrderId,
    });
    expect(stateAfterSuspend.subscription.status).toBe("SUSPENDED");
    expect(stateAfterSuspend.client.status).toBe("SUSPENDED");
    expect(stateAfterSuspend.projection?.status).toBe("suspended");
    expect(stateAfterSuspend.projection?.subscriptionStatus).toBe("SUSPENDED");
    expect(stateAfterSuspend.projection?.customerStatusMessage).toContain("temporarily suspended");

    // 4. Customer pays overdue invoice -> reactivates both Bazionweb & Platform without losing tenant/installation data
    await bridge.call("settle_renewal_invoice", {
      invoiceId: renewal.invoiceId,
      clientId: settled.clientId,
      subscriptionId: settled.subscriptionId,
      planId: settled.planId,
      offerId: "website-business",
      paidAtIso: "2026-11-11T09:00:00.000Z",
      suffix,
    });

    const lcDeliverReactivate = await bridge.call<{ accepted: number }>("deliver_lifecycle_outbox", {
      platformApiBaseUrl: platformBaseUrl,
    });
    expect(lcDeliverReactivate.accepted).toBe(1);

    await lifecycleDispatcher.processDueBatch({
      callbackUrl: lifecycleCbUrl,
      signingSecret: callbackSigningSecret,
      bearerSigningSecret: callbackBearerSecret,
      batchSize: 50,
    });

    const platformRestored = await readTenantAndInstallationStatus(
      migrationPool,
      tenantId,
      installationId,
    );
    expect(platformRestored?.t_status).toBe("active");
    expect(platformRestored?.i_status).toBe("ready");

    const stateRestored = await bridge.call<{
      subscription: { status: string; dunningAttemptsCount: number; gracePeriodEnd: string | null };
      client: { status: string };
      lifecycleOutboxes: Array<{ action: string; status: string }>;
      projection: { status: string; subscriptionStatus: string | null } | null;
    }>("get_lifecycle_state", {
      subscriptionId: settled.subscriptionId,
      clientId: settled.clientId,
      externalOrderId: settled.outbox.externalOrderId,
    });
    expect(stateRestored.subscription.status).toBe("ACTIVE");
    expect(stateRestored.subscription.dunningAttemptsCount).toBe(0);
    expect(stateRestored.subscription.gracePeriodEnd).toBeNull();
    expect(stateRestored.client.status).toBe("ACTIVE");
    expect(stateRestored.lifecycleOutboxes.map((r) => `${r.action}:${r.status}`)).toEqual([
      "grace:ACCEPTED",
      "suspend:ACCEPTED",
      "reactivate:ACCEPTED",
    ]);
    expect(stateRestored.projection?.subscriptionStatus).toBe("ACTIVE");
    expect(stateRestored.projection?.status).toBe("ready");

    // 5. Target-installation add-on grant, idempotent replay, base composition check, and rollback
    const changeToken = signMachineBearerToken(
      {
        subject: "bazionweb-change-dispatcher",
        issuer: DEFAULT_COMMAND_ISSUER,
        audience: DEFAULT_COMMAND_AUDIENCE,
        scopes: ["commercial:lifecycle:write"],
        ttlSeconds: 120,
      },
      commandSecret,
    );
    const expectedBaseComposition = {
      product: integrationOfferBinding.composition.product,
      solution: integrationOfferBinding.composition.solution,
      template: integrationOfferBinding.composition.template,
    };
    const grantEventId = randomUUID();
    const grantCommand = {
      schemaVersion: "1.0.0",
      eventId: grantEventId,
      correlationId: randomUUID(),
      idempotencyKey: `bazionweb:e2e-change:grant:${suffix}`,
      occurredAt: "2026-11-11T10:00:00.000Z",
      source: "bazionweb",
      target: {
        externalCustomerId: settled.clientId,
        installationId,
        tenantId,
        expectedBaseComposition,
      },
      commercial: {
        externalOrderId: settled.outbox.externalOrderId,
        orderLineId: `${settled.outbox.externalOrderId}:addon:analytics`,
        invoiceId: renewal.invoiceId,
        subscriptionId: settled.subscriptionId,
      },
      change: {
        changeType: "addon_grant",
        preservePinnedBaseComposition: true,
        enableModules: ["analytics"],
        disableModules: [],
        entitlementOverrides: {},
        rollbackOfEventId: null,
      },
    };

    const grantRes = await fetch(`${platformBaseUrl}/v1/internal/commercial/installation-changes`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${changeToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(grantCommand),
    });
    expect(grantRes.status).toBe(200);
    const grantBody = await grantRes.json() as {
      idempotentReplay: boolean;
      resultingModules: string[];
      preservedBaseComposition: unknown;
    };
    expect(grantBody.idempotentReplay).toBe(false);
    expect(grantBody.resultingModules).toContain("analytics");
    expect(grantBody.preservedBaseComposition).toEqual(expectedBaseComposition);

    const replayChangeRes = await fetch(`${platformBaseUrl}/v1/internal/commercial/installation-changes`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${changeToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(grantCommand),
    });
    expect(replayChangeRes.status).toBe(200);
    expect(((await replayChangeRes.json()) as { idempotentReplay: boolean }).idempotentReplay).toBe(true);

    const mismatchRes = await fetch(`${platformBaseUrl}/v1/internal/commercial/installation-changes`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${changeToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...grantCommand,
        eventId: randomUUID(),
        idempotencyKey: `bazionweb:e2e-change:mismatch:${suffix}`,
        target: {
          ...grantCommand.target,
          expectedBaseComposition: {
            ...expectedBaseComposition,
            product: { id: expectedBaseComposition.product.id, version: "9.9.9" },
          },
        },
      }),
    });
    expect(mismatchRes.status).toBe(409);

    const rollbackRes = await fetch(`${platformBaseUrl}/v1/internal/commercial/installation-changes`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${changeToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...grantCommand,
        eventId: randomUUID(),
        idempotencyKey: `bazionweb:e2e-change:rollback:${suffix}`,
        change: {
          changeType: "rollback",
          preservePinnedBaseComposition: true,
          enableModules: [],
          disableModules: [],
          entitlementOverrides: {},
          rollbackOfEventId: grantEventId,
        },
      }),
    });
    expect(rollbackRes.status).toBe(200);
    expect(((await rollbackRes.json()) as { resultingModules: string[] }).resultingModules).not.toContain("analytics");
  }, 45_000);
});
