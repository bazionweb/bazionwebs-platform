import { chmod, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DockerSecretTenantDatabaseSecretResolver,
  tenantDatabaseDockerSecretReference,
} from "./tenant-database-secrets.js";

const tenantId = "11111111-1111-4111-8111-111111111111";
const databaseUrl = "postgres://tenant:very-private@db.example/tenant";
const directories: string[] = [];

async function secretDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "bazion-tenant-db-secrets-"));
  directories.push(directory);
  return directory;
}

async function writeSecret(directory: string, value: unknown) {
  const path = join(directory, `bazion-tenant-db-${tenantId}`);
  await writeFile(path, JSON.stringify(value), { mode: 0o400 });
  await chmod(path, 0o400);
  return path;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("DockerSecretTenantDatabaseSecretResolver", () => {
  it("derives a canonical tenant-scoped reference", () => {
    expect(tenantDatabaseDockerSecretReference(tenantId))
      .toBe(`docker-secret://bazion-tenant-db-${tenantId}`);
    expect(() => tenantDatabaseDockerSecretReference("../another-tenant"))
      .toThrow("TENANT_DATABASE_SECRET_REFERENCE_INVALID");
  });

  it("reads a PostgreSQL URL only from that tenant's mounted secret", async () => {
    const directory = await secretDirectory();
    await writeSecret(directory, { DATABASE_URL: databaseUrl });
    const resolver = new DockerSecretTenantDatabaseSecretResolver(directory);

    await expect(resolver.resolveDatabaseUrl(tenantDatabaseDockerSecretReference(tenantId), tenantId))
      .resolves.toBe(databaseUrl);
  });

  it("rejects a secret reference that names another tenant", async () => {
    const directory = await secretDirectory();
    const resolver = new DockerSecretTenantDatabaseSecretResolver(directory);

    await expect(resolver.resolveDatabaseUrl(
      "docker-secret://bazion-tenant-db-22222222-2222-4222-8222-222222222222",
      tenantId,
    )).rejects.toThrow("TENANT_DATABASE_SECRET_REFERENCE_INVALID");
  });

  it.each([
    { DATABASE_URL: "mysql://tenant:secret@db.example/tenant" },
    { DATABASE_URL: "postgres:///tenant" },
    { DATABASE_URL: " postgres://tenant:secret@db.example/tenant" },
    { DATABASE_URL: "postgres://tenant:secret@db.example/tenant\n" },
    { DATABASE_URL: databaseUrl, EXTRA: "unexpected" },
    { DATABASE_URL: "postgres://tenant:secret@db.example/tenant", PASSWORD: "secret" },
    [],
  ])("rejects malformed secret content", async (content) => {
    const directory = await secretDirectory();
    await writeSecret(directory, content);
    const resolver = new DockerSecretTenantDatabaseSecretResolver(directory);

    await expect(resolver.resolveDatabaseUrl(tenantDatabaseDockerSecretReference(tenantId), tenantId))
      .rejects.toThrow("TENANT_DATABASE_SECRET_INVALID");
  });

  it("does not expose secret contents in unavailable errors", async () => {
    const directory = await secretDirectory();
    const resolver = new DockerSecretTenantDatabaseSecretResolver(directory);

    await expect(resolver.resolveDatabaseUrl(tenantDatabaseDockerSecretReference(tenantId), tenantId))
      .rejects.toThrow("TENANT_DATABASE_SECRET_UNAVAILABLE");
    await writeSecret(directory, { DATABASE_URL: databaseUrl });
  });

  it.skipIf(process.platform === "win32")("rejects writable secret files", async () => {
    const directory = await secretDirectory();
    const secretPath = await writeSecret(directory, { DATABASE_URL: databaseUrl });
    await chmod(secretPath, 0o600);
    const resolver = new DockerSecretTenantDatabaseSecretResolver(directory);

    await expect(resolver.resolveDatabaseUrl(tenantDatabaseDockerSecretReference(tenantId), tenantId))
      .rejects.toThrow("TENANT_DATABASE_SECRET_INVALID");
  });

  it.skipIf(process.platform === "win32")("does not follow symbolic links", async () => {
    const directory = await secretDirectory();
    await writeFile(join(directory, "outside"), JSON.stringify({ DATABASE_URL: databaseUrl }), { mode: 0o400 });
    await symlink(join(directory, "outside"), join(directory, `bazion-tenant-db-${tenantId}`));
    const resolver = new DockerSecretTenantDatabaseSecretResolver(directory);

    await expect(resolver.resolveDatabaseUrl(tenantDatabaseDockerSecretReference(tenantId), tenantId))
      .rejects.toThrow("TENANT_DATABASE_SECRET_UNAVAILABLE");
  });
});
