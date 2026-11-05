import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const readJson = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const fail = (message) => {
  console.error(`[catalog-validation] ${message}`);
  process.exitCode = 1;
};

const catalog = readJson("products/catalog.json");
const commercial = readJson("products/commercial-offerings.json");

if (catalog.schemaVersion !== "1.0.0") fail("Unsupported products/catalog.json schemaVersion.");
if (!Array.isArray(catalog.modules) || !Array.isArray(catalog.capabilities)) {
  fail("The product catalogue must include modules and capabilities arrays.");
  process.exit(1);
}

const moduleIds = new Set();
for (const module of catalog.modules) {
  if (!module.id || !module.name || !Array.isArray(module.sourcePath) || !module.status) {
    fail(`Invalid module entry: ${JSON.stringify(module)}`);
    continue;
  }
  if (moduleIds.has(module.id)) fail(`Duplicate module ID: ${module.id}`);
  moduleIds.add(module.id);
  if (!["implemented", "partial", "planned"].includes(module.status)) {
    fail(`Invalid status for module ${module.id}: ${module.status}`);
  }
}

if (catalog.modules.length !== 36) {
  fail(`Expected 36 unique module records, found ${catalog.modules.length}`);
}

const capabilityIds = new Set();
for (const capability of catalog.capabilities) {
  if (!capability.id || !capability.name || !capability.group || !capability.moduleId || !capability.recordType) {
    fail(`Invalid capability entry: ${JSON.stringify(capability)}`);
    continue;
  }
  if (capabilityIds.has(capability.id)) fail(`Duplicate capability ID: ${capability.id}`);
  capabilityIds.add(capability.id);
  if (!moduleIds.has(capability.moduleId)) {
    fail(`Capability ${capability.id} references unknown module ${capability.moduleId}`);
  }
}

if (catalog.capabilities.length !== 111) {
  fail(`Expected 111 advertised capabilities, found ${catalog.capabilities.length}`);
}

const offerIds = new Set();
for (const offer of commercial.offerings ?? []) {
  if (!offer.id || !offer.name || !Array.isArray(offer.moduleIds) || offer.moduleIds.length === 0) {
    fail(`Invalid commercial offer: ${JSON.stringify(offer)}`);
    continue;
  }
  if (offerIds.has(offer.id)) fail(`Duplicate commercial offer ID: ${offer.id}`);
  offerIds.add(offer.id);
  for (const moduleId of offer.moduleIds) {
    if (!moduleIds.has(moduleId)) fail(`Offer ${offer.id} references unknown module ${moduleId}`);
  }
}
if (commercial.offerings?.length !== 35) {
  fail(`Expected 35 commercial offers, found ${commercial.offerings?.length ?? 0}`);
}

const solutionDirectories = readdirSync(join(root, "solutions"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const solutionIds = new Set();
let solutionCount = 0;

for (const directory of solutionDirectories) {
  const path = `solutions/${directory}/manifest.json`;
  let solution;
  try {
    solution = readJson(path);
  } catch {
    fail(`Missing or invalid JSON solution manifest: ${path}`);
    continue;
  }
  solutionCount += 1;
  if (!solution.id || !solution.name || !Array.isArray(solution.requiredModules) ||
      !Array.isArray(solution.optionalModules) || !Array.isArray(solution.defaultRoles) ||
      !Array.isArray(solution.navigation) || !solution.defaults) {
    fail(`Invalid solution manifest shape: ${path}`);
    continue;
  }
  if (solutionIds.has(solution.id)) fail(`Duplicate solution ID: ${solution.id}`);
  solutionIds.add(solution.id);
  for (const moduleId of [...solution.requiredModules, ...solution.optionalModules]) {
    if (!moduleIds.has(moduleId)) fail(`Solution ${solution.id} references unknown module ${moduleId}`);
  }
  for (const nav of solution.navigation) {
    if (!moduleIds.has(nav.module)) fail(`Solution ${solution.id} navigation ${nav.id} references unknown module ${nav.module}`);
  }
}
if (solutionCount !== 9) fail(`Expected 9 solution manifests, found ${solutionCount}`);

if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log(`Product catalogue valid: ${catalog.capabilities.length} capabilities, ${moduleIds.size} modules, ${offerIds.size} offers, ${solutionCount} solutions.`);
