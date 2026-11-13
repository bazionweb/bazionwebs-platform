import { afterEach, describe, expect, it, vi } from "vitest";

const requestHeaders = vi.hoisted(() => new Headers({
  host: "church.example.test",
  "x-forwarded-host": "church.example.test",
  "x-forwarded-proto": "https",
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => requestHeaders),
  cookies: vi.fn(async () => ({ get: vi.fn(() => undefined) })),
}));

import { fetchTenantPublicData } from "./server-tenant-api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("fetchTenantPublicData", () => {
  it("uses a short revalidation window and includes the resolved tenant host", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ name: "Example Church" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchTenantPublicData<{ name: string }>("/v1/public/church/site"))
      .resolves.toEqual({ name: "Example Church" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { next?: { revalidate?: number } }];
    const apiBaseUrl = (process.env.API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");
    expect(url).toBe(`${apiBaseUrl}/v1/public/church/site`);
    expect(new Headers(init.headers).get("x-forwarded-host")).toBe("church.example.test");
    expect(init.next?.revalidate).toBe(30);
    expect(init.cache).toBeUndefined();
  });

  it("returns null when the public API cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("API unavailable"); }));
    await expect(fetchTenantPublicData("/v1/public/church/site")).resolves.toBeNull();
  });
});
