import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const validator = join(repoRoot, "scripts/validate-template-manifests.mjs");

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "bazion-template-validation-"));
  const write = (path, content) => {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  };
  write("templates/template-manifest.schema.json", readFileSync(join(repoRoot, "templates/template-manifest.schema.json"), "utf8"));
  write("apps/storefront/package.json", JSON.stringify({ name: "@bazion/storefront" }));
  write("apps/storefront/src/template.ts", "export const settingsSchema = {};\n");
  write("packages/config/src/index.ts", "export const publicSettingsSchema = {};\n");
  write("templates/sample/manifest.json", JSON.stringify({
    schemaVersion: "1.0.0",
    id: "sample",
    name: "Sample template",
    version: "1.0.0",
    status: "experimental",
    implementation: { packageName: "@bazion/storefront", entrypoint: "apps/storefront/src/template.ts" },
    configuration: { schemaVersion: "1.0.0", sourcePath: "packages/config/src/index.ts", schemaNames: ["publicSettingsSchema"] }
  }));
  return root;
}

function run(root) {
  return spawnSync(process.execPath, [validator], { cwd: root, encoding: "utf8" });
}

test("accepts a manifest whose package, entrypoint and config schemas resolve", () => {
  const root = fixture();
  try {
    const result = run(root);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("rejects path traversal in template entrypoints", () => {
  const root = fixture();
  try {
    const path = join(root, "templates/sample/manifest.json");
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    manifest.implementation.entrypoint = "apps/storefront/../../outside.ts";
    writeFileSync(path, JSON.stringify(manifest));
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /safe repository-relative path/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("rejects a configuration schema name not exported by its declared source", () => {
  const root = fixture();
  try {
    const path = join(root, "templates/sample/manifest.json");
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    manifest.configuration.schemaNames = ["missingSchema"];
    writeFileSync(path, JSON.stringify(manifest));
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /is not present/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
