import { spawnSync } from "node:child_process";

const betterAuthVersion = "1.7.17";
const migrationUrl = process.env.AUTH_MIGRATION_DATABASE_URL;
if (!migrationUrl) {
  throw new Error("AUTH_MIGRATION_DATABASE_URL is required. Never run Better Auth migrations with a runtime database role.");
}

// The Better Auth core npm release currently leads its separate CLI package.
// Require an exact CLI/library version match instead of quietly applying an
// older schema and hoping it is compatible.
const registryCheck = spawnSync(
  "npm",
  ["view", `auth@${betterAuthVersion}`, "version"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
);
if (registryCheck.status !== 0 || registryCheck.stdout.trim() !== betterAuthVersion) {
  throw new Error(
    `The matching Better Auth CLI auth@${betterAuthVersion} is not available in the npm registry yet. ` +
    "Do not run an older CLI against a newer Better Auth runtime. Retry this command once the matching CLI release is published.",
  );
}

const isWindows = process.platform === "win32";
const command = isWindows ? "pnpm.cmd" : "pnpm";
const result = spawnSync(
  command,
  ["dlx", `auth@${betterAuthVersion}`, "migrate", "--yes", "--config", "./src/server.ts"],
  {
    cwd: process.cwd(),
    env: { ...process.env, AUTH_DATABASE_URL: migrationUrl },
    stdio: "inherit",
    shell: isWindows,
  },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
