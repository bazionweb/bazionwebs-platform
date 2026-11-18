import { spawnSync } from "node:child_process";

const packageManager = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const checks = [
  {
    label: "Production environment, PostgreSQL migrations and role grants",
    args: ["--filter", "@bazion/database", "preflight"],
  },
  {
    label: "Production SMTP connectivity, authentication and TLS",
    args: ["--filter", "@bazion/notifications", "preflight:smtp"],
  },
];

let failed = false;

function isLoopbackHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost"
    || normalized.endsWith(".localhost")
    || normalized === "::1"
    || normalized === "::"
    || normalized === "0.0.0.0"
    || /^127(?:\.\d{1,3}){3}$/.test(normalized);
}

const storefrontApiBaseUrl = process.env.API_BASE_URL?.trim();
if (!storefrontApiBaseUrl) {
  process.stderr.write("BLOCKER: API_BASE_URL must be set on the storefront runtime for server-side tenant and admin requests.\n");
  failed = true;
} else {
  try {
    const apiUrl = new URL(storefrontApiBaseUrl);
    if (!(["http:", "https:"].includes(apiUrl.protocol)) || apiUrl.pathname !== "/" || apiUrl.username || apiUrl.password || apiUrl.search || apiUrl.hash) {
      process.stderr.write("BLOCKER: API_BASE_URL must be an HTTP(S) origin without credentials, path, query, or fragment.\n");
      failed = true;
    }
    if (isLoopbackHostname(apiUrl.hostname)) {
      process.stderr.write("BLOCKER: API_BASE_URL cannot point to loopback from a production storefront container.\n");
      failed = true;
    }
  } catch {
    process.stderr.write("BLOCKER: API_BASE_URL must be a valid absolute HTTP(S) origin.\n");
    failed = true;
  }
}

for (const check of checks) {
  process.stdout.write(`\n=== ${check.label} ===\n`);
  const result = spawnSync(packageManager, check.args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  if (result.error) {
    process.stderr.write(`Could not run preflight command: ${result.error.message}\n`);
    failed = true;
  } else if (result.status !== 0) {
    failed = true;
  }
}

if (failed) {
  process.stderr.write("\nProduction preflight is BLOCKED. Correct every reported issue before enabling production traffic.\n");
  process.exitCode = 1;
} else {
  process.stdout.write("\nProduction environment, database and SMTP preflight passed. This does not replace a staged Daraja checkout/callback validation, a worker-interruption recovery test or a backup restore exercise.\n");
}
