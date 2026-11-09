import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const readJson = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const fail = (message) => {
  console.error(`[module-validation] ${message}`);
  process.exitCode = 1;
};
const semver = /^[0-9]+[.][0-9]+[.][0-9]+$/;
const isSafeRepoPath = (path) => typeof path === "string" && path.length > 0 &&
  !path.startsWith("/") && !/^[a-zA-Z]:[\\/]/.test(path) &&
  !path.split(/[\\/]+/).includes("..");
const repoPathExists = (path) => isSafeRepoPath(path) && existsSync(join(root, path));
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
const workspacePackages = new Map();
for (const workspaceRoot of ["apps", "packages"]) {
  const directory = join(root, workspaceRoot);
  if (!existsSync(directory)) continue;
  for (const entry of readdirSync(directory, { withFileTypes: true }).filter((item) => item.isDirectory())) {
    const packagePath = `${workspaceRoot}/${entry.name}`;
    const packageFile = join(root, packagePath, "package.json");
    if (!existsSync(packageFile)) continue;
    try {
      const pkg = JSON.parse(readFileSync(packageFile, "utf8"));
      if (typeof pkg.name === "string") workspacePackages.set(packagePath, pkg.name);
    } catch {
      fail(`Invalid workspace package metadata: ${packagePath}/package.json`);
    }
  }
}
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
    const { id, name, version, owner, status, tenantModel, entrypoints, implementation, permissions, dependencies, operations } = manifest;
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
        !implementation || typeof implementation !== "object" || Array.isArray(implementation) ||
        !["workspace-package", "host-adapter", "hybrid", "manifest-only"].includes(implementation.mode) ||
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
        continue;
      }
      if (!repoPathExists(entrypoints[key])) fail(`Entrypoint does not exist or leaves the repository in ${path}: ${entrypoints[key]}`);
    }
    const entrypointPaths = Object.values(entrypoints).filter((entrypoint) => typeof entrypoint === "string");
    const packageEntrypoints = entrypointPaths.filter((entrypoint) => workspacePackages.has(entrypoint));
    const appEntrypoints = entrypointPaths.filter((entrypoint) => entrypoint.startsWith("apps/"));
    if (implementation.mode === "manifest-only") {
      if (status !== "planned" || entrypointPaths.length > 0 || implementation.packageName) {
        fail(`Manifest-only modules must be planned and have no code entrypoints in ${path}`);
      }
    } else if (status === "planned") {
      fail(`Planned modules must remain manifest-only until implementation begins in ${path}`);
    }
    if (["workspace-package", "hybrid"].includes(implementation.mode)) {
      if (typeof implementation.packageName !== "string" ||
          !packageEntrypoints.some((entrypoint) => workspacePackages.get(entrypoint) === implementation.packageName)) {
        fail(`Implementation packageName must resolve to an entrypoint workspace package in ${path}`);
      }
    } else if (implementation.packageName !== undefined) {
      fail(`Only workspace-package or hybrid modules may declare packageName in ${path}`);
    }
    if (["host-adapter", "hybrid"].includes(implementation.mode) && appEntrypoints.length === 0) {
      fail(`Host-adapter modules must declare an app entrypoint in ${path}`);
    }
    if (implementation.mode === "workspace-package" && packageEntrypoints.length === 0) {
      fail(`Workspace-package modules must declare an apps/* or packages/* entrypoint in ${path}`);
    }
    if (implementation.mode === "hybrid" && packageEntrypoints.length === 0) {
      fail(`Hybrid modules must declare a workspace package entrypoint in ${path}`);
    }
    for (const testPath of manifest.tests ?? []) {
      if (!repoPathExists(testPath)) fail(`Test path does not exist or leaves the repository in ${path}: ${testPath}`);
    }
    if (status !== "planned" && (!Array.isArray(manifest.tests) || manifest.tests.length === 0)) {
      fail(`Implemented modules must declare at least one test path in ${path}`);
    }
    for (const docPath of manifest.docs ?? []) {
      if (!repoPathExists(docPath)) fail(`Documentation path does not exist or leaves the repository in ${path}: ${docPath}`);
    }
    for (const table of manifest.tables ?? []) {
      if (!table.name || !table.owner || typeof table.tenantScoped !== "boolean" ||
          !["forced", "not-applicable"].includes(table.rls)) {
        fail(`Invalid table ownership declaration in ${path}`);
        continue;
      }
      if (table.owner !== id) fail(`Table ${table.name} must be owned by module ${id} in ${path}`);
      if (table.tenantScoped && table.rls !== "forced") fail(`Tenant table ${table.name} must use forced RLS in ${path}`);
      if (table.migration && !repoPathExists(`packages/database/migrations/${table.migration}`)) {
        fail(`Migration for table ${table.name} does not exist in ${path}: ${table.migration}`);
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
    if (Object.keys(implementation).some((key) => !["mode", "packageName"].includes(key))) {
      fail(`Unknown implementation property in ${path}`);
    }
    if (implementation.packageName !== undefined &&
        (typeof implementation.packageName !== "string" || !/^@bazion\/[a-z0-9-]+$/.test(implementation.packageName))) {
      fail(`Invalid implementation packageName in ${path}`);
    }
  }
  for (const moduleId of permissionsByModule.keys()) {
    if (!manifestModules.has(moduleId)) fail(`Permission-owning module ${moduleId} has no manifest.`);
  }
}
if (manifestModules.size === 0) fail("No module manifests were found.");

if (process.exitCode) process.exit(process.exitCode);
console.log(`Module manifests valid: ${manifestModules.size} modules, ${permissionIds.size} registered permissions (registry v${registry.version}).`);
