import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import test, { afterEach } from "node:test";
import { packageExportTargetResolves } from "./lib/package-exports.mjs";

const fixtures = new Set();

function fixture() {
  const path = mkdtempSync(join(tmpdir(), "bazion-package-export-test-"));
  fixtures.add(path);
  return path;
}

function writeFile(root, path, contents) {
  const absolute = join(root, path);
  mkdirSync(resolve(absolute, ".."), { recursive: true });
  writeFileSync(absolute, contents);
}

afterEach(() => {
  for (const path of fixtures) {
    const relativePath = relative(tmpdir(), path);
    assert.ok(relativePath && !relativePath.startsWith(".."));
    if (existsSync(path)) rmSync(path, { recursive: true, force: true });
    fixtures.delete(path);
  }
});

test("accepts an export target that exists in the repository", () => {
  const root = fixture();
  writeFile(root, "dist/index.js", "export {};\n");

  assert.equal(packageExportTargetResolves(root, "./dist/index.js"), true);
});

test("accepts generated JavaScript and declaration exports backed by TypeScript source", () => {
  const root = fixture();
  writeFile(root, "tsconfig.json", JSON.stringify({ compilerOptions: { rootDir: "src", outDir: "dist" } }));
  writeFile(root, "src/index.ts", "export const value = true;\n");

  assert.equal(packageExportTargetResolves(root, "./dist/index.js"), true);
  assert.equal(packageExportTargetResolves(root, "./dist/index.d.ts"), true);
  assert.equal(existsSync(join(root, "dist/index.js")), false);
});

test("rejects generated exports without a matching source file or build mapping", () => {
  const root = fixture();
  writeFile(root, "tsconfig.json", JSON.stringify({ compilerOptions: { rootDir: "src", outDir: "dist" } }));
  writeFile(root, "src/index.ts", "export {};\n");

  assert.equal(packageExportTargetResolves(root, "./dist/missing.js"), false);
  assert.equal(packageExportTargetResolves(root, "./build/index.js"), false);
});

test("rejects absolute and parent-traversing package export targets", () => {
  const root = fixture();
  writeFile(root, "outside.js", "export {};\n");

  assert.equal(packageExportTargetResolves(root, "../outside.js"), false);
  assert.equal(packageExportTargetResolves(root, "./../../outside.js"), false);
  assert.equal(packageExportTargetResolves(root, resolve(root, "outside.js")), false);
});
