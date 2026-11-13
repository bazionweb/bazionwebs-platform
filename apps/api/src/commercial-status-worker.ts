import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Pool } from "pg";
import type { PilotMode } from "@bazion/api-contracts";
import { PostgresAuditEventWriter } from "@bazion/audit";
import {
  EncryptedPrivateArchiveStorage,
  LocalPrivateArchiveStorage,
  type PrivateArchiveStorage,
} from "@bazion/storage";
import { createHostingProvisioningRuntime } from "./modules/hosting/runtime.js";
import {
  getEffectiveOfferBindingsForMode,
  resolvePilotCohortPolicy,
} from "./modules/commercial-provisioning/pilot-cutover.js";
import { platformProvisioningOfferBindings } from "./modules/commercial-provisioning/offer-resolution.js";
import { InstallationOffboardingService } from "./modules/commercial-provisioning/offboarding-service.js";
import { adaptHostingRuntime } from "./modules/commercial-provisioning/runtime.js";
import {
  PlatformLifecycleOutboxDispatcher,
  PlatformStatusOutboxDispatcher,
} from "./modules/commercial-provisioning/status-outbox-worker.js";
import {
  CommercialProvisioningSagaOrchestrator,
  createDefaultProvisioningStepAdapters,
} from "./modules/commercial-provisioning/saga-orchestrator.js";

function validateHttpCallbackUrl(rawUrl: string, errorPrefix: string): URL {
  const url = new URL(rawUrl);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error(`${errorPrefix}_INVALID`);
  }
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error(`${errorPrefix}_MUST_BE_HTTPS`);
  }
  return url;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`COMMERCIAL_STATUS_WORKER_CONFIG_MISSING_${name}`);
  return value;
}

function integer(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  const value = raw === undefined || raw.trim() === "" ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`COMMERCIAL_STATUS_WORKER_CONFIG_INVALID_${name}`);
  }
  return value;
}

const databaseUrl = new URL(required("PRODUCT_PROVISIONER_DATABASE_URL"));
if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
  throw new Error("COMMERCIAL_STATUS_WORKER_DATABASE_URL_INVALID");
}

const callbackUrl = validateHttpCallbackUrl(
  required("COMMERCIAL_PROVISIONING_CALLBACK_URL"),
  "COMMERCIAL_PROVISIONING_CALLBACK_URL",
);

const signingSecret = required("COMMERCIAL_PROVISIONING_CALLBACK_SIGNING_SECRET");
if (signingSecret.length < 32) {
  throw new Error("COMMERCIAL_PROVISIONING_CALLBACK_SIGNING_SECRET_TOO_SHORT");
}
const bearerSigningSecret = process.env.COMMERCIAL_PROVISIONING_CALLBACK_BEARER_SECRET?.trim() || undefined;
if (bearerSigningSecret && bearerSigningSecret.length < 32) {
  throw new Error("COMMERCIAL_PROVISIONING_CALLBACK_BEARER_SECRET_TOO_SHORT");
}

const batchSize = integer("COMMERCIAL_STATUS_WORKER_BATCH_SIZE", 10, 1, 50);
const idleMilliseconds = integer("COMMERCIAL_STATUS_WORKER_IDLE_MS", 5_000, 500, 60_000);
const leaseSeconds = integer("COMMERCIAL_STATUS_WORKER_LEASE_SECONDS", 120, 30, 900);
const retryBaseSeconds = integer("COMMERCIAL_STATUS_WORKER_RETRY_BASE_SECONDS", 15, 1, 3_600);
const retryMaxSeconds = integer("COMMERCIAL_STATUS_WORKER_RETRY_MAX_SECONDS", 1_800, retryBaseSeconds, 86_400);
const requestTimeoutMs = integer("COMMERCIAL_STATUS_WORKER_REQUEST_TIMEOUT_MS", 5_000, 500, 30_000);

const pool = new Pool({
  connectionString: databaseUrl.toString(),
  max: 2,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  application_name: "bazion-commercial-status-dispatcher",
});

const dispatcher = new PlatformStatusOutboxDispatcher(pool);
const lifecycleDispatcher = new PlatformLifecycleOutboxDispatcher(pool);
const lifecycleCallbackUrlRaw = process.env.COMMERCIAL_LIFECYCLE_CALLBACK_URL?.trim();
const lifecycleCallbackUrl = lifecycleCallbackUrlRaw
  ? validateHttpCallbackUrl(lifecycleCallbackUrlRaw, "COMMERCIAL_LIFECYCLE_CALLBACK_URL")
  : validateHttpCallbackUrl(
      callbackUrl.toString().replace(/\/provisioning-status\/?$/, "/lifecycle-status"),
      "COMMERCIAL_LIFECYCLE_CALLBACK_URL",
    );
const rawPilotMode = (process.env.COMMERCIAL_PROVISIONING_PILOT_MODE?.trim() || "disabled") as PilotMode;
if (!["disabled", "staging_pilot", "canary"].includes(rawPilotMode)) {
  throw new Error("COMMERCIAL_STATUS_WORKER_CONFIG_INVALID_COMMERCIAL_PROVISIONING_PILOT_MODE");
}
const pilotPolicy = resolvePilotCohortPolicy({
  pilotMode: rawPilotMode,
  nodeEnv: process.env.NODE_ENV ?? "development",
  hostingMutationsEnabled: process.env.COMMERCIAL_PROVISIONING_HOSTING_MUTATIONS_ENABLED === "true",
  legacyFallbackEnabled: process.env.COMMERCIAL_PROVISIONING_LEGACY_FALLBACK_ENABLED !== "false",
  dualReadReconciliationEnabled: process.env.COMMERCIAL_PROVISIONING_DUAL_READ_RECONCILIATION_ENABLED !== "false",
  allowedCustomerIds: [
    ...(process.env.COMMERCIAL_PROVISIONING_CANARY_CUSTOMERS?.split(",") ?? []),
    ...(process.env.COMMERCIAL_PROVISIONING_PILOT_CUSTOMERS?.split(",") ?? []),
  ]
    .map((value) => value.trim())
    .filter(Boolean),
  allowedOffers: (process.env.COMMERCIAL_PROVISIONING_ALLOWED_OFFERS?.split(",") ?? [])
    .map((value) => value.trim())
    .filter(Boolean),
});
const effectiveOfferBindings =
  pilotPolicy.pilotMode === "disabled"
    ? platformProvisioningOfferBindings
    : getEffectiveOfferBindingsForMode(
        pilotPolicy.pilotMode,
        pilotPolicy.allowedOffers,
        platformProvisioningOfferBindings,
      );

const tenantProvisionerUrl = process.env.TENANT_PROVISIONER_DATABASE_URL?.trim();
const platformPool = tenantProvisionerUrl
  ? new Pool({ connectionString: tenantProvisionerUrl, max: 2, application_name: "bazion-commercial-saga-control" })
  : undefined;

const hostingRuntime =
  pilotPolicy.hostingMutationsEnabled && process.env.HOSTING_PROVIDER === "dokploy"
    ? createHostingProvisioningRuntime({
        provider: "dokploy",
        secretDirectory: process.env.HOSTING_SECRET_DIRECTORY?.trim() || "/run/secrets",
        templateDirectory: process.env.HOSTING_TEMPLATE_DIRECTORY?.trim() || resolve(process.cwd(), "deploy/client-templates"),
        dokploy: {
          baseUrl: required("DOKPLOY_BASE_URL"),
          apiKey: required("DOKPLOY_API_KEY"),
          environmentId: required("DOKPLOY_ENVIRONMENT_ID"),
          ...(process.env.DOKPLOY_SERVER_ID?.trim() ? { serverId: process.env.DOKPLOY_SERVER_ID.trim() } : {}),
        },
      })
    : null;

const workerFlagRaw = process.env.COMMERCIAL_PROVISIONING_WORKER_ENABLED?.trim();
const legacySagaFlagRaw = process.env.COMMERCIAL_SAGA_WORKER_ENABLED?.trim();
if (legacySagaFlagRaw !== undefined && workerFlagRaw === undefined) {
  process.stderr.write(
    "[bazion-commercial-worker] COMMERCIAL_SAGA_WORKER_ENABLED is deprecated; use COMMERCIAL_PROVISIONING_WORKER_ENABLED.\n",
  );
}
const sagaWorkerEnabled = workerFlagRaw === "true" || (workerFlagRaw === undefined && legacySagaFlagRaw === "true");

const sagaOrchestrator = sagaWorkerEnabled
  ? new CommercialProvisioningSagaOrchestrator(
      pool,
      createDefaultProvisioningStepAdapters({
        provisionerPool: pool,
        ...(platformPool ? { platformPool } : {}),
        ...(hostingRuntime ? { hostingRuntime: adaptHostingRuntime(hostingRuntime, pool, platformPool) } : {}),
        offerBindings: effectiveOfferBindings,
      }),
      {
        offerBindings: effectiveOfferBindings,
        leaseDurationMs: leaseSeconds * 1_000,
      },
    )
  : null;

const privateArchiveDir = process.env.PRIVATE_ARCHIVE_DIR?.trim();
const privateArchiveEncryptionKey = process.env.PRIVATE_ARCHIVE_ENCRYPTION_KEY?.trim();
const retentionPurgeIntervalMs = integer("COMMERCIAL_ARCHIVE_RETENTION_INTERVAL_SECONDS", 900, 60, 86_400) * 1_000;
let retentionService: InstallationOffboardingService | null = null;
if (
  (process.env.NODE_ENV !== "production" || (privateArchiveDir && privateArchiveEncryptionKey))
  && (privateArchiveDir || process.env.COMMERCIAL_ARCHIVE_RETENTION_WORKER_ENABLED === "true")
) {
  const baseStorage: PrivateArchiveStorage = new LocalPrivateArchiveStorage(
    privateArchiveDir ?? resolve(tmpdir(), "bazion-private-archives"),
  );
  const archiveStorage: PrivateArchiveStorage = privateArchiveEncryptionKey
    ? new EncryptedPrivateArchiveStorage(baseStorage, privateArchiveEncryptionKey)
    : baseStorage;
  retentionService = new InstallationOffboardingService(
    pool,
    archiveStorage,
    new PostgresAuditEventWriter(platformPool ?? pool),
  );
}
let nextRetentionRunAtMs = 0;

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
    process.stdout.write(`[bazion-commercial-status-dispatcher] ${signal} received; draining batch\n`);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  while (!stopping) {
    try {
      let claimedTotal = 0;
      if (sagaOrchestrator) {
        const sagaOutcomes = await sagaOrchestrator.processDueOperations(batchSize);
        if (sagaOutcomes.length > 0) {
          claimedTotal += sagaOutcomes.length;
          process.stdout.write(`[bazion-commercial-saga-worker] processed=${sagaOutcomes.length}\n`);
        }
      }
      const summary = await dispatcher.processDueBatch({
        callbackUrl: callbackUrl.toString(),
        signingSecret,
        bearerSigningSecret,
        batchSize,
        leaseSeconds,
        retryBaseSeconds,
        retryMaxSeconds,
        requestTimeoutMs,
      });
      claimedTotal += summary.claimed;
      if (summary.claimed > 0) {
        process.stdout.write(
          `[bazion-commercial-status-dispatcher] claimed=${summary.claimed} delivered=${summary.delivered} retried=${summary.retried} dead=${summary.deadLettered}\n`,
        );
      }
      const lifecycleSummary = await lifecycleDispatcher.processDueBatch({
        callbackUrl: lifecycleCallbackUrl.toString(),
        signingSecret,
        bearerSigningSecret,
        batchSize,
        leaseSeconds,
        retryBaseSeconds,
        retryMaxSeconds,
        requestTimeoutMs,
      });
      claimedTotal += lifecycleSummary.claimed;
      if (lifecycleSummary.claimed > 0) {
        process.stdout.write(
          `[bazion-commercial-lifecycle-dispatcher] claimed=${lifecycleSummary.claimed} delivered=${lifecycleSummary.delivered} retried=${lifecycleSummary.retried} dead=${lifecycleSummary.deadLettered}\n`,
        );
      }
      if (retentionService && Date.now() >= nextRetentionRunAtMs) {
        nextRetentionRunAtMs = Date.now() + retentionPurgeIntervalMs;
        const retentionSummary = await retentionService.purgeDueArchivesAcrossTenants();
        if (retentionSummary.archivesDeleted > 0 || retentionSummary.configurationsDeleted > 0) {
          process.stdout.write(
            `[bazion-commercial-retention] tenants=${retentionSummary.tenantsScanned} archivesDeleted=${retentionSummary.archivesDeleted} configsRemoved=${retentionSummary.configurationsDeleted}\n`,
          );
        }
      }
      if (claimedTotal < batchSize && !stopping) {
        await sleep(idleMilliseconds);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
      process.stderr.write(`[bazion-commercial-status-dispatcher] cycle failed: ${message}\n`);
      if (!stopping) await sleep(idleMilliseconds);
    }
  }
  await Promise.all([pool.end(), platformPool?.end()]);
}

void run();
