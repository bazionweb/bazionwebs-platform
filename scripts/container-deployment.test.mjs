import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const dockerfile = await readFile(new URL("../Dockerfile", import.meta.url), "utf8");
const dockerignore = await readFile(new URL("../.dockerignore", import.meta.url), "utf8");
const adminConfig = await readFile(new URL("../apps/admin/next.config.ts", import.meta.url), "utf8");
const storefrontConfig = await readFile(new URL("../apps/storefront/next.config.ts", import.meta.url), "utf8");
const adminLayout = await readFile(new URL("../apps/admin/app/layout.tsx", import.meta.url), "utf8");
const storefrontLayout = await readFile(new URL("../apps/storefront/app/layout.tsx", import.meta.url), "utf8");
const adminFontFallbacks = await readFile(new URL("../apps/admin/app/font-fallbacks.css", import.meta.url), "utf8");
const storefrontFontFallbacks = await readFile(new URL("../apps/storefront/app/font-fallbacks.css", import.meta.url), "utf8");
const ciWorkflow = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
const stagingCompose = await readFile(new URL("../deploy/dokploy/platform-staging.compose.yml", import.meta.url), "utf8");
const postgresDumpScript = await readFile(new URL("../deploy/systemd/bazion-docker-postgres-dump.sh", import.meta.url), "utf8");
const stagingGuide = await readFile(new URL("../docs/operations/vps-staging-deployment.md", import.meta.url), "utf8");

test("Dockerfile provides a production target for each platform app and a one-shot migration target", () => {
  for (const target of ["api", "admin", "storefront", "storefront-test", "migrate", "database", "notification-worker"]) {
    assert.match(dockerfile, new RegExp(`AS ${target}\\b`), `missing ${target} target`);
  }
  assert.match(dockerfile, /COPY packages\/database\/init\/001-create-roles\.sh \/docker-entrypoint-initdb\.d\/001-create-roles\.sh/);
  assert.match(dockerfile, /postgres:18\.7-alpine3\.24 AS database/);
  assert.match(dockerfile, /CMD \["node", "dist\/worker\.js"\]/);
  assert.match(dockerfile, /pnpm --filter @bazion\/api --prod deploy \/out/);
  assert.match(dockerfile, /pnpm install --frozen-lockfile --filter @bazion\/api\.\.\./);
  assert.match(dockerfile, /pnpm install --frozen-lockfile --filter @bazion\/database\.\.\. --filter @bazion\/auth\.\.\./);
  assert.match(dockerfile, /pnpm --filter @bazion\/database migrate && pnpm --filter @bazion\/auth migrate/);
  assert.match(stagingCompose, /AUTH_MIGRATION_DATABASE_URL: postgres:\/\/bazion_migrator:/);
});

test("workspace manifests are copied before source to preserve dependency-install cache", () => {
  const dependencyManifestCopy = dockerfile.indexOf("COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./");
  const workspaceManifestCopy = dockerfile.indexOf("COPY --parents apps/*/package.json packages/*/package.json templates/package.json ./");
  const firstInstall = dockerfile.indexOf("pnpm install --frozen-lockfile");
  const firstSourceCopy = dockerfile.indexOf("COPY . .");
  assert.ok(dependencyManifestCopy >= 0 && workspaceManifestCopy > dependencyManifestCopy);
  assert.ok(firstInstall > workspaceManifestCopy && firstSourceCopy > firstInstall);
});

test("runtime app targets use non-root users and production mode", () => {
  for (const target of ["api", "admin", "storefront"]) {
    const start = dockerfile.indexOf(` AS ${target}\n`);
    assert.notEqual(start, -1, `missing ${target} runtime stage`);
    const nextStage = dockerfile.indexOf("\nFROM ", start + 1);
    const section = dockerfile.slice(start, nextStage === -1 ? undefined : nextStage);
    assert.match(section, /ENV NODE_ENV=production/);
    assert.match(section, /USER node/);
    assert.match(section, /HEALTHCHECK/);
  }
});

test("Next.js apps emit standalone output with the workspace root traced", () => {
  for (const [name, config] of [["admin", adminConfig], ["storefront", storefrontConfig]]) {
    assert.match(config, /output:\s*["']standalone["']/ , `${name} must emit a standalone server`);
    assert.match(config, /outputFileTracingRoot:\s*path\.resolve\(process\.cwd\(\), "\.\.\/\.\."\)/, `${name} must trace workspace dependencies`);
  }
});

test("Next.js builds need no external font fetch and disable build telemetry", () => {
  assert.match(dockerfile, /ENV NEXT_TELEMETRY_DISABLED=1/);
  for (const [name, layout, fontFallbacks] of [["admin", adminLayout, adminFontFallbacks], ["storefront", storefrontLayout, storefrontFontFallbacks]]) {
    assert.doesNotMatch(layout, /next\/font\/(google|local)/, `${name} build must not fetch fonts from external services`);
    assert.match(layout, /font-fallbacks\.css/, `${name} must load its local system font stack`);
    assert.match(fontFallbacks, /--font-plus-jakarta:\s*["']Segoe UI["']/);
    assert.match(fontFallbacks, /--font-inter:\s*Arial/);
  }
});

test("Docker build context excludes credentials and generated files", () => {
  for (const entry of [".env", ".env.*", ".bazionweb", ".git", ".github", "**/node_modules", "**/.next", ".private-archives", "*.log"]) {
    assert.ok(dockerignore.split(/\r?\n/).includes(entry), `missing Docker ignore rule ${entry}`);
  }
});

test("successful main CI publishes SHA-addressed images with isolated BuildKit caches", () => {
  assert.match(ciWorkflow, /publish-container-images:[\s\S]{0,200}needs: validate/);
  assert.match(ciWorkflow, /if: github\.ref == 'refs\/heads\/main'/);
  for (const [target, image] of [
    ["api", "api"],
    ["admin", "admin"],
    ["storefront", "storefront"],
    ["migrate", "migrate"],
    ["database", "db"],
    ["notification-worker", "notification-worker"],
    ["platform-bootstrap", "bootstrap"],
  ]) {
    assert.match(ciWorkflow, new RegExp(`target: ${target}\\b`), `missing ${target} image target`);
    assert.match(ciWorkflow, new RegExp(`image: ${image}\\b`), `missing ${image} registry image`);
  }
  assert.match(ciWorkflow, /type=sha,prefix=sha-/);
  assert.match(ciWorkflow, /cache-from: type=gha,scope=bazion-platform-\$\{\{ matrix\.image \}\}/);
  assert.match(ciWorkflow, /cache-to: type=gha,scope=bazion-platform-\$\{\{ matrix\.image \}\},mode=max/);
  assert.match(ciWorkflow, /packages: write/);
  assert.match(ciWorkflow, /type=raw,value=staging,enable=\{\{is_default_branch\}\}/);
  const publishJob = ciWorkflow.slice(ciWorkflow.indexOf("publish-container-images:"));
  assert.equal([...publishJob.matchAll(/uses: [^\s]+@([a-f0-9]{40})/g)].length, 5, "every publish-job action must be pinned to a full commit SHA");
  assert.match(publishJob, /push: true/);
  assert.match(publishJob, /provenance: mode=max/);
  assert.match(publishJob, /sbom: true/);
});

test("Dokploy staging stack isolates the database, runs migrations before app services, and caps resource use", () => {
  for (const service of ["db", "migrate", "api", "admin", "storefront", "status-worker", "notification-worker", "platform-owner-bootstrap"]) {
    assert.match(stagingCompose, new RegExp(`^  ${service}:\\s*$`, "m"), `missing staging ${service} service`);
  }
  for (const image of ["db", "migrate", "api", "admin", "storefront", "notification-worker", "bootstrap"]) {
    assert.ok(stagingCompose.includes(`image: ghcr.io/bazionweb/bazionwebs-platform-${image}:`), `wrong or missing GHCR image for ${image}`);
  }
  assert.ok(!stagingCompose.includes("ghcr.io/bazionwebs/"), "Compose image owner must match the repository owner used by CI");
  assert.match(stagingCompose, /PLATFORM_IMAGE_TAG:\?Set a validated sha-/);
  assert.match(stagingCompose, /condition: service_completed_successfully/);
  assert.match(stagingCompose, /name: bazion-platform-staging-data\n    internal: true/);
  assert.match(stagingCompose, /name: bazion_platform_staging_pgdata/);
  assert.match(stagingCompose, /com\.bazion\.backup-target: platform-staging/);
  assert.match(stagingCompose, /APP_ENV: staging/);
  assert.match(stagingCompose, /PAYMENT_PROVIDER: mock/);
  assert.match(stagingCompose, /COMMERCIAL_PROVISIONING_WORKER_ENABLED: "false"/);
  assert.match(stagingCompose, /MEDIA_IMAGE_TRANSFORMS_ENABLED: "true"/);
  assert.match(stagingCompose, /SITE_IMAGE_TRANSFORMS_ENABLED: "false"/);
  assert.doesNotMatch(stagingCompose, /^\s+ports:/m, "staging services must not publish container ports directly");
  assert.doesNotMatch(stagingCompose, /container_name:/);
  assert.doesNotMatch(stagingCompose, /docker-entrypoint-initdb\.d/);
  assert.doesNotMatch(stagingCompose, /DOKPLOY_API_KEY/);
  assert.match(stagingCompose, /MEDIA_STORAGE_SECRET_ACCESS_KEY: \$\{R2_SECRET_ACCESS_KEY:/);
  assert.match(stagingCompose, /PLATFORM_CALLBACK_SIGNING_SECRET:\?Set the shared staging callback signing secret/);
  assert.match(stagingCompose, /profiles:\n      - operator-bootstrap/);
  assert.match(stagingCompose, /PLATFORM_ADMIN_CONFIRM_EMAIL: \$\{PLATFORM_ADMIN_CONFIRM_EMAIL:-\}/);
  assert.match(stagingCompose, /MIGRATION_DATABASE_URL: postgres:\/\/bazion_migrator:/);
});

test("staging guide describes both separate stacks and blocks deployment until GHCR images exist", () => {
  assert.match(stagingGuide, /docker-compose\.dokploy\.staging\.yml/);
  assert.match(stagingGuide, /staging-api\.bazionweb\.com/);
  assert.match(stagingGuide, /church-staging\.bazionweb\.com/);
  assert.match(stagingGuide, /locally built image is not available to Dokploy/i);
  assert.doesNotMatch(stagingGuide, /added as a writable workspace|currently outside this workspace/i);
  assert.doesNotMatch(stagingGuide, /This repo's Docker targets cover Platform API\/admin\/storefront only/);
});

test("Better Auth migrations use the locked local CLI and migration-only credentials", async () => {
  const authManifest = JSON.parse(await readFile(new URL("../packages/auth/package.json", import.meta.url), "utf8"));
  const authMigrator = await readFile(new URL("../packages/auth/scripts/migrate.ts", import.meta.url), "utf8");
  assert.equal(authManifest.dependencies["better-auth"], "1.7.17");
  assert.equal(authManifest.devDependencies.auth, authManifest.dependencies["better-auth"]);
  assert.match(authMigrator, /\["exec", "auth", "migrate", "--yes", "--config", "\.\/src\/server\.ts"\]/);
  assert.match(authMigrator, /AUTH_MIGRATION_DATABASE_URL is required/);
  assert.match(authMigrator, /TENANT_RESOLVER_DATABASE_URL: migrationUrl/);
  assert.match(authMigrator, /TENANT_PROVISIONER_DATABASE_URL: migrationUrl/);
  assert.match(authMigrator, /NOTIFICATION_ENQUEUER_DATABASE_URL: migrationUrl/);
  assert.doesNotMatch(authMigrator, /\bdlx\b|npmCommand|registryCheck/);
});

test("PostgreSQL backup helper selects exactly one labelled DB and validates a restricted dump", () => {
  assert.match(postgresDumpScript, /label=com\.bazion\.backup-target=\$target_label/);
  assert.match(postgresDumpScript, /\$\{#containers\[@\]\} -ne 1/);
  assert.match(postgresDumpScript, /pg_dump[\s\S]*--format=custom/);
  assert.match(postgresDumpScript, /pg_restore --list -/);
  assert.match(postgresDumpScript, /umask 077/);
  assert.doesNotMatch(postgresDumpScript, /PGPASSWORD|--password|echo .*secret/i);
  assert.match(stagingCompose, /com\.bazion\.backup-target: platform-staging/);
  assert.match(stagingGuide, /bazion-docker-postgres-dump\.sh platform-staging bazion_platform bazion_admin/);
  assert.match(stagingGuide, /bazion-docker-postgres-dump\.sh bazionweb-staging bazionweb_staging bazion_admin/);
});

test("PostgreSQL backup helper has valid Bash syntax on the Linux CI runner", { skip: process.platform === "win32" }, () => {
  const scriptPath = fileURLToPath(new URL("../deploy/systemd/bazion-docker-postgres-dump.sh", import.meta.url));
  const result = spawnSync("bash", ["-n", scriptPath], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || "Bash syntax check failed.");
});
