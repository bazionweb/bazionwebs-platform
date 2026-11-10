import { existsSync, readFileSync, readdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { assertSupportedSchema, validateJsonSchema } from "./lib/json-schema.mjs";

const root = process.cwd();
let failures = 0;
const fail = (message) => {
  failures += 1;
  console.error(`[catalog-validation] ${message}`);
};

function readJson(path) {
  try {
    return JSON.parse(readFileSync(join(root, path), "utf8"));
  } catch (error) {
    fail(`Could not read valid JSON at ${path}: ${error instanceof Error ? error.message : "unknown error"}`);
    return null;
  }
}

function validateFile(value, schemaPath, filePath) {
  const schema = readJson(schemaPath);
  if (!schema || value === null) return;
  try {
    assertSupportedSchema(schema, schemaPath);
    for (const error of validateJsonSchema(value, schema)) fail(`${filePath}: ${error}`);
  } catch (error) {
    fail(`${schemaPath}: ${error instanceof Error ? error.message : "invalid schema"}`);
  }
}

function isSafeRepoPath(path) {
  return typeof path === "string" && path.length > 0 && !isAbsolute(path) &&
    !/^[a-zA-Z]:[\\/]/.test(path) && !path.split(/[\\/]+/).includes("..") && !path.startsWith("\\\\");
}

function pathExists(path) {
  return isSafeRepoPath(path) && existsSync(join(root, path));
}

const catalog = readJson("products/catalog.json");
const commercial = readJson("products/commercial-offerings.json");
const permissionRegistry = readJson("products/permissions.json");
if (!catalog || !commercial || !permissionRegistry) process.exit(1);

validateFile(catalog, "products/catalog.schema.json", "products/catalog.json");
validateFile(commercial, "products/commercial-offerings.schema.json", "products/commercial-offerings.json");
validateFile(permissionRegistry, "products/permissions.schema.json", "products/permissions.json");

const moduleDirectories = existsSync(join(root, "modules"))
  ? readdirSync(join(root, "modules"), { withFileTypes: true }).filter((item) => item.isDirectory())
  : [];
const manifests = new Map();
for (const directory of moduleDirectories) {
  const file = `modules/${directory.name}/manifest.json`;
  const manifest = readJson(file);
  if (manifest) manifests.set(directory.name, manifest);
}

const catalogModules = new Map();
for (const module of catalog.modules ?? []) {
  if (catalogModules.has(module.id)) {
    fail(`Duplicate module ID: ${module.id}`);
    continue;
  }
  catalogModules.set(module.id, module);

  const manifest = manifests.get(module.id);
  if (module.classification === "module") {
    if (!manifest) fail(`Module ${module.id} needs a manifest under modules/${module.id}/manifest.json.`);
    else {
      const expectedStatus = manifest.status === "stable" ? "implemented"
        : manifest.status === "planned" ? "planned" : "partial";
      if (module.status !== expectedStatus) {
        fail(`Catalogue status for ${module.id} is ${module.status}; manifest status ${manifest.status} maps to ${expectedStatus}.`);
      }
    }
    for (const path of module.sourcePath ?? []) {
      if (!isSafeRepoPath(path)) fail(`Unsafe source path for ${module.id}: ${path}`);
      else if (manifest && manifest.status !== "planned" && !pathExists(path)) fail(`Implemented module ${module.id} source path does not exist: ${path}`);
    }
  } else {
    if (manifest) fail(`Module ${module.id} has a manifest and must be classified as module.`);
    if (module.status === "implemented") fail(`Roadmap capability ${module.id} cannot be marked implemented without a module manifest.`);
    if (module.status === "partial" && !(module.sourcePath ?? []).some(pathExists)) {
      fail(`Partial roadmap capability ${module.id} must point to at least one existing source path.`);
    }
    for (const path of module.sourcePath ?? []) {
      if (!isSafeRepoPath(path)) fail(`Unsafe source path for ${module.id}: ${path}`);
    }
  }
}

for (const moduleId of manifests.keys()) {
  if (!catalogModules.has(moduleId)) fail(`Module manifest ${moduleId} is missing from products/catalog.json.`);
}

const capabilityIds = new Set();
for (const capability of catalog.capabilities ?? []) {
  if (capabilityIds.has(capability.id)) fail(`Duplicate capability ID: ${capability.id}`);
  capabilityIds.add(capability.id);
  if (!catalogModules.has(capability.moduleId)) fail(`Capability ${capability.id} references unknown module ${capability.moduleId}.`);
}

const offeringIds = new Set();
for (const offering of commercial.offerings ?? []) {
  if (offeringIds.has(offering.id)) fail(`Duplicate commercial offering ID: ${offering.id}`);
  offeringIds.add(offering.id);
  for (const moduleId of offering.moduleIds ?? []) {
    if (!catalogModules.has(moduleId)) fail(`Offering ${offering.id} references unknown module ${moduleId}.`);
  }
}

const permissionIds = new Set();
const permissionTuples = new Set();
const roles = new Set(permissionRegistry.roles ?? []);
for (const permission of permissionRegistry.permissions ?? []) {
  if (permissionIds.has(permission.id)) fail(`Duplicate permission ID: ${permission.id}`);
  permissionIds.add(permission.id);
  const tuple = `${permission.scope}:${permission.resource}:${permission.action}`;
  if (permissionTuples.has(tuple)) fail(`Duplicate permission tuple: ${tuple}`);
  permissionTuples.add(tuple);
  if (!catalogModules.has(permission.moduleId)) fail(`Permission ${permission.id} references unknown module ${permission.moduleId}.`);
  for (const role of permission.roles ?? []) if (!roles.has(role)) fail(`Permission ${permission.id} references unknown role ${role}.`);
}

const solutionDirectories = existsSync(join(root, "solutions"))
  ? readdirSync(join(root, "solutions"), { withFileTypes: true }).filter((item) => item.isDirectory())
  : [];
const solutionIds = new Set();
let buildableSolutions = 0;
for (const directory of solutionDirectories) {
  const file = `solutions/${directory.name}/manifest.json`;
  const solution = readJson(file);
  if (!solution) continue;
  validateFile(solution, "products/solution-manifest.schema.json", file);
  if (solution.id !== directory.name) fail(`Solution ID ${solution.id} must match directory ${directory.name}.`);
  if (solutionIds.has(solution.id)) fail(`Duplicate solution ID: ${solution.id}`);
  solutionIds.add(solution.id);

  const required = solution.requiredModules ?? [];
  const optional = solution.optionalModules ?? [];
  const composed = new Set([...required, ...optional]);
  for (const moduleId of composed) if (!catalogModules.has(moduleId)) fail(`Solution ${solution.id} references unknown module ${moduleId}.`);
  for (const moduleId of required) if (optional.includes(moduleId)) fail(`Solution ${solution.id} lists ${moduleId} as both required and optional.`);
  for (const item of solution.navigation ?? []) {
    if (!catalogModules.has(item.module)) fail(`Solution ${solution.id} navigation ${item.id} references unknown module ${item.module}.`);
    if (!composed.has(item.module)) fail(`Solution ${solution.id} navigation ${item.id} uses ${item.module}, which is not in its composition.`);
  }

  if (solution.readiness === "roadmap") {
    if (!solution.readinessNotes?.length) fail(`Roadmap solution ${solution.id} must explain why it is not buildable yet.`);
    continue;
  }
  if (solution.readiness !== "buildable") continue;
  buildableSolutions += 1;
  if (["planned", "deprecated"].includes(solution.status)) fail(`Solution ${solution.id} cannot be buildable with status ${solution.status}.`);
  if (solution.readinessNotes?.length) fail(`Buildable solution ${solution.id} should not carry roadmap readiness notes.`);

  const pending = [...required];
  const visited = new Set();
  while (pending.length) {
    const moduleId = pending.pop();
    if (visited.has(moduleId)) continue;
    visited.add(moduleId);
    const module = catalogModules.get(moduleId);
    const manifest = manifests.get(moduleId);
    if (!module || module.classification !== "module" || !manifest || ["planned", "deprecated"].includes(manifest.status)) {
      fail(`Buildable solution ${solution.id} requires ${moduleId}, which has no ready runtime module manifest.`);
      continue;
    }
    for (const dependency of manifest.dependencies ?? []) {
      if (!composed.has(dependency)) fail(`Buildable solution ${solution.id} omits transitive module dependency ${dependency} required by ${moduleId}.`);
      else pending.push(dependency);
    }
  }
}

if (failures) process.exit(1);
console.log(`Product catalogue valid: ${catalog.capabilities.length} capabilities, ${catalogModules.size} module records (${manifests.size} manifest-backed modules), ${offeringIds.size} offers, ${solutionIds.size} solutions (${buildableSolutions} buildable).`);
