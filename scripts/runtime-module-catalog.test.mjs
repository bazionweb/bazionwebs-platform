import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test, { afterEach } from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const generatorPath = join(repoRoot, "scripts/generate-runtime-module-catalog.mjs");
const fixtures = new Set();

function writeJson(root, path, value) {
  const absolute = join(root, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "bazion-runtime-catalog-test-"));
  fixtures.add(root);
  const policySchemaPath = join(root, "products/runtime-module-policy.schema.json");
  mkdirSync(dirname(policySchemaPath), { recursive: true });
  writeFileSync(policySchemaPath, readFileSync(join(repoRoot, "products/runtime-module-policy.schema.json"), "utf8"));

  const modules = [
    {
      id: "platform-identity",
      name: "Identity from module manifest",
      version: "1.2.3",
      status: "partial",
      tenantModel: "mixed",
      catalogStatus: "partial",
      policy: {
        id: "platform-identity",
        displayName: "Identity runtime label",
        description: "Required identity runtime.",
        defaultEnabled: true,
        required: true,
        tenantAssignable: false,
        entitlementDependencies: [],
      },
    },
    {
      id: "sample-module",
      name: "Sample from module manifest",
      version: "2.3.4",
      status: "partial",
      tenantModel: "tenant-owned",
      catalogStatus: "partial",
      policy: {
        id: "sample-module",
        displayName: "Sample runtime label",
        description: "Optional tenant feature.",
        defaultEnabled: false,
        required: false,
        tenantAssignable: true,
        entitlementDependencies: ["platform-identity"],
      },
    },
  ];
  for (const module of modules) {
    writeJson(root, `modules/${module.id}/manifest.json`, {
      id: module.id,
      name: module.name,
      version: module.version,
      status: module.status,
      tenantModel: module.tenantModel,
    });
  }
  writeJson(root, "products/catalog.json", {
    modules: modules.map((module) => ({ id: module.id, classification: "module", status: module.catalogStatus })),
  });
  writeJson(root, "products/runtime-module-policy.json", {
    schemaVersion: "1.0.0",
    modules: modules.map((module) => module.policy),
  });
  mkdirSync(join(root, "apps/api/src/modules/admin"), { recursive: true });
  return root;
}

function runGenerator(root, ...args) {
  return spawnSync(process.execPath, [generatorPath, ...args], { cwd: root, encoding: "utf8" });
}

afterEach(() => {
  for (const root of fixtures) {
    const relativePath = relative(tmpdir(), root);
    assert.ok(relativePath && !relativePath.startsWith(".."));
    if (existsSync(root)) rmSync(root, { recursive: true, force: true });
    fixtures.delete(root);
  }
});

test("generates runtime facts from manifests and runtime-only entitlement policy", () => {
  const root = fixture();
  const result = runGenerator(root);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const output = readFileSync(join(root, "apps/api/src/modules/admin/module-catalog.ts"), "utf8");
  assert.match(output, /"name": "Identity runtime label"/);
  assert.match(output, /"version": "1\.2\.3"/);
  assert.match(output, /"dependencies": \[\s*"platform-identity"\s*\]/);
  assert.match(output, /"defaultEnabled": false/);
  assert.equal(runGenerator(root, "--check").status, 0);
});

test("check mode rejects a stale generated runtime catalogue", () => {
  const root = fixture();
  assert.equal(runGenerator(root).status, 0);
  const outputPath = join(root, "apps/api/src/modules/admin/module-catalog.ts");
  writeFileSync(outputPath, `${readFileSync(outputPath, "utf8")}\n// stale edit\n`);

  const result = runGenerator(root, "--check");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /is stale; run pnpm modules:generate/);
});

test("rejects unresolved runtime entitlement dependencies", () => {
  const root = fixture();
  const policy = JSON.parse(readFileSync(join(root, "products/runtime-module-policy.json"), "utf8"));
  policy.modules[1].entitlementDependencies = ["missing-module"];
  writeJson(root, "products/runtime-module-policy.json", policy);

  const result = runGenerator(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown entitlement dependency missing-module/);
});
