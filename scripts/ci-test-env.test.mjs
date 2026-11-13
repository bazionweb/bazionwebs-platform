import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requiredIntegrationVariables = [
  "TENANT_ISOLATION_TEST_DATABASE_URL",
  "PRODUCT_PROVISIONER_DATABASE_URL",
  "AUTH_INTEGRATION_TESTS",
  "BAZIONWEB_TEST_DATABASE_URL",
  "BAZIONWEB_API_DIR",
];

test("Turbo forwards database and auth integration-test activation variables", () => {
  const turbo = JSON.parse(readFileSync(join(repoRoot, "turbo.json"), "utf8"));
  const workflow = readFileSync(join(repoRoot, ".github/workflows/ci.yml"), "utf8");

  assert.equal(turbo.tasks.test.cache, false, "Database-backed tests must not replay cached results.");
  for (const variable of requiredIntegrationVariables) {
    assert.ok(turbo.globalPassThroughEnv.includes(variable), `Turbo must pass through ${variable}.`);
    assert.match(workflow, new RegExp(`^\\s*${variable}:`, "m"), `CI must set ${variable}.`);
  }
});

test("Lockfile preserves packageManagerDependencies matching package.json and CI pnpm version", () => {
  const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
  const workflow = readFileSync(join(repoRoot, ".github/workflows/ci.yml"), "utf8");
  const lockfileHead = readFileSync(join(repoRoot, "pnpm-lock.yaml"), "utf8").slice(0, 1200);

  const match = /^pnpm@(\d+\.\d+\.\d+)$/.exec(pkg.packageManager ?? "");
  assert.ok(match, `package.json packageManager must pin an exact pnpm version, got: ${pkg.packageManager}`);
  const expectedPnpmVersion = match[1];

  assert.match(
    workflow,
    new RegExp(`version:\\s*${expectedPnpmVersion.replaceAll(".", "\\.")}\\b`),
    `CI pnpm/action-setup must use pnpm ${expectedPnpmVersion}.`,
  );
  assert.match(
    lockfileHead,
    new RegExp(
      `packageManagerDependencies:\\s*\\r?\\n\\s*pnpm:\\s*\\r?\\n\\s*specifier:\\s*${expectedPnpmVersion.replaceAll(".", "\\.")}\\r?\\n\\s*version:\\s*${expectedPnpmVersion.replaceAll(".", "\\.")}\\b`,
    ),
    `pnpm-lock.yaml must include packageManagerDependencies for pnpm@${expectedPnpmVersion} (run corepack pnpm install --lockfile-only, not pnpm 9).`,
  );
});

test("CI configures job-level cross-repo env, sibling checkout, contract parity, and unconditional joint E2E step", () => {
  const workflow = readFileSync(join(repoRoot, ".github/workflows/ci.yml"), "utf8");
  assert.match(workflow, /path:\s*\.bazionweb\b/, "CI must check out sibling bazionweb repo into .bazionweb.");
  assert.match(workflow, /pnpm contracts:verify-cross-repo/, "CI must run cross-repo contract parity verification.");
  assert.match(
    workflow,
    /Run joint cross-repo commercial-platform PostgreSQL E2E suite\r?\n\s+run: pnpm --filter @bazion\/api exec vitest run src\/modules\/commercial-provisioning\/cross-repo-e2e\.integration\.test\.ts/,
    "Joint cross-repo E2E step must run unconditionally with job-level env vars (no self-referential step if).",
  );
});
