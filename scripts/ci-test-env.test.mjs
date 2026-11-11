import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requiredIntegrationVariables = ["TENANT_ISOLATION_TEST_DATABASE_URL", "PRODUCT_PROVISIONER_DATABASE_URL", "AUTH_INTEGRATION_TESTS"];

test("Turbo forwards database and auth integration-test activation variables", () => {
  const turbo = JSON.parse(readFileSync(join(repoRoot, "turbo.json"), "utf8"));
  const workflow = readFileSync(join(repoRoot, ".github/workflows/ci.yml"), "utf8");

  assert.equal(turbo.tasks.test.cache, false, "Database-backed tests must not replay cached results.");
  for (const variable of requiredIntegrationVariables) {
    assert.ok(turbo.globalPassThroughEnv.includes(variable), `Turbo must pass through ${variable}.`);
    assert.match(workflow, new RegExp(`^\\s*${variable}:`, "m"), `CI must set ${variable}.`);
  }
});
