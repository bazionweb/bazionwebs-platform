import { headers } from "next/headers";
import { cache } from "react";

const apiBaseUrl = (process.env.API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");

export async function getTenantRequestContext(): Promise<{ origin: string; headers: HeadersInit } | null> {
  try {
    const incomingHeaders = await headers();
    const hostHeader = incomingHeaders.get("x-forwarded-host") ?? incomingHeaders.get("host");
    const host = hostHeader?.split(",", 1)[0]?.trim();
    const rawProtocol = incomingHeaders.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
    const protocol = rawProtocol === "http" ? "http" : "https";
    if (!host) return null;
    const url = new URL(`${protocol}://${host}`);
    return {
      origin: url.origin,
      headers: { "x-forwarded-host": url.host, "x-forwarded-proto": protocol },
    };
  } catch {
    return null;
  }
}

/** Fetch public tenant content for server-rendered metadata using the site's incoming host. */
export const fetchTenantPublicData = cache(async function fetchTenantPublicData<T>(path: string): Promise<T | null> {
  try {
    const tenantContext = await getTenantRequestContext();
    if (!tenantContext) return null;
    const response = await fetch(`${apiBaseUrl}${path}`, {
      headers: tenantContext.headers,
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
});
