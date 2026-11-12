import { describe, expect, it, vi } from "vitest";
import type { TenantHostingSecretResolver } from "@bazion/platform-contracts";
import { DokployComposeProvider } from "./index.js";

const reference = {
  provider: "dokploy",
  resourceId: "compose-123",
  tenantId: "tenant-1" as never,
  createdAt: "2026-11-11T00:00:00.000Z",
};

function setup(handler: (url: URL, init: RequestInit) => Response) {
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(new URL(input.toString()), init ?? {}));
  const secrets: TenantHostingSecretResolver = {
    resolveEnvironment: vi.fn(async () => ({ DATABASE_URL: "postgres://private", APP_KEY: "secret" })),
  };
  return {
    provider: new DokployComposeProvider({
      baseUrl: "https://server.example.test",
      apiKey: "never-log-this",
      environmentId: "environment-1",
      fetch: fetch as typeof globalThis.fetch,
    }, secrets),
    fetch,
    secrets,
  };
}

describe("DokployComposeProvider", () => {
  it("creates a tenant-scoped compose resource and injects resolved env without returning secrets", async () => {
    const calls: Array<{ url: URL; init: RequestInit }> = [];
    const { provider, secrets } = setup((url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ composeId: "compose-123" }), { status: 200 });
    });

    const result = await provider.provision({
      tenantId: "tenant-1" as never,
      tenantSlug: "acme-shop",
      template: "ecommerce",
      composeFile: "services:\n  app:\n    image: example/app:1.0.0",
      environmentSecretRef: "secret://tenant-1/runtime",
    });

    expect(result.resourceId).toBe("compose-123");
    expect(JSON.stringify(result)).not.toContain("postgres://private");
    expect(secrets.resolveEnvironment).toHaveBeenCalledWith("secret://tenant-1/runtime");
    expect(calls[0]?.url.pathname).toBe("/api/compose.create");
    expect(calls[1]?.url.pathname).toBe("/api/compose.saveEnvironment");
    expect(JSON.parse(String(calls[1]?.init.body)).env).toContain("DATABASE_URL=postgres://private");
    expect((calls[0]?.init.headers as Record<string, string>)?.["x-api-key"]).toBe("never-log-this");
  });

  it("deploys without recreating persistent volumes", async () => {
    const { provider, fetch } = setup(() => new Response("{}", { status: 200 }));
    await provider.deploy(reference);
    const body = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body));
    expect(body).toEqual({ composeId: "compose-123", freshVolumes: false });
  });

  it("stops the verified compose application without deleting it", async () => {
    const { provider, fetch } = setup(() => new Response("{}", { status: 200 }));
    await provider.stop(reference);
    expect(new URL(fetch.mock.calls[0]?.[0]?.toString() ?? "https://invalid").pathname)
      .toBe("/api/compose.stop");
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({ composeId: "compose-123" });
  });

  it("preserves volumes when removing a tenant resource", async () => {
    const { provider, fetch } = setup(() => new Response("{}", { status: 200 }));
    await provider.remove(reference);
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      composeId: "compose-123",
      deleteVolumes: false,
    });
  });

  it("does not leak provider response bodies in errors", async () => {
    const { provider } = setup(() => new Response("secret token leaked by provider", { status: 403 }));
    await expect(provider.deploy(reference)).rejects.toThrow("DOKPLOY_HTTP_403");
    await expect(provider.deploy(reference)).rejects.not.toThrow("secret token");
  });

  it("rejects insecure endpoints and invalid tenant slugs", async () => {
    const secrets: TenantHostingSecretResolver = { resolveEnvironment: async () => ({}) };
    expect(() => new DokployComposeProvider({
      baseUrl: "http://dokploy.example.test", apiKey: "key", environmentId: "env",
    }, secrets)).toThrow("DOKPLOY_CONFIGURATION_INVALID");

    const { provider } = setup(() => new Response(JSON.stringify({ composeId: "id" }), { status: 200 }));
    await expect(provider.provision({
      tenantId: "tenant-1" as never,
      tenantSlug: "ACME/SHOP",
      template: "wordpress",
      composeFile: "services: {}",
      environmentSecretRef: "secret://tenant-1",
    })).rejects.toThrow("INVALID_TENANT_SLUG");
  });

  it("rejects a compose response whose ID does not match the requested resource", async () => {
    const { provider } = setup(() => new Response(JSON.stringify({
      composeId: "different-resource", environmentId: "environment-1", name: "alpha-node-nextjs",
      composeStatus: "done",
    }), { status: 200 }));
    await expect(provider.inspect(reference)).rejects.toThrow("DOKPLOY_RESOURCE_ID_MISMATCH");
  });

  it("rejects a compose resource from another Dokploy environment", async () => {
    const { provider } = setup(() => new Response(JSON.stringify({
      composeId: "compose-123", environmentId: "another-environment", name: "alpha-node-nextjs",
      composeStatus: "done",
    }), { status: 200 }));
    await expect(provider.inspect(reference)).rejects.toThrow("DOKPLOY_RESOURCE_ENVIRONMENT_MISMATCH");
  });

  it("inspects provider state without exposing the raw response", async () => {
    const { provider } = setup(() => new Response(JSON.stringify({
      composeId: "compose-123", name: "alpha-node-nextjs", appName: "bz-alpha-node-nextjs",
      environmentId: "environment-1", composeStatus: "done", updatedAt: "2026-11-11T01:00:00.000Z",
      env: "SHOULD_NOT_ESCAPE",
    }), { status: 200 }));
    const result = await provider.inspect(reference);
    expect(result.state).toBe("running");
    expect(result.providerResourceName).toBe("alpha-node-nextjs");
    expect(result.providerEnvironmentId).toBe("environment-1");
    expect(JSON.stringify(result)).not.toContain("SHOULD_NOT_ESCAPE");
  });
  it("retries transient read-only inspections and honours Retry-After", async () => {
    let calls = 0;
    const { provider, fetch } = setup(() => {
      calls += 1;
      if (calls === 1) return new Response("temporarily unavailable", {
        status: 503,
        headers: { "retry-after": "0" },
      });
      return new Response(JSON.stringify({
        composeId: "compose-123",
        environmentId: "environment-1",
        composeStatus: "done",
      }), { status: 200 });
    });
    const result = await provider.inspect(reference);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.state).toBe("running");
  });

  it("retries transient GET network failures but does not expose the network error", async () => {
    let calls = 0;
    const { provider, fetch } = setup(() => {
      calls += 1;
      if (calls === 1) throw new Error("socket failed with secret details");
      return new Response(JSON.stringify({
        composeId: "compose-123",
        environmentId: "environment-1",
        composeStatus: "stopped",
      }), { status: 200 });
    });
    const result = await provider.inspect(reference);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.state).toBe("stopped");
  });

  it("does not retry non-transient read errors", async () => {
    const { provider, fetch } = setup(() => new Response("not found", { status: 404 }));
    await expect(provider.inspect(reference)).rejects.toThrow("DOKPLOY_HTTP_404");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("never retries resource creation or deployment POSTs after transient errors", async () => {
    const create = setup(() => new Response("temporarily unavailable", { status: 503 }));
    await expect(create.provider.provision({
      tenantId: "tenant-1" as never,
      tenantSlug: "acme-shop",
      template: "ecommerce",
      composeFile: "services: {}",
      environmentSecretRef: "secret://tenant-1/runtime",
    })).rejects.toThrow("DOKPLOY_HTTP_503");
    expect(create.fetch).toHaveBeenCalledTimes(1);

    const deploy = setup(() => new Response("temporarily unavailable", { status: 503 }));
    await expect(deploy.provider.deploy(reference)).rejects.toThrow("DOKPLOY_HTTP_503");
    expect(deploy.fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects unsafe read retry configuration", () => {
    const secrets: TenantHostingSecretResolver = { resolveEnvironment: async () => ({}) };
    expect(() => new DokployComposeProvider({
      baseUrl: "https://server.example.test",
      apiKey: "key",
      environmentId: "environment-1",
      readRetryAttempts: 6,
    }, secrets)).toThrow("DOKPLOY_RETRY_CONFIGURATION_INVALID");
  });

});
