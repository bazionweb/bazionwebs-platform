import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const platformContractsDir = join(repoRoot, "packages/api-contracts/contracts");

function resolveBazionwebApiDir() {
  const explicit = process.env.BAZIONWEB_API_DIR?.trim();
  const candidates = [
    explicit ? resolve(repoRoot, explicit) : null,
    explicit ? resolve(explicit) : null,
    resolve(repoRoot, ".bazionweb/apps/api"),
    resolve(repoRoot, "../bazionweb/apps/api"),
    resolve(repoRoot, "../../bazionweb/apps/api"),
    "D:/bazionweb/apps/api",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(join(candidate, "src/modules/platform-provisioning/contracts"))) {
      return candidate;
    }
  }
  return null;
}

const bazionwebApiDir = resolveBazionwebApiDir();
if (!bazionwebApiDir) {
  console.error(
    "CROSS_REPO_CONTRACT_VERIFY_FAILED: Could not locate bazionweb apps/api directory. "
      + "Set BAZIONWEB_API_DIR or check out sibling ../bazionweb.",
  );
  process.exit(1);
}

const bazionwebContractsDir = join(bazionwebApiDir, "src/modules/platform-provisioning/contracts");

const contractRelativeFiles = [
  "provision-product-request-v1.schema.json",
  "provisioning-offer-catalog-v1.schema.json",
  "provisioning-operation-v1.schema.json",
  "provisioning-status-event-v1.schema.json",
  "subscription-lifecycle-command-v1.schema.json",
  "subscription-lifecycle-status-event-v1.schema.json",
  "installation-change-command-v1.schema.json",
  "fixtures/v1-contract-fixtures.json",
];

function canonicalJson(rawText) {
  return JSON.stringify(JSON.parse(rawText.replace(/\r\n/g, "\n")));
}

const mismatches = [];
for (const relPath of contractRelativeFiles) {
  const leftPath = join(platformContractsDir, relPath);
  const rightPath = join(bazionwebContractsDir, relPath);

  if (!existsSync(leftPath)) {
    mismatches.push(`Missing platform contract file: ${leftPath}`);
    continue;
  }
  if (!existsSync(rightPath)) {
    mismatches.push(`Missing bazionweb contract file: ${rightPath}`);
    continue;
  }

  const leftCanonical = canonicalJson(readFileSync(leftPath, "utf8"));
  const rightCanonical = canonicalJson(readFileSync(rightPath, "utf8"));
  if (leftCanonical !== rightCanonical) {
    mismatches.push(`Contract drift detected for ${relPath} (${leftPath} !== ${rightPath})`);
  }
}

if (mismatches.length > 0) {
  for (const msg of mismatches) {
    console.error(`CROSS_REPO_CONTRACT_DRIFT: ${msg}`);
  }
  process.exit(1);
}

console.log(
  `Verified ${contractRelativeFiles.length} shared contract schemas and fixtures match between ${platformContractsDir} and ${bazionwebContractsDir}.`,
);

