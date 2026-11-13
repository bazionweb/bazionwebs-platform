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

test("CI requires isolated joint E2E execution and a repository-scoped GitHub App token", () => {
  const workflow = readFileSync(join(repoRoot, ".github/workflows/ci.yml"), "utf8");
  const apiPackage = JSON.parse(readFileSync(join(repoRoot, "apps/api/package.json"), "utf8"));
  assert.match(workflow, /path:\s*\.bazionweb\b/, "CI must check out sibling bazionweb repo into .bazionweb.");
  assert.match(
    workflow,
    /name: Validate sibling Bazionweb repository and GitHub App credentials\r?\n\s+id: bazionweb-repo[\s\S]*?BAZIONWEB_APP_CLIENT_ID:\s*\$\{\{\s*vars\.BAZIONWEB_APP_CLIENT_ID\s*\}\}[\s\S]*?BAZIONWEB_APP_PRIVATE_KEY:\s*\$\{\{\s*secrets\.BAZIONWEB_APP_PRIVATE_KEY\s*\}\}[\s\S]*?if \[ -z "\$BAZIONWEB_APP_CLIENT_ID" \] \|\| \[ -z "\$BAZIONWEB_APP_PRIVATE_KEY" \]/,
    "CI must fail early with a clear error when GitHub App credentials are missing.",
  );
  assert.match(
    workflow,
    /name: Create read-only token for the Bazionweb repository\r?\n\s+id: bazionweb-app-token\r?\n\s+uses: actions\/create-github-app-token@64ab729a6294000f5aa4a4bc0b73d1f32bc45510 # v3\.3\.0[\s\S]*?client-id: \$\{\{ vars\.BAZIONWEB_APP_CLIENT_ID \}\}[\s\S]*?private-key: \$\{\{ secrets\.BAZIONWEB_APP_PRIVATE_KEY \}\}[\s\S]*?owner: \$\{\{ steps\.bazionweb-repo\.outputs\.owner \}\}[\s\S]*?repositories: \$\{\{ steps\.bazionweb-repo\.outputs\.name \}\}[\s\S]*?permission-contents: read/,
    "CI must use the pinned token-action release to create a contents-read token scoped to the configured Bazionweb repository.",
  );
  assert.doesNotMatch(
    workflow,
    /BAZIONWEB_REPO_TOKEN|token:\s*\$\{\{\s*(?:secrets\.[^}]*TOKEN|github\.token)/,
    "The sibling checkout must not use a PAT or fall back to the Platform repository token.",
  );
  assert.match(
    workflow,
    /repository: \$\{\{ env\.BAZIONWEB_REPO \}\}[\s\S]*?token: \$\{\{ steps\.bazionweb-app-token\.outputs\.token \}\}[\s\S]*?persist-credentials: false/,
    "The sibling checkout must use the short-lived App token without persisting credentials.",
  );
  assert.match(workflow, /pnpm contracts:verify-cross-repo/, "CI must run cross-repo contract parity verification.");
  assert.match(
    workflow,
    /BAZIONWEB_TEST_DATABASE_URL:\s*postgresql:\/\/bazionweb:testpassword@127\.0\.0\.1:5433\/bazionweb_test/,
    "CI must use the isolated local Bazionweb test database, never a supplied external URL.",
  );
  assert.doesNotMatch(
    workflow,
    /BAZIONWEB_TEST_DATABASE_URL:\s*\$\{\{\s*secrets\./,
    "CI must not run Prisma migrations against a secret-supplied database URL.",
  );
  assert.match(
    apiPackage.scripts.test,
    /--exclude\s+src\/modules\/commercial-provisioning\/cross-repo-e2e\.integration\.test\.ts/,
    "The joint E2E suite must not run as part of the broad API test suite.",
  );
  assert.match(
    apiPackage.scripts["test:cross-repo"],
    /vitest\.mjs run src\/modules\/commercial-provisioning\/cross-repo-e2e\.integration\.test\.ts/,
    "The joint E2E suite must have one dedicated command.",
  );
  assert.match(
    workflow,
    /Run joint cross-repo commercial-platform PostgreSQL E2E suite\r?\n\s+env:\r?\n\s+REQUIRE_CROSS_REPO_E2E:\s*["']true["']\r?\n\s+run: pnpm --filter @bazion\/api test:cross-repo/,
    "Joint cross-repo E2E must run once as a required, dedicated step.",
  );
});
