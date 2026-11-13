import { chmod, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTenantHostingSecretResolverFromEnv,
  DockerSecretTenantHostingSecretResolver,
  HttpSecretManagerClient,
  SecretManagerTenantHostingSecretResolver,
  tenantHostingDockerSecretReference,
  tenantHostingSecretManagerPath,
  tenantHostingSecretReference,
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

  it.skipIf(process.platform === "win32")("does not follow symbolic links when reading mounted secrets", async () => {
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

describe("SecretManagerTenantHostingSecretResolver", () => {
  it("resolves tenant-prefixed secrets with version pinning, TTL cache, and strict env validation", async () => {
    const getSecretValue = vi.fn(async () =>
      JSON.stringify({
        APP_IMAGE: "ghcr.io/example/shop:2.0.1",
        DATABASE_URL: "postgres://tenant:secret@db/tenant",
      }),
    );

    const resolver = createTenantHostingSecretResolverFromEnv(
      {
        HOSTING_SECRET_BACKEND: "secret-manager",
        HOSTING_SECRET_MANAGER_PREFIX: "prod-tenants",
        HOSTING_SECRET_MANAGER_VERSION: "v3",
        HOSTING_SECRET_CACHE_TTL_MS: "5000",
      } as NodeJS.ProcessEnv,
      { getSecretValue },
    );

    expect(resolver).toBeInstanceOf(SecretManagerTenantHostingSecretResolver);
    const ref = `secret-manager://bazion-hosting-${tenantId}-node-nextjs`;
    const first = await resolver.resolveEnvironment(ref);
    const second = await resolver.resolveEnvironment(ref);

    expect(first).toEqual({
      APP_IMAGE: "ghcr.io/example/shop:2.0.1",
      DATABASE_URL: "postgres://tenant:secret@db/tenant",
    });
    expect(second).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(getSecretValue).toHaveBeenCalledTimes(1);
    expect(getSecretValue).toHaveBeenCalledWith(
      tenantHostingSecretManagerPath(tenantId, "node-nextjs", "prod-tenants"),
      "v3",
    );
    expect(() => tenantHostingSecretManagerPath(tenantId, "node-nextjs", "prod/../other"))
      .toThrow("HOSTING_SECRET_PATH_PREFIX_INVALID");
  });

  it("rejects missing secret-manager client when backend is enabled and invalidates malformed secrets", async () => {
    expect(() =>
      createTenantHostingSecretResolverFromEnv({ HOSTING_SECRET_BACKEND: "secret-manager" } as NodeJS.ProcessEnv),
    ).toThrow("HOSTING_SECRET_MANAGER_CLIENT_REQUIRED");

    const resolver = new SecretManagerTenantHostingSecretResolver({
      client: { getSecretValue: async () => null },
    });
    await expect(
      resolver.resolveEnvironment(tenantHostingDockerSecretReference(tenantId, "node-nextjs")),
    ).rejects.toThrow("HOSTING_SECRET_UNAVAILABLE");
  });

  it("normalizes broker failures without leaking upstream response details", async () => {
    const resolver = new SecretManagerTenantHostingSecretResolver({
      client: { getSecretValue: async () => { throw new Error("private broker response detail"); } },
    });
    await expect(resolver.resolveEnvironment(tenantHostingDockerSecretReference(tenantId, "node-nextjs")))
      .rejects.toMatchObject({ message: "HOSTING_SECRET_UNAVAILABLE" });
  });

  it("builds references by backend and creates HttpSecretManagerClient from env", async () => {
    const tenantId = "11111111-1111-4111-8111-111111111111";
    expect(tenantHostingSecretReference(tenantId, "node-nextjs", "docker")).toBe(
      `docker-secret://bazion-hosting-${tenantId}-node-nextjs`,
    );
    expect(tenantHostingSecretReference(tenantId, "node-nextjs", "secret-manager")).toBe(
      `secret-manager://bazion-hosting-${tenantId}-node-nextjs`,
    );

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string> | undefined;
      expect(headers?.Authorization).toBe("Bearer dev-token");
      return new Response(
        JSON.stringify({
          data: {
            data: {
              APP_IMAGE: "ghcr.io/bazion/church-site:1.2.0",
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const resolver = createTenantHostingSecretResolverFromEnv({
        NODE_ENV: "development",
        HOSTING_SECRET_BACKEND: "secret-manager",
        HOSTING_SECRET_MANAGER_URL: "http://127.0.0.1:8200",
        HOSTING_SECRET_MANAGER_TOKEN: "dev-token",
        HOSTING_SECRET_MANAGER_PREFIX: "bazion/prod/hosting",
        HOSTING_SECRET_MANAGER_VERSION: "latest",
      });

      expect(resolver).toBeInstanceOf(SecretManagerTenantHostingSecretResolver);
      await expect(
        resolver.resolveEnvironment(tenantHostingSecretReference(tenantId, "node-nextjs", "secret-manager")),
      ).resolves.toEqual({
        APP_IMAGE: "ghcr.io/bazion/church-site:1.2.0",
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }

    // secretString payload format
    const stringClient = new HttpSecretManagerClient({
      baseUrl: "https://secrets.internal:8200",
      authToken: "prod-token",
      fetchImpl: async () =>
        new Response(JSON.stringify({ secretString: JSON.stringify({ APP_IMAGE: "ghcr.io/bazion/app:1.0.0" }) }), {
          status: 200,
        }),
    });
    await expect(stringClient.getSecretValue("bazion/hosting/t1/app")).resolves.toBe(
      JSON.stringify({ APP_IMAGE: "ghcr.io/bazion/app:1.0.0" }),
    );

    // non-HTTPS non-loopback rejected
    expect(
      () =>
        new HttpSecretManagerClient({
          baseUrl: "http://secrets.internal:8200",
          authToken: "prod-token",
        }),
    ).toThrow("SECRET_MANAGER_URL_INVALID");
  });
});
