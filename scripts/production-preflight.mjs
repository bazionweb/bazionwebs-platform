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
  process.stdout.write("\nProduction environment, database and SMTP preflight passed. This does not replace a real payment-provider implementation or a staged worker-interruption recovery test.\n");
}
