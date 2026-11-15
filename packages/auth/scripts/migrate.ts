import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const migrationUrl = process.env.AUTH_MIGRATION_DATABASE_URL;
if (!migrationUrl) {
  throw new Error("AUTH_MIGRATION_DATABASE_URL is required. Never run Better Auth migrations with a runtime database role.");
}

const isWindows = process.platform === "win32";
const command = isWindows ? "pnpm.cmd" : "pnpm";
const result = spawnSync(
  command,
  ["exec", "auth", "migrate", "--yes", "--config", "./src/server.ts"],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AUTH_DATABASE_URL: migrationUrl,
      // The CLI imports the application auth configuration to discover its
      // plugins/schema. Keep that import isolated from runtime credentials and
      // make every pool point at the same migration-only database role. Hooks
      // are registered during schema discovery; the CLI does not serve requests
      // or invoke those hooks.
      TENANT_RESOLVER_DATABASE_URL: migrationUrl,
      TENANT_PROVISIONER_DATABASE_URL: migrationUrl,
      NOTIFICATION_ENQUEUER_DATABASE_URL: migrationUrl,
      NOTIFICATION_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
      BETTER_AUTH_URL: "http://localhost:4000",
      BETTER_AUTH_SECRET: randomBytes(32).toString("base64"),
    },
    stdio: "inherit",
    shell: isWindows,
  },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
