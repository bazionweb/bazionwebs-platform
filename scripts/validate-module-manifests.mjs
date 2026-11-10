import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { assertSupportedSchema, validateJsonSchema } from "./lib/json-schema.mjs";
import { packageExportTargetResolves } from "./lib/package-exports.mjs";

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
const permissionSchema = readJson("products/permissions.schema.json");
assertSupportedSchema(schema, "products/module-manifest.schema.json");
assertSupportedSchema(permissionSchema, "products/permissions.schema.json");
for (const error of validateJsonSchema(registry, permissionSchema)) fail(`products/permissions.json: ${error}`);
const modulesById = new Map((catalog.modules ?? []).map((item) => [item.id, item]));
const manifestModules = new Set();

if (!semver.test(registry.version ?? "")) fail("Permission registry version must be semver.");
if (!Array.isArray(registry.roles) || registry.roles.length === 0) fail("Permission registry must define roles.");
if (new Set(registry.roles ?? []).size !== registry.roles?.length) fail("Permission registry contains duplicate roles.");

const permissionIds = new Set();
const permissionKeys = new Set();
const permissionsByModule = new Map();
const workspacePackages = new Map();
const packagesByName = new Map();
for (const workspaceRoot of ["apps", "packages"]) {
  const directory = join(root, workspaceRoot);
  if (!existsSync(directory)) continue;
  for (const entry of readdirSync(directory, { withFileTypes: true }).filter((item) => item.isDirectory())) {
    const packagePath = `${workspaceRoot}/${entry.name}`;
    const packageFile = join(root, packagePath, "package.json");
    if (!existsSync(packageFile)) continue;
    try {
      const pkg = JSON.parse(readFileSync(packageFile, "utf8"));
      if (typeof pkg.name === "string") {
        workspacePackages.set(packagePath, pkg.name);
        packagesByName.set(pkg.name, { path: packagePath, absolutePath: join(root, packagePath), manifest: pkg });
      }
    } catch {
      fail(`Invalid workspace package metadata: ${packagePath}/package.json`);
    }
  }
}

function sourceFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name) ? [path] : [];
  });
}

function importSpecifiers(source) {
  const found = [];
  const pattern = /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["']([^"']+)["']/g;
  for (const match of source.matchAll(pattern)) found.push(match[1]);
  return found;
}

function packageExportTargets(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(packageExportTargets);
  if (value && typeof value === "object") return Object.values(value).flatMap(packageExportTargets);
  return [];
}

const allPackageFiles = new Map();
for (const [packagePath, packageName] of workspacePackages) {
  const packageInfo = packagesByName.get(packageName);
  const sourceDir = join(packageInfo.absolutePath, "src");
  const files = sourceFiles(sourceDir);
  allPackageFiles.set(packagePath, files);
  const declared = new Set([
    ...Object.keys(packageInfo.manifest.dependencies ?? {}),
    ...Object.keys(packageInfo.manifest.devDependencies ?? {}),
    ...Object.keys(packageInfo.manifest.peerDependencies ?? {}),
    ...Object.keys(packageInfo.manifest.optionalDependencies ?? {}),
  ]);
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const specifier of importSpecifiers(source)) {
      if (specifier.startsWith("@bazion/") && packagesByName.has(specifier.split("/").slice(0, 2).join("/")) &&
          !declared.has(specifier.split("/").slice(0, 2).join("/"))) {
        fail(`${relative(root, file)} imports workspace package ${specifier} without declaring it in package.json.`);
      }
      if (!specifier.startsWith(".")) continue;
      const resolved = resolve(dirname(file), specifier);
      const repoRelative = relative(root, resolved).replaceAll("\\", "/");
      if (packagePath.startsWith("packages/") && repoRelative.startsWith("apps/")) {
        fail(`${relative(root, file)} imports application code ${specifier}; packages may not depend on apps.`);
      }
      for (const [otherPath, otherName] of workspacePackages) {
        if (otherPath === packagePath || !resolved.startsWith(join(root, otherPath))) continue;
        if (!declared.has(otherName)) fail(`${relative(root, file)} crosses into ${otherName} without declaring it in package.json.`);
      }
    }
  }
}

const migrationCache = new Map();
function migrationSql(filename) {
  if (!migrationCache.has(filename)) {
    const path = join(root, "packages/database/migrations", filename);
    migrationCache.set(filename, existsSync(path) ? readFileSync(path, "utf8") : "");
  }
  return migrationCache.get(filename);
}

const declaredTableOwners = new Map();
const domainPackagePaths = new Set();
const moduleDependencies = new Map();
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
    const schemaErrors = validateJsonSchema(manifest, schema);
    if (schemaErrors.length) {
      for (const error of schemaErrors) fail(`${path}: ${error}`);
      continue;
    }
    const { id, name, version, owner, status, tenantModel, entrypoints, implementation, permissions, dependencies, operations, tables, migrations } = manifest;
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
      if (!["domain", "adapter", "contracts", "api", "ui", "worker"].includes(key) || typeof entrypoints[key] !== "string") {
        fail(`Invalid entrypoint ${key} in ${path}`);
        continue;
      }
      if (!repoPathExists(entrypoints[key])) fail(`Entrypoint does not exist or leaves the repository in ${path}: ${entrypoints[key]}`);
    }
    const entrypointPaths = Object.values(entrypoints).filter((entrypoint) => typeof entrypoint === "string");
    const packageEntrypoints = entrypointPaths.filter((entrypoint) => workspacePackages.has(entrypoint));
    const appEntrypoints = entrypointPaths.filter((entrypoint) => entrypoint.startsWith("apps/"));
    const domainPackagePath = entrypoints.domain;
    if (typeof domainPackagePath === "string" && domainPackagePath.startsWith("packages/") &&
        workspacePackages.has(domainPackagePath) && !domainPackagePaths.has(domainPackagePath)) {
      domainPackagePaths.add(domainPackagePath);
      const packageName = workspacePackages.get(domainPackagePath);
      const packageInfo = packageName ? packagesByName.get(packageName) : undefined;
      const forbiddenDependency = (name) => name === "better-auth" || name === "fastify" || name === "next" ||
        name === "pg" || name === "postgres" || name === "mysql2" || name === "mongodb" ||
        name === "drizzle-orm" || name === "@neondatabase/serverless" || name.startsWith("@aws-sdk/") ||
        name.startsWith("@stripe/") || name.startsWith("@google-cloud/");
      if (packageInfo) {
        const declared = Object.keys(packageInfo.manifest.dependencies ?? {});
        for (const name of declared) {
          if (forbiddenDependency(name)) fail(`Domain package ${packageName} depends on adapter/provider package ${name}.`);
        }
        for (const file of allPackageFiles.get(domainPackagePath) ?? []) {
          for (const specifier of importSpecifiers(readFileSync(file, "utf8"))) {
            const importedPackage = specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0];
            if (forbiddenDependency(importedPackage)) {
              fail(`${relative(root, file)} imports adapter/provider package ${importedPackage} from a domain entrypoint.`);
            }
          }
        }
      }
    }
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
      const packageInfo = packagesByName.get(implementation.packageName);
      const rootExport = packageInfo?.manifest.exports?.["."];
      const targets = packageExportTargets(rootExport);
      if (!packageInfo || !targets.length) {
        fail(`Package ${implementation.packageName} must expose a public root export in package.json for ${path}`);
      } else {
        for (const target of targets) {
          if (!packageExportTargetResolves(packageInfo.absolutePath, target)) {
            fail(`Public export ${target} for ${implementation.packageName} does not resolve to a package file or a generated target backed by source in ${path}`);
          }
        }
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
    if (migrations !== undefined && (!Array.isArray(migrations) || new Set(migrations).size !== migrations.length)) {
      fail(`Migration filenames must be a unique array in ${path}`);
    }
    const declaredMigrations = Array.isArray(migrations) ? migrations : [];
    for (const migration of declaredMigrations) {
      if (typeof migration !== "string" || !/^[0-9]+_[a-z0-9_-]+\.sql$/.test(migration) || !repoPathExists(`packages/database/migrations/${migration}`)) {
        fail(`Migration does not exist in ${path}: ${migration}`);
      }
    }
    const tableNames = new Set();
    for (const table of tables ?? []) {
      if (!table.name || !table.owner || typeof table.tenantScoped !== "boolean" ||
          !["forced", "not-applicable"].includes(table.rls)) {
        fail(`Invalid table ownership declaration in ${path}`);
        continue;
      }
      if (tableNames.has(table.name)) fail(`Duplicate table ownership declaration in ${path}: ${table.name}`);
      tableNames.add(table.name);
      const currentOwner = declaredTableOwners.get(table.name);
      if (currentOwner && currentOwner !== id) fail(`Table ${table.name} is assigned to both ${currentOwner} and ${id}.`);
      declaredTableOwners.set(table.name, id);
      if (table.owner !== id) fail(`Table ${table.name} must be owned by module ${id} in ${path}`);
      if (table.tenantScoped && table.rls !== "forced") fail(`Tenant table ${table.name} must use forced RLS in ${path}`);
      if (table.migration && !repoPathExists(`packages/database/migrations/${table.migration}`)) {
        fail(`Migration for table ${table.name} does not exist in ${path}: ${table.migration}`);
      }
      if (table.migration && !declaredMigrations.includes(table.migration)) {
        fail(`Migration for table ${table.name} must also be listed in migrations in ${path}`);
      }
      if (table.migration && declaredMigrations.includes(table.migration)) {
        const sqlText = migrationSql(table.migration);
        const escapedName = table.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const createPattern = new RegExp(`\\bCREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+(?:public\\.)?[\"']?${escapedName}[\"']?\\s*\\(`, "i");
        const drizzleTablePattern = new RegExp(`pgTable\\s*\\(\\s*[\"']${escapedName}[\"']`, "m");
        const databaseSchema = [...(allPackageFiles.get("packages/database") ?? [])]
          .map((file) => readFileSync(file, "utf8")).join("\\n");
        if (!createPattern.test(sqlText) && !drizzleTablePattern.test(databaseSchema)) {
          fail(`Table ${table.name} is not defined by Drizzle or created by ${table.migration} (${path}).`);
        }
        if (table.tenantScoped) {
          const relatedSql = declaredMigrations.map(migrationSql).join("\\n");
          const directRls = new RegExp(`ALTER\\s+TABLE\\s+(?:public\\.)?[\"']?${escapedName}[\"']?\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY[\\s\\S]*?ALTER\\s+TABLE\\s+(?:public\\.)?[\"']?${escapedName}[\"']?\\s+FORCE\\s+ROW\\s+LEVEL\\s+SECURITY`, "i").test(relatedSql);
          const genericRls = /FOREACH\s+\w+\s+IN\s+ARRAY\s+ARRAY\s*\[[\s\S]*?\]/i.test(relatedSql) &&
            new RegExp(`[\"']${escapedName}[\"']`, "i").test(relatedSql) &&
            /ALTER\s+TABLE\s+%I\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(relatedSql) &&
            /ALTER\s+TABLE\s+%I\s+FORCE\s+ROW\s+LEVEL\s+SECURITY/i.test(relatedSql) &&
            /CREATE\s+POLICY\s+tenant_isolation\s+ON\s+%I/i.test(relatedSql);
          if (!directRls && !genericRls) fail(`Tenant-scoped table ${table.name} must declare forced RLS and a tenant policy in its migrations (${path}).`);
        }
      }
    }
    if (new Set(dependencies).size !== dependencies.length) fail(`Duplicate dependency in ${path}`);
    moduleDependencies.set(id, dependencies);
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

const dependencyStates = new Map();
const dependencyStack = [];
function visitDependencies(moduleId) {
  const state = dependencyStates.get(moduleId);
  if (state === "complete") return;
  if (state === "visiting") {
    const cycleStart = dependencyStack.indexOf(moduleId);
    fail(`Module dependency cycle: ${[...dependencyStack.slice(cycleStart), moduleId].join(" -> ")}.`);
    return;
  }
  dependencyStates.set(moduleId, "visiting");
  dependencyStack.push(moduleId);
  for (const dependency of moduleDependencies.get(moduleId) ?? []) {
    if (moduleDependencies.has(dependency)) visitDependencies(dependency);
  }
  dependencyStack.pop();
  dependencyStates.set(moduleId, "complete");
}
for (const moduleId of moduleDependencies.keys()) visitDependencies(moduleId);

if (process.exitCode) process.exit(process.exitCode);
console.log(`Module manifests valid: ${manifestModules.size} modules, ${permissionIds.size} registered permissions (registry v${registry.version}).`);
