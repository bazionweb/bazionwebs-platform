import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const readJson = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const fail = (message) => {
  console.error(`[module-validation] ${message}`);
  process.exitCode = 1;
};
const semver = /^[0-9]+[.][0-9]+[.][0-9]+$/;
const catalog = readJson("products/catalog.json");
const schema = readJson("products/module-manifest.schema.json");
const registry = readJson("products/permissions.json");
const modulesById = new Map((catalog.modules ?? []).map((item) => [item.id, item]));
const manifestModules = new Set();

if (!semver.test(registry.version ?? "")) fail("Permission registry version must be semver.");
if (!Array.isArray(registry.roles) || registry.roles.length === 0) fail("Permission registry must define roles.");
if (new Set(registry.roles ?? []).size !== registry.roles?.length) fail("Permission registry contains duplicate roles.");

const permissionIds = new Set();
const permissionKeys = new Set();
const permissionsByModule = new Map();
for (const permission of registry.permissions ?? []) {
  if (!permission.id || !/^[a-z][a-z0-9.-]+$/.test(permission.id) ||
      !permission.moduleId || !permission.resource || !permission.action ||
      !["tenant", "platform", "mixed"].includes(permission.scope) || !Array.isArray(permission.roles)) {
    fail(`Invalid permission entry: ${JSON.stringify(permission)}`);
    continue;
  }
  if (permissionIds.has(permission.id)) fail(`Duplicate permission ID: ${permission.id}`);
  permissionIds.add(permission.id);
  const key = `${permission.scope}:${permission.resource}:${permission.action}`;
  if (permissionKeys.has(key)) fail(`Duplicate permission tuple: ${key}`);
  permissionKeys.add(key);
  if (!modulesById.has(permission.moduleId)) fail(`Permission ${permission.id} references unknown module ${permission.moduleId}`);
  if (new Set(permission.roles).size !== permission.roles.length) fail(`Permission ${permission.id} has duplicate role grants`);
  for (const role of permission.roles) {
    if (!registry.roles.includes(role)) fail(`Permission ${permission.id} references unknown role ${role}`);
  }
  const list = permissionsByModule.get(permission.moduleId) ?? [];
  list.push(permission);
  permissionsByModule.set(permission.moduleId, list);
}
if (!registry.permissions?.length) fail("Permission registry must contain permissions.");

const moduleRoot = join(root, "modules");
if (!existsSync(moduleRoot)) {
  fail("Missing modules/ manifest directory.");
} else {
  const directories = readdirSync(moduleRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  for (const directory of directories) {
    const path = `modules/${directory.name}/manifest.json`;
    let manifest;
    try { manifest = readJson(path); } catch {
      fail(`Missing or invalid module manifest: ${path}`);
      continue;
    }
    const { id, name, version, owner, status, tenantModel, entrypoints, permissions, dependencies, operations } = manifest;
    if (id !== directory.name) fail(`Manifest ID must match directory name: ${path}`);
    if (manifestModules.has(id)) fail(`Duplicate module manifest: ${id}`);
    manifestModules.add(id);
    if (!modulesById.has(id)) fail(`Module manifest ${id} is not present in products/catalog.json`);

    for (const key of Object.keys(manifest)) {
      if (!Object.hasOwn(schema.properties ?? {}, key)) fail(`Unknown property ${key} in ${path}`);
    }
    for (const required of schema.required ?? []) {
      if (!Object.hasOwn(manifest, required)) fail(`Missing required property ${required} in ${path}`);
    }
    if (!name || !owner || !semver.test(version ?? "") ||
        !["planned", "experimental", "partial", "stable", "deprecated"].includes(status) ||
        !["tenant-owned", "platform-owned", "mixed", "not-applicable"].includes(tenantModel) ||
        !entrypoints || typeof entrypoints !== "object" || Array.isArray(entrypoints) ||
        !Array.isArray(permissions) || !Array.isArray(dependencies) ||
        !operations || typeof operations.logs !== "boolean" || typeof operations.metrics !== "boolean" ||
        typeof operations.retention !== "string" || !operations.retention ||
        typeof operations.recovery !== "string" || !operations.recovery ||
        typeof operations.enableDisable !== "string" || !operations.enableDisable) {
      fail(`Invalid module manifest shape: ${path}`);
      continue;
    }
    for (const key of Object.keys(entrypoints)) {
      if (!["domain", "api", "ui", "worker"].includes(key) || typeof entrypoints[key] !== "string") {
        fail(`Invalid entrypoint ${key} in ${path}`);
      }
    }
    if (new Set(dependencies).size !== dependencies.length) fail(`Duplicate dependency in ${path}`);
    for (const dependency of dependencies) {
      if (!modulesById.has(dependency)) fail(`Unknown dependency ${dependency} in ${path}`);
    }
    for (const permission of permissions) {
      if (!permission.resource || !Array.isArray(permission.actions) || permission.actions.length === 0 ||
          Object.keys(permission).some((key) => !["resource", "actions"].includes(key))) {
        fail(`Invalid permission declaration in ${path}`);
      }
      if (new Set(permission.actions ?? []).size !== permission.actions?.length) {
        fail(`Duplicate permission action in ${path}: ${permission.resource}`);
      }
    }
    const declared = new Set(permissions.flatMap((entry) => (entry.actions ?? []).map((action) => `${entry.resource}:${action}`)));
    for (const permission of permissionsByModule.get(id) ?? []) {
      if (!declared.has(`${permission.resource}:${permission.action}`)) {
        fail(`Module ${id} manifest omits registry permission ${permission.id}`);
      }
    }
    for (const entry of permissions) {
      for (const action of entry.actions ?? []) {
        const matches = (permissionsByModule.get(id) ?? []).some((permission) =>
          permission.resource === entry.resource && permission.action === action);
        if (!matches) fail(`Module ${id} declares unregistered permission ${entry.resource}:${action}`);
      }
    }
  }
  for (const moduleId of permissionsByModule.keys()) {
    if (!manifestModules.has(moduleId)) fail(`Permission-owning module ${moduleId} has no manifest.`);
  }
}
if (manifestModules.size === 0) fail("No module manifests were found.");

if (process.exitCode) process.exit(process.exitCode);
console.log(`Module manifests valid: ${manifestModules.size} modules, ${permissionIds.size} registered permissions (registry v${registry.version}).`);
