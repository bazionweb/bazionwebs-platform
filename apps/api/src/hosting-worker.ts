import { Pool } from "pg";
import {
  DokployComposeProvider,
  type DokployConfig,
} from "@bazion/deployment-dokploy";
import type { TenantHostingProvider } from "@bazion/platform-contracts";
import {
  PostgresHostingReconciliationStore,
  TenantHostingDeploymentReconciler,
} from "./modules/hosting/reconciler.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`HOSTING_RECONCILER_CONFIG_MISSING_${name}`);
  return value;
}

function integer(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  const value = raw === undefined || raw.trim() === "" ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`HOSTING_RECONCILER_CONFIG_INVALID_${name}`);
  }
  return value;
}

if (required("HOSTING_PROVIDER") !== "dokploy") {
  throw new Error("HOSTING_RECONCILER_REQUIRES_DOKPLOY_PROVIDER");
}

const databaseUrl = new URL(required("HOSTING_RECONCILER_DATABASE_URL"));
if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
  throw new Error("HOSTING_RECONCILER_DATABASE_URL_INVALID");
}

const baseUrl = new URL(required("DOKPLOY_BASE_URL"));
if (baseUrl.protocol !== "https:" || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
  throw new Error("DOKPLOY_BASE_URL_INVALID");
}

const dokployConfig: DokployConfig = {
  baseUrl: baseUrl.toString(),
  apiKey: required("DOKPLOY_API_KEY"),
  environmentId: required("DOKPLOY_ENVIRONMENT_ID"),
  ...(process.env.DOKPLOY_SERVER_ID?.trim() ? { serverId: process.env.DOKPLOY_SERVER_ID.trim() } : {}),
};

const batchSize = integer("HOSTING_RECONCILER_BATCH_SIZE", 5, 1, 20);
const idleMilliseconds = integer("HOSTING_RECONCILER_IDLE_MS", 15_000, 1_000, 60_000);
const leaseSeconds = integer("HOSTING_RECONCILER_LEASE_SECONDS", 180, 60, 900);
const intervalSeconds = integer("HOSTING_RECONCILER_INTERVAL_SECONDS", 60, 10, 3_600);
const retryBaseSeconds = integer("HOSTING_RECONCILER_RETRY_BASE_SECONDS", 30, 5, 3_600);
const retryMaxSeconds = integer("HOSTING_RECONCILER_RETRY_MAX_SECONDS", 1_800, retryBaseSeconds, 86_400);

const pool = new Pool({
  connectionString: databaseUrl.toString(),
  max: 2,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  application_name: "bazion-hosting-reconciler",
});

// The reconciler is deliberately given an inspect-only facade. Even if a future
// code path is added by mistake, this worker cannot create, deploy, start,
// stop, redeploy, or delete Dokploy resources.
const dokploy = new DokployComposeProvider(dokployConfig, {
  async resolveEnvironment() {
    throw new Error("HOSTING_RECONCILER_SECRET_ACCESS_DISABLED");
  },
});
const inspectOnlyProvider: TenantHostingProvider = {
  async provision() { throw new Error("HOSTING_RECONCILER_INSPECT_ONLY"); },
  async deploy() { throw new Error("HOSTING_RECONCILER_INSPECT_ONLY"); },
  async start() { throw new Error("HOSTING_RECONCILER_INSPECT_ONLY"); },
  inspect: (reference) => dokploy.inspect(reference),
  async stop() { throw new Error("HOSTING_RECONCILER_INSPECT_ONLY"); },
  async redeploy() { throw new Error("HOSTING_RECONCILER_INSPECT_ONLY"); },
  async remove() { throw new Error("HOSTING_RECONCILER_INSPECT_ONLY"); },
};

const reconciler = new TenantHostingDeploymentReconciler(
  new PostgresHostingReconciliationStore(pool),
  inspectOnlyProvider,
  {
    providerId: "dokploy",
    batchSize,
    leaseSeconds,
    intervalSeconds,
    retryBaseSeconds,
    retryMaxSeconds,
  },
);

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
    process.stdout.write(`[bazion-hosting-reconciler] ${signal} received; finishing current batch\n`);
  });
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main(): Promise<void> {
  await pool.query("SELECT 1");
  process.stdout.write("[bazion-hosting-reconciler] connected; polling Dokploy deployment state\n");
  while (!stopping) {
    const result = await reconciler.runBatch();
    if (result.claimed > 0) {
      process.stdout.write(
        `[bazion-hosting-reconciler] claimed=${result.claimed} inspected=${result.inspected} changed=${result.changed} failed=${result.failed} leaseLost=${result.leaseLost}\n`,
      );
    }
    if (result.claimed < batchSize) await sleep(idleMilliseconds);
  }
}

try {
  await main();
} catch (error) {
  process.stderr.write(`[bazion-hosting-reconciler] fatal ${error instanceof Error ? error.name : "UnknownError"}\n`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
