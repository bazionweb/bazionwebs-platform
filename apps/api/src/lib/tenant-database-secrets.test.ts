import { chmod, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DockerSecretTenantDatabaseSecretResolver,
  createTenantDatabaseSecretResolver,
  tenantDatabaseDockerSecretReference,
  tenantDatabaseSecretManagerPath,
  tenantDatabaseSecretManagerReference,
  SecretManagerTenantDatabaseSecretResolver,
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
    { DATABASE_URL: "postgres://tenant:secret@db.example" },
    { DATABASE_URL: "postgres://tenant:secret@db.example/tenant#fragment" },
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

describe("SecretManagerTenantDatabaseSecretResolver", () => {
  it("builds the configured Docker or production Secret Manager adapter", () => {
    expect(createTenantDatabaseSecretResolver({
      backend: "docker",
      secretDirectory: "C:/secrets",
    })).toBeInstanceOf(DockerSecretTenantDatabaseSecretResolver);
    expect(createTenantDatabaseSecretResolver({
      backend: "secret-manager",
      secretDirectory: "C:/secrets",
      secretManagerUrl: "https://secrets.example.test",
      secretManagerToken: "read-only-token",
    })).toBeInstanceOf(SecretManagerTenantDatabaseSecretResolver);
    expect(() => createTenantDatabaseSecretResolver({
      backend: "secret-manager",
      secretDirectory: "C:/secrets",
    })).toThrow("TENANT_DATABASE_SECRET_MANAGER_CLIENT_REQUIRED");
    expect(() => createTenantDatabaseSecretResolver({
      backend: "secret-manager",
      secretDirectory: "C:/secrets",
      secretManagerUrl: "http://secrets.example.test",
      secretManagerToken: "read-only-token",
    })).toThrow("SECRET_MANAGER_URL_INVALID");
  });

  it("resolves and caches a versioned secret at the tenant-scoped database path", async () => {
    const getSecretValue = vi.fn(async () => JSON.stringify({ DATABASE_URL: databaseUrl }));
    const resolver = new SecretManagerTenantDatabaseSecretResolver({
      client: { getSecretValue },
      pathPrefix: "/prod/tenant-secrets/",
      secretVersion: "v2",
      cacheTtlMs: 5_000,
    });
    const reference = tenantDatabaseSecretManagerReference(tenantId);

    await expect(resolver.resolveDatabaseUrl(reference, tenantId)).resolves.toBe(databaseUrl);
    await expect(resolver.resolveDatabaseUrl(reference, tenantId)).resolves.toBe(databaseUrl);
    expect(getSecretValue).toHaveBeenCalledTimes(1);
    expect(getSecretValue).toHaveBeenCalledWith(
      tenantDatabaseSecretManagerPath(tenantId, "prod/tenant-secrets"),
      "v2",
    );
  });

  it("requires the reference tenant and requested tenant to match", async () => {
    const getSecretValue = vi.fn(async () => JSON.stringify({ DATABASE_URL: databaseUrl }));
    const resolver = new SecretManagerTenantDatabaseSecretResolver({ client: { getSecretValue } });

    await expect(resolver.resolveDatabaseUrl(
      "secret-manager://bazion-tenant-db-22222222-2222-4222-8222-222222222222",
      tenantId,
    )).rejects.toThrow("TENANT_DATABASE_SECRET_REFERENCE_INVALID");
    expect(getSecretValue).not.toHaveBeenCalled();
  });

  it("rejects unsafe path prefixes and invalid database URLs without exposing secret data", async () => {
    expect(() => tenantDatabaseSecretManagerPath(tenantId, "tenants/../other"))
      .toThrow("TENANT_DATABASE_SECRET_PREFIX_INVALID");

    const resolver = new SecretManagerTenantDatabaseSecretResolver({
      client: { getSecretValue: async () => JSON.stringify({ DATABASE_URL: "mysql://private:value@db/tenant" }) },
    });
    await expect(resolver.resolveDatabaseUrl(tenantDatabaseSecretManagerReference(tenantId), tenantId))
      .rejects.toMatchObject({ message: "TENANT_DATABASE_SECRET_INVALID" });
  });

  it("normalizes broker failures and missing values without returning provider details", async () => {
    const failedResolver = new SecretManagerTenantDatabaseSecretResolver({
      client: { getSecretValue: async () => { throw new Error("sensitive broker response"); } },
    });
    const missingResolver = new SecretManagerTenantDatabaseSecretResolver({
      client: { getSecretValue: async () => null },
    });
    const reference = tenantDatabaseSecretManagerReference(tenantId);

    await expect(failedResolver.resolveDatabaseUrl(reference, tenantId))
      .rejects.toThrow("TENANT_DATABASE_SECRET_UNAVAILABLE");
    await expect(missingResolver.resolveDatabaseUrl(reference, tenantId))
      .rejects.toThrow("TENANT_DATABASE_SECRET_UNAVAILABLE");
  });
});
