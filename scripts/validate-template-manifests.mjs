import { existsSync, realpathSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { assertSupportedSchema, validateJsonSchema } from "./lib/json-schema.mjs";

const root = realpathSync(process.cwd());
const fail = (message) => {
  console.error(`[template-validation] ${message}`);
  process.exitCode = 1;
};
const readJson = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const schema = readJson("templates/template-manifest.schema.json");
assertSupportedSchema(schema, "templates/template-manifest.schema.json");

function safeFile(path, label) {
  if (typeof path !== "string" || !path || path.includes("\\") || path.includes("\0") ||
      path.startsWith("/") || /^[a-zA-Z]:/.test(path) || path.split("/").includes("..")) {
    fail(`${label} must be a safe repository-relative path: ${String(path)}`);
    return null;
  }
  const absolute = resolve(root, path);
  if (!absolute.startsWith(root + sep) || !existsSync(absolute)) {
    fail(`${label} does not exist inside the repository: ${path}`);
    return null;
  }
  let actual;
  try { actual = realpathSync(absolute); } catch {
    fail(`${label} cannot be resolved: ${path}`);
    return null;
  }
  if (!actual.startsWith(root + sep)) {
    fail(`${label} resolves outside the repository: ${path}`);
    return null;
  }
  return actual;
}

const templateRoot = join(root, "templates");
const directories = readdirSync(templateRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
const seenIds = new Set();
const workspacePackages = new Map();
for (const workspaceRoot of ["apps", "packages"]) {
  const absoluteRoot = join(root, workspaceRoot);
  if (!existsSync(absoluteRoot)) continue;
  for (const entry of readdirSync(absoluteRoot, { withFileTypes: true }).filter((item) => item.isDirectory())) {
    const packageRoot = `${workspaceRoot}/${entry.name}`;
    const packageFile = join(root, packageRoot, "package.json");
    if (!existsSync(packageFile)) continue;
    try {
      const manifest = JSON.parse(readFileSync(packageFile, "utf8"));
      if (typeof manifest.name === "string") workspacePackages.set(manifest.name, packageRoot);
    } catch {
      fail(`Invalid package manifest: ${packageRoot}/package.json`);
    }
  }
}

for (const directory of directories) {
  const manifestPath = `templates/${directory.name}/manifest.json`;
  if (!existsSync(join(root, manifestPath))) {
    fail(`Missing template manifest: ${manifestPath}`);
    continue;
  }
  let manifest;
  try { manifest = readJson(manifestPath); } catch {
    fail(`Invalid JSON: ${manifestPath}`);
    continue;
  }
  const errors = validateJsonSchema(manifest, schema);
  for (const error of errors) fail(`${manifestPath}: ${error}`);
  if (errors.length) continue;
  if (manifest.id !== directory.name) fail(`${manifestPath}: id must match its directory name.`);
  if (seenIds.has(manifest.id)) fail(`${manifestPath}: duplicate template id ${manifest.id}.`);
  seenIds.add(manifest.id);

  const packageRoot = workspacePackages.get(manifest.implementation.packageName);
  if (!packageRoot) {
    fail(`${manifestPath}: implementation package ${manifest.implementation.packageName} is not a workspace package.`);
    continue;
  }
  const entrypoint = safeFile(manifest.implementation.entrypoint, `${manifestPath} implementation.entrypoint`);
  if (entrypoint && !entrypoint.startsWith(resolve(root, packageRoot) + sep)) {
    fail(`${manifestPath}: implementation.entrypoint must be inside ${packageRoot}.`);
  }
  const sourcePath = safeFile(manifest.configuration.sourcePath, `${manifestPath} configuration.sourcePath`);
  if (sourcePath) {
    const source = readFileSync(sourcePath, "utf8");
    for (const schemaName of manifest.configuration.schemaNames) {
      const escaped = schemaName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!new RegExp(`\\b${escaped}\\b`).test(source)) {
        fail(`${manifestPath}: configuration schema ${schemaName} is not present in ${manifest.configuration.sourcePath}.`);
      }
    }
  }
}

if (process.exitCode) process.exitCode = 1;
else console.log(`[template-validation] Validated ${seenIds.size} template manifest(s).`);
