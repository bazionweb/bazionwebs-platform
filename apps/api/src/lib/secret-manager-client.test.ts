import { describe, expect, it, vi } from "vitest";
import { HttpSecretManagerClient } from "./secret-manager-client.js";

describe("HttpSecretManagerClient", () => {
  it("uses TLS, bearer authentication, a bounded request timeout, and an optional version", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe("GET");
      expect(init?.redirect).toBe("error");
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer secret-reader");
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response(JSON.stringify({ data: { data: { DATABASE_URL: "postgres://tenant:secret@db/tenant" } } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const client = new HttpSecretManagerClient({
      baseUrl: "https://secrets.example.test/",
      authToken: " secret-reader ",
      timeoutMs: 60_000,
      fetchImpl,
    });

    await expect(client.getSecretValue("tenants/11111111-1111-4111-8111-111111111111/database", "v/2"))
      .resolves.toBe(JSON.stringify({ DATABASE_URL: "postgres://tenant:secret@db/tenant" }));
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://secrets.example.test/tenants/11111111-1111-4111-8111-111111111111/database?version=v%2F2",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("allows HTTP only for explicitly permitted loopback development endpoints", () => {
    expect(() => new HttpSecretManagerClient({ baseUrl: "http://secrets.example.test", authToken: "token" }))
      .toThrow("SECRET_MANAGER_URL_INVALID");
    expect(() => new HttpSecretManagerClient({ baseUrl: "http://127.0.0.1:8200", authToken: "token" }))
      .toThrow("SECRET_MANAGER_URL_INVALID");
    expect(new HttpSecretManagerClient({
      baseUrl: "http://127.0.0.1:8200",
      authToken: "token",
      allowInsecureLocalhost: true,
    })).toBeInstanceOf(HttpSecretManagerClient);
  });

  it("rejects credentials in URLs, empty tokens, and unsafe path segments", async () => {
    expect(() => new HttpSecretManagerClient({ baseUrl: "https://user:pass@secrets.example.test", authToken: "token" }))
      .toThrow("SECRET_MANAGER_URL_INVALID");
    expect(() => new HttpSecretManagerClient({ baseUrl: "https://secrets.example.test", authToken: "  " }))
      .toThrow("SECRET_MANAGER_TOKEN_REQUIRED");
    expect(() => new HttpSecretManagerClient({ baseUrl: "not-a-url", authToken: "token" }))
      .toThrow("SECRET_MANAGER_URL_INVALID");
    expect(() => new HttpSecretManagerClient({ baseUrl: "https://secrets.example.test", authToken: "token\nforged" }))
      .toThrow("SECRET_MANAGER_TOKEN_INVALID");

    const client = new HttpSecretManagerClient({
      baseUrl: "https://secrets.example.test",
      authToken: "token",
      fetchImpl: vi.fn(),
    });
    await expect(client.getSecretValue("tenants/../other/database"))
      .rejects.toThrow("SECRET_MANAGER_PATH_INVALID");
  });

  it("returns null for missing secrets and hides non-success responses", async () => {
    const missing = new HttpSecretManagerClient({
      baseUrl: "https://secrets.example.test",
      authToken: "token",
      fetchImpl: async () => new Response(null, { status: 404 }),
    });
    await expect(missing.getSecretValue("tenants/tenant/database")).resolves.toBeNull();

    const unavailable = new HttpSecretManagerClient({
      baseUrl: "https://secrets.example.test",
      authToken: "token",
      fetchImpl: async () => new Response("sensitive upstream details", { status: 500 }),
    });
    await expect(unavailable.getSecretValue("tenants/tenant/database")).rejects.toThrow("SECRET_MANAGER_UNAVAILABLE");
  });

  it("rejects oversized secret-manager response bodies before parsing", async () => {
    const client = new HttpSecretManagerClient({
      baseUrl: "https://secrets.example.test",
      authToken: "token",
      fetchImpl: async () => new Response("{}", {
        status: 200,
        headers: { "content-length": "65537" },
      }),
    });
    await expect(client.getSecretValue("tenants/tenant/database"))
      .rejects.toThrow("SECRET_MANAGER_RESPONSE_INVALID");
  });
});
