import { Pool } from "pg";
import { PlatformStatusOutboxDispatcher } from "./modules/commercial-provisioning/status-outbox-worker.js";

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

const callbackUrl = new URL(required("COMMERCIAL_PROVISIONING_CALLBACK_URL"));
if (!["https:", "http:"].includes(callbackUrl.protocol) || callbackUrl.username || callbackUrl.password || callbackUrl.search || callbackUrl.hash) {
  throw new Error("COMMERCIAL_PROVISIONING_CALLBACK_URL_INVALID");
}
if (process.env.NODE_ENV === "production" && callbackUrl.protocol !== "https:") {
  throw new Error("COMMERCIAL_PROVISIONING_CALLBACK_URL_MUST_BE_HTTPS");
}

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
      if (summary.claimed > 0) {
        process.stdout.write(
          `[bazion-commercial-status-dispatcher] claimed=${summary.claimed} delivered=${summary.delivered} retried=${summary.retried} dead=${summary.deadLettered}\n`,
        );
      }
      if (summary.claimed < batchSize && !stopping) {
        await sleep(idleMilliseconds);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
      process.stderr.write(`[bazion-commercial-status-dispatcher] cycle failed: ${message}\n`);
      if (!stopping) await sleep(idleMilliseconds);
    }
  }
  await pool.end();
}

void run();
