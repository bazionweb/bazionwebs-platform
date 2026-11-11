import { chmod, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DockerSecretTenantHostingSecretResolver,
  tenantHostingDockerSecretReference,
} from "./secrets.js";

const tenantId = "11111111-1111-4111-8111-111111111111";
const directories: string[] = [];

async function secretDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "bazion-hosting-secrets-"));
  directories.push(directory);
  return directory;
}

async function writeSecret(directory: string, template: "wordpress" | "node-nextjs" | "ecommerce", values: Record<string, string>) {
  const name = "bazion-hosting-" + tenantId + "-" + template;
  const path = join(directory, name);
  await writeFile(path, JSON.stringify(values), { mode: 0o400 });
  await chmod(path, 0o400);
  return path;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("DockerSecretTenantHostingSecretResolver", () => {
  it("derives a canonical per-tenant and per-template secret reference", () => {
    expect(tenantHostingDockerSecretReference(tenantId, "wordpress"))
      .toBe("docker-secret://bazion-hosting-" + tenantId + "-wordpress");
    expect(() => tenantHostingDockerSecretReference("../other", "wordpress")).toThrow("HOSTING_SECRET_REFERENCE_INVALID");
  });

  it("loads required variables from a read-only mounted secret without changing their values", async () => {
    const directory = await secretDirectory();
    await writeSecret(directory, "node-nextjs", {
      APP_IMAGE: "ghcr.io/example/shop:1.2.3",
      DATABASE_URL: "postgres://app:very-private@db/shop",
    });
    const resolver = new DockerSecretTenantHostingSecretResolver(directory);

    const values = await resolver.resolveEnvironment(tenantHostingDockerSecretReference(tenantId, "node-nextjs"));

    expect(values).toEqual({
      APP_IMAGE: "ghcr.io/example/shop:1.2.3",
      DATABASE_URL: "postgres://app:very-private@db/shop",
    });
    expect(Object.isFrozen(values)).toBe(true);
  });

  it("rejects placeholder images and mutable latest tags", async () => {
    const directory = await secretDirectory();
    await writeSecret(directory, "node-nextjs", { APP_IMAGE: "ghcr.io/example/shop:latest" });
    const resolver = new DockerSecretTenantHostingSecretResolver(directory);
    await expect(resolver.resolveEnvironment(tenantHostingDockerSecretReference(tenantId, "node-nextjs")))
      .rejects.toThrow("HOSTING_IMAGE_REFERENCE_INVALID");
  });

  it("rejects environment keys that can alter the process or compose runtime", async () => {
    const directory = await secretDirectory();
    await writeSecret(directory, "node-nextjs", {
      APP_IMAGE: "ghcr.io/example/shop:1.2.3",
      PATH: "/tmp/attacker",
    });
    const resolver = new DockerSecretTenantHostingSecretResolver(directory);
    await expect(resolver.resolveEnvironment(tenantHostingDockerSecretReference(tenantId, "node-nextjs")))
      .rejects.toThrow("HOSTING_SECRET_INVALID");
  });

  it("does not follow symbolic links when reading mounted secrets", async () => {
    const directory = await secretDirectory();
    const outside = join(directory, "outside");
    await writeFile(outside, JSON.stringify({ APP_IMAGE: "ghcr.io/example/shop:1.2.3" }), { mode: 0o400 });
    await symlink(outside, join(directory, "bazion-hosting-" + tenantId + "-node-nextjs"));
    const resolver = new DockerSecretTenantHostingSecretResolver(directory);
    await expect(resolver.resolveEnvironment(tenantHostingDockerSecretReference(tenantId, "node-nextjs")))
      .rejects.toThrow("HOSTING_SECRET_UNAVAILABLE");
  });

  it("rejects arbitrary secret references", async () => {
    const resolver = new DockerSecretTenantHostingSecretResolver(await secretDirectory());
    await expect(resolver.resolveEnvironment("env://DATABASE_URL")).rejects.toThrow("HOSTING_SECRET_REFERENCE_INVALID");
  });
});
