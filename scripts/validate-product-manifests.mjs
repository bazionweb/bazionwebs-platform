import { existsSync, readFileSync, readdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { assertSupportedSchema, validateJsonSchema } from "./lib/json-schema.mjs";

const root = process.cwd();
let failures = 0;
const fail = (message) => {
  failures += 1;
  console.error(`[product-manifest-validation] ${message}`);
};

function readJson(path) {
  try {
    return JSON.parse(readFileSync(join(root, path), "utf8"));
  } catch (error) {
    fail(`Could not read valid JSON at ${path}: ${error instanceof Error ? error.message : "unknown error"}`);
    return null;
  }
}

function safeRepoPath(path) {
  return typeof path === "string" && path.length > 0 && !isAbsolute(path) &&
    !/^[a-zA-Z]:[\\/]/.test(path) && !path.startsWith("\\\\") &&
    !path.split(/[\\/]+/).includes("..");
}

function validateManifest(value, schema, schemaPath, manifestPath) {
  try {
    assertSupportedSchema(schema, schemaPath);
  } catch (error) {
    fail(`${schemaPath}: ${error instanceof Error ? error.message : "invalid schema"}`);
    return false;
  }
  const errors = validateJsonSchema(value, schema);
  for (const error of errors) fail(`${manifestPath}: ${error}`);
  return errors.length === 0;
}

function directories(path) {
  const absolute = join(root, path);
  return existsSync(absolute)
    ? readdirSync(absolute, { withFileTypes: true }).filter((entry) => entry.isDirectory())
    : [];
}

const productSchemaPath = "products/product-manifest.schema.json";
const templateSchemaPath = "templates/template-manifest.schema.json";
const productSchema = readJson(productSchemaPath);
const templateSchema = readJson(templateSchemaPath);
const catalog = readJson("products/catalog.json");
const permissionRegistry = readJson("products/permissions.json");
if (!productSchema || !templateSchema || !catalog || !permissionRegistry) process.exit(1);

const packagesByName = new Map();
const rootTemplatePackage = "templates/package.json";
if (existsSync(join(root, rootTemplatePackage))) {
  const pkg = readJson(rootTemplatePackage);
  if (pkg?.name) packagesByName.set(pkg.name, { path: rootTemplatePackage, manifest: pkg });
}
for (const workspaceRoot of ["apps", "packages"]) {
  for (const directory of directories(workspaceRoot)) {
    const packagePath = `${workspaceRoot}/${directory.name}/package.json`;
    if (!existsSync(join(root, packagePath))) continue;
    const pkg = readJson(packagePath);
    if (pkg?.name) packagesByName.set(pkg.name, { path: packagePath, manifest: pkg });
  }
}

const moduleManifests = new Map();
for (const directory of directories("modules")) {
  const path = `modules/${directory.name}/manifest.json`;
  const manifest = readJson(path);
  if (manifest) moduleManifests.set(directory.name, manifest);
}

const solutions = new Map();
for (const directory of directories("solutions")) {
  const path = `solutions/${directory.name}/manifest.json`;
  const solution = readJson(path);
  if (solution) solutions.set(directory.name, solution);
}

const templates = new Map();
for (const directory of directories("templates")) {
  const path = `templates/${directory.name}/manifest.json`;
  if (!existsSync(join(root, path))) continue;
  const template = readJson(path);
  if (!template) continue;
  if (!validateManifest(template, templateSchema, templateSchemaPath, path)) continue;
  if (template.id !== directory.name) fail(`Template ID ${template.id} must match directory ${directory.name}.`);
  if (templates.has(template.id)) fail(`Duplicate template ID: ${template.id}`);
  templates.set(template.id, template);

  const implementationPackage = packagesByName.get(template.implementation.packageName);
  if (!implementationPackage) {
    fail(`${path} references unknown workspace package ${template.implementation.packageName}.`);
  } else if (!implementationPackage.path.startsWith("apps/") && !implementationPackage.path.startsWith("packages/")) {
    fail(`${path} implementation package ${template.implementation.packageName} must be an application or reusable workspace package.`);
  }
  for (const sourcePath of [template.implementation.entrypoint, template.configuration.sourcePath]) {
    if (!safeRepoPath(sourcePath) || !existsSync(join(root, sourcePath))) {
      fail(`${path} references an unsafe or missing source path: ${sourcePath}`);
    }
  }
  if (safeRepoPath(template.configuration.sourcePath) && existsSync(join(root, template.configuration.sourcePath))) {
    const source = readFileSync(join(root, template.configuration.sourcePath), "utf8");
    for (const schemaName of template.configuration.schemaNames) {
      if (!new RegExp(`\\b${schemaName}\\b`).test(source)) {
        fail(`${path} configuration schema ${schemaName} was not found in ${template.configuration.sourcePath}.`);
      }
    }
  }
}

const catalogModules = new Map((catalog.modules ?? []).map((module) => [module.id, module]));
const products = new Map();
for (const directory of directories("products")) {
  const path = `products/${directory.name}/manifest.json`;
  if (!existsSync(join(root, path))) continue;
  const product = readJson(path);
  if (!product) continue;
  if (!validateManifest(product, productSchema, productSchemaPath, path)) continue;
  if (product.id !== directory.name) fail(`Product ID ${product.id} must match directory ${directory.name}.`);
  if (products.has(product.id)) fail(`Duplicate product ID: ${product.id}`);
  products.set(product.id, product);

  const solution = solutions.get(product.solution.id);
  if (!solution) {
    fail(`${path} references unknown solution ${product.solution.id}.`);
  } else {
    if (solution.version !== product.solution.version) fail(`${path} solution version does not match solutions/${product.solution.id}/manifest.json.`);
    if (solution.readiness !== "buildable") fail(`${path} references solution ${product.solution.id}, which is not buildable.`);
    const ids = (items) => items.map((item) => item.id).sort();
    const requiredIds = ids(product.requiredModules);
    const solutionRequiredIds = [...(solution.requiredModules ?? [])].sort();
    if (JSON.stringify(requiredIds) !== JSON.stringify(solutionRequiredIds)) {
      fail(`${path} required modules must exactly match solution ${solution.id}.requiredModules.`);
    }
    const templateIds = ids(product.templates);
    const solutionTemplateIds = [...(solution.templateIds ?? [])].sort();
    if (JSON.stringify(templateIds) !== JSON.stringify(solutionTemplateIds)) {
      fail(`${path} templates must exactly match solution ${solution.id}.templateIds.`);
    }
    for (const { id } of [...product.requiredModules, ...product.optionalModules]) {
      if (![...(solution.requiredModules ?? []), ...(solution.optionalModules ?? [])].includes(id)) {
        fail(`${path} includes module ${id}, which is not part of solution ${solution.id}.`);
      }
    }
    if (product.status === "stable" && solution.status !== "stable") {
      fail(`${path} cannot be stable while solution ${solution.id} is ${solution.status}.`);
    }
  }

  const allModuleRefs = [...product.requiredModules, ...product.optionalModules];
  const moduleRefIds = new Set();
  for (const reference of allModuleRefs) {
    if (moduleRefIds.has(reference.id)) fail(`${path} lists module ${reference.id} more than once.`);
    moduleRefIds.add(reference.id);
    const manifest = moduleManifests.get(reference.id);
    const catalogModule = catalogModules.get(reference.id);
    if (!manifest || !catalogModule || catalogModule.classification !== "module") {
      fail(`${path} references ${reference.id}, which is not a manifest-backed runtime module.`);
      continue;
    }
    if (manifest.version !== reference.version) fail(`${path} module ${reference.id} version does not match its module manifest.`);
    if (["planned", "deprecated"].includes(manifest.status)) fail(`${path} cannot include ${reference.id} with status ${manifest.status}.`);
    if (product.status === "stable" && manifest.status !== "stable") fail(`${path} cannot be stable while referenced module ${reference.id} is ${manifest.status}.`);
  }
  for (const reference of allModuleRefs) {
    const manifest = moduleManifests.get(reference.id);
    for (const dependency of manifest?.dependencies ?? []) {
      if (!moduleRefIds.has(dependency)) {
        fail(`${path} module ${reference.id} depends on ${dependency}, which is missing from the product composition.`);
      } else if (product.requiredModules.some((required) => required.id === reference.id) &&
          !product.requiredModules.some((required) => required.id === dependency)) {
        fail(`${path} required module ${reference.id} depends on ${dependency}, which must also be required by the product.`);
      }
    }
  }

  const applicationRoles = new Set();
  const applicationPackages = new Set();
  for (const application of product.applications) {
    if (applicationRoles.has(application.role)) fail(`${path} declares application role ${application.role} more than once.`);
    applicationRoles.add(application.role);
    if (applicationPackages.has(application.packageName)) fail(`${path} declares application package ${application.packageName} more than once.`);
    applicationPackages.add(application.packageName);
    const workspacePackage = packagesByName.get(application.packageName);
    if (!workspacePackage) fail(`${path} references unknown application package ${application.packageName}.`);
    else if (workspacePackage.manifest.version !== application.version) {
      fail(`${path} application ${application.packageName} version does not match ${workspacePackage.path}.`);
    }
  }

  const templateRefIds = new Set();
  for (const reference of product.templates) {
    if (templateRefIds.has(reference.id)) fail(`${path} lists template ${reference.id} more than once.`);
    templateRefIds.add(reference.id);
    const template = templates.get(reference.id);
    if (!template) fail(`${path} references unknown template ${reference.id}.`);
    else {
      if (template.version !== reference.version) fail(`${path} template ${reference.id} version does not match its template manifest.`);
      if (template.configuration.schemaVersion !== product.configuration.schemaVersion) {
        fail(`${path} configuration version does not match template ${reference.id}.`);
      }
      if (template.configuration.sourcePath !== product.configuration.sourcePath) {
        fail(`${path} configuration source does not match template ${reference.id}.`);
      }
      const templateImplementation = packagesByName.get(template.implementation.packageName);
      if (templateImplementation?.path.startsWith("apps/")) {
        if (!applicationPackages.has(template.implementation.packageName)) {
          fail(`${path} must declare template application ${template.implementation.packageName} in its applications.`);
        }
      } else if (templateImplementation?.path.startsWith("packages/")) {
        const consumedByApplication = product.applications.some(({ packageName }) => {
          const application = packagesByName.get(packageName)?.manifest;
          const dependencySpec = application?.dependencies?.[template.implementation.packageName]
            ?? application?.devDependencies?.[template.implementation.packageName];
          return typeof dependencySpec === "string" && dependencySpec.startsWith("workspace:");
        });
        if (!consumedByApplication) {
          fail(`${path} template package ${template.implementation.packageName} must be a workspace dependency of a declared application.`);
        }
      }
      if (product.status === "stable" && template.status !== "stable") fail(`${path} cannot be stable while template ${reference.id} is ${template.status}.`);
    }
  }

  if (!safeRepoPath(product.configuration.sourcePath) || !existsSync(join(root, product.configuration.sourcePath))) {
    fail(`${path} references an unsafe or missing configuration source: ${product.configuration.sourcePath}`);
  }
}

const migrationRegistryPath = "packages/database/src/migration-registry.ts";
if (products.size && existsSync(join(root, migrationRegistryPath))) {
  const migrationRegistry = readFileSync(join(root, migrationRegistryPath), "utf8");
  const migrationList = migrationRegistry.match(/export const requiredDatabaseMigrations = \[([\s\S]*?)\] as const;/)?.[1];
  const migrationNames = [...(migrationList ?? "").matchAll(/["']([^"']+\.sql)["']/g)].map((match) => match[1]);
  if (!migrationList || !migrationNames.length) fail(`Could not read registered migrations from ${migrationRegistryPath}.`);
  else {
    const currentSchemaVersion = migrationNames.at(-1);
    for (const product of products.values()) {
      if (!migrationNames.includes(product.databaseSchemaVersion)) {
        fail(`Product ${product.id} database schema ${product.databaseSchemaVersion} is not registered in the migration registry.`);
      } else if (product.databaseSchemaVersion !== currentSchemaVersion) {
        fail(`Product ${product.id} database schema must match current registry version ${currentSchemaVersion}.`);
      }
    }
  }
} else if (products.size) {
  fail(`Missing migration registry: ${migrationRegistryPath}.`);
}

if (failures) process.exit(1);
console.log(`Product manifests valid: ${products.size} products, ${templates.size} templates, ${packagesByName.size} workspace packages resolved.`);
