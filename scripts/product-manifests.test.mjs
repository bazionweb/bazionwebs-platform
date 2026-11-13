import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test, { afterEach } from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const validatorPath = join(repoRoot, "scripts/validate-product-manifests.mjs");
const fixtures = new Set();

function writeJson(root, path, value) {
  const absolute = join(root, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(root, path, value) {
  const absolute = join(root, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, value);
}

function readJson(root, path) {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "bazion-product-manifest-test-"));
  fixtures.add(root);
  for (const path of ["products/product-manifest.schema.json", "templates/template-manifest.schema.json"]) {
    const destination = join(root, path);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(join(repoRoot, path), destination);
  }

  const modules = [
    { id: "platform-identity", dependencies: [] },
    { id: "church-ministry", dependencies: ["platform-identity", "media-storage"] },
    { id: "media-storage", dependencies: [] },
    { id: "notifications", dependencies: ["platform-identity"] },
    { id: "analytics", dependencies: ["platform-identity"] },
    { id: "commerce", dependencies: ["platform-identity"] },
  ];
  for (const module of modules) {
    writeJson(root, `modules/${module.id}/manifest.json`, {
      id: module.id,
      version: "1.0.0",
      status: "partial",
      dependencies: module.dependencies,
    });
  }
  writeJson(root, "products/catalog.json", {
    modules: modules.map(({ id }) => ({ id, classification: "module" })),
  });
  writeJson(root, "products/permissions.json", {});

  writeJson(root, "solutions/church-ministry/manifest.json", {
    id: "church-ministry",
    version: "1.0.0",
    status: "partial",
    readiness: "buildable",
    requiredModules: ["platform-identity", "church-ministry", "media-storage"],
    optionalModules: ["notifications", "analytics", "commerce"],
    templateIds: ["church-ministry"],
  });
  writeJson(root, "apps/api/package.json", { name: "@bazion/api", version: "0.1.0" });
  writeJson(root, "apps/storefront/package.json", { name: "@bazion/storefront", version: "0.1.0" });
  writeText(root, "apps/storefront/app/church-home.tsx", "export {};\n");
  writeJson(root, "templates/church-ministry/manifest.json", {
    schemaVersion: "1.0.0",
    id: "church-ministry",
    name: "Church and ministry website",
    version: "1.0.0",
    status: "partial",
    implementation: {
      packageName: "@bazion/storefront",
      entrypoint: "apps/storefront/app/church-home.tsx",
    },
    configuration: {
      schemaVersion: "1.0.0",
      sourcePath: "packages/church-ministry-contracts/src/index.ts",
      schemaNames: ["churchPublicSiteSettingsSchema", "churchSiteSettingsInputSchema"],
    },
  });
  writeText(
    root,
    "packages/church-ministry-contracts/src/index.ts",
    "export const churchPublicSiteSettingsSchema = {}; export const churchSiteSettingsInputSchema = {};\n",
  );
  writeJson(root, "products/church-ministry/manifest.json", {
    schemaVersion: "1.0.0",
    id: "church-ministry",
    name: "Church and Ministry Management",
    version: "1.0.0",
    status: "partial",
    solution: { id: "church-ministry", version: "1.0.0" },
    applications: [
      { packageName: "@bazion/api", version: "0.1.0", role: "api" },
      { packageName: "@bazion/storefront", version: "0.1.0", role: "storefront" },
    ],
    requiredModules: [
      { id: "platform-identity", version: "1.0.0" },
      { id: "church-ministry", version: "1.0.0" },
      { id: "media-storage", version: "1.0.0" },
    ],
    optionalModules: [
      { id: "notifications", version: "1.0.0" },
      { id: "analytics", version: "1.0.0" },
      { id: "commerce", version: "1.0.0" },
    ],
    templates: [{ id: "church-ministry", version: "1.0.0" }],
    configuration: {
      schemaVersion: "1.0.0",
      sourcePath: "packages/church-ministry-contracts/src/index.ts",
    },
    databaseSchemaVersion: "0015_commerce_inventory_reservation_guard.sql",
  });
  writeText(
    root,
    "packages/database/src/migration-registry.ts",
    'export const requiredDatabaseMigrations = ["0001_initial.sql", "0015_commerce_inventory_reservation_guard.sql"] as const;\n',
  );
  return root;
}

function runValidator(root) {
  return spawnSync(process.execPath, [validatorPath], { cwd: root, encoding: "utf8" });
}

afterEach(() => {
  for (const root of fixtures) {
    const relativePath = relative(tmpdir(), root);
    assert.ok(relativePath && !relativePath.startsWith("..") && !resolve(root).startsWith(`${resolve(tmpdir())}..`));
    if (existsSync(root)) rmSync(root, { recursive: true, force: true });
    fixtures.delete(root);
  }
});

test("accepts a product whose pinned dependencies match the current solution", () => {
  const root = fixture();
  const result = runValidator(root);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Product manifests valid: 1 products, 1 templates/);
});

test("accepts a reusable package as a template implementation when an application consumes it", () => {
  const root = fixture();
  const template = readJson(root, "templates/church-ministry/manifest.json");
  template.implementation.packageName = "@bazion/site-template";
  template.implementation.entrypoint = "packages/site-template/src/index.ts";
  writeJson(root, "templates/church-ministry/manifest.json", template);
  writeJson(root, "packages/site-template/package.json", { name: "@bazion/site-template", version: "1.0.0" });
  writeText(root, "packages/site-template/src/index.ts", "export {}\n");
  writeJson(root, "apps/storefront/package.json", {
    name: "@bazion/storefront",
    version: "0.1.0",
    dependencies: { "@bazion/site-template": "workspace:*" },
  });

  const result = runValidator(root);

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("requires product applications to consume package-backed templates as workspace dependencies", () => {
  const root = fixture();
  const template = readJson(root, "templates/church-ministry/manifest.json");
  template.implementation.packageName = "@bazion/site-template";
  template.implementation.entrypoint = "packages/site-template/src/index.ts";
  writeJson(root, "templates/church-ministry/manifest.json", template);
  writeJson(root, "packages/site-template/package.json", { name: "@bazion/site-template", version: "1.0.0" });
  writeText(root, "packages/site-template/src/index.ts", "export {}\n");

  const result = runValidator(root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /template package @bazion\/site-template must be a workspace dependency/);
});

test("rejects a product that pins a different module version", () => {
  const root = fixture();
  const product = readJson(root, "products/church-ministry/manifest.json");
  product.requiredModules.find((module) => module.id === "media-storage").version = "0.9.0";
  writeJson(root, "products/church-ministry/manifest.json", product);

  const result = runValidator(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /module media-storage version does not match its module manifest/);
});

test("rejects a required module when its hard dependency is not also required", () => {
  const root = fixture();
  const product = readJson(root, "products/church-ministry/manifest.json");
  product.requiredModules = product.requiredModules.filter((module) => module.id !== "media-storage");
  writeJson(root, "products/church-ministry/manifest.json", product);

  const result = runValidator(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /module church-ministry depends on media-storage, which is missing from the product composition/);
});

test("rejects a stable product when its referenced modules are still partial", () => {
  const root = fixture();
  const product = readJson(root, "products/church-ministry/manifest.json");
  product.status = "stable";
  const solution = readJson(root, "solutions/church-ministry/manifest.json");
  solution.status = "stable";
  writeJson(root, "products/church-ministry/manifest.json", product);
  writeJson(root, "solutions/church-ministry/manifest.json", solution);

  const result = runValidator(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /cannot be stable while referenced module platform-identity is partial/);
});
