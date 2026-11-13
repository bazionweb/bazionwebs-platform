import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dockerfile = await readFile(new URL("../Dockerfile", import.meta.url), "utf8");
const dockerignore = await readFile(new URL("../.dockerignore", import.meta.url), "utf8");
const adminConfig = await readFile(new URL("../apps/admin/next.config.ts", import.meta.url), "utf8");
const storefrontConfig = await readFile(new URL("../apps/storefront/next.config.ts", import.meta.url), "utf8");
const adminLayout = await readFile(new URL("../apps/admin/app/layout.tsx", import.meta.url), "utf8");
const storefrontLayout = await readFile(new URL("../apps/storefront/app/layout.tsx", import.meta.url), "utf8");
const ciWorkflow = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

test("Dockerfile provides a production target for each platform app and a one-shot migration target", () => {
  for (const target of ["api", "admin", "storefront", "storefront-test", "migrate"]) {
    assert.match(dockerfile, new RegExp(`AS ${target}\\b`), `missing ${target} target`);
  }
  assert.match(dockerfile, /pnpm --filter @bazion\/api --prod deploy \/out/);
  assert.match(dockerfile, /pnpm install --frozen-lockfile --filter @bazion\/api\.\.\./);
  assert.match(dockerfile, /CMD \["pnpm", "--filter", "@bazion\/database", "migrate"\]/);
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

test("Next.js builds bundle self-hosted fonts and disable build telemetry", () => {
  assert.match(dockerfile, /ENV NEXT_TELEMETRY_DISABLED=1/);
  for (const [name, layout] of [["admin", adminLayout], ["storefront", storefrontLayout]]) {
    assert.match(layout, /from "next\/font\/google"/, `${name} must self-host its font assets`);
    assert.doesNotMatch(layout, /fonts\.googleapis\.com|fonts\.gstatic\.com/, `${name} must not add browser font network requests`);
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
  for (const image of ["api", "admin", "storefront", "migrate"]) {
    assert.match(ciWorkflow, new RegExp(`target: ${image}\\b`), `missing published ${image} image`);
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
