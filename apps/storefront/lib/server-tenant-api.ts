import { cookies, headers } from "next/headers";
import { cache } from "react";
import { extractTenantSlugFromHost } from "@bazion/auth";

const apiBaseUrl = (process.env.API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");
const devFallbackApiBaseUrl = "http://localhost:4000";

export async function getTenantRequestContext(): Promise<{ origin: string; headers: HeadersInit } | null> {
  try {
    const incomingHeaders = await headers();
    const cookieStore = await cookies();
    const hostHeader = incomingHeaders.get("x-forwarded-host") ?? incomingHeaders.get("host");
    const host = hostHeader?.split(",", 1)[0]?.trim();
    const rawProtocol = incomingHeaders.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
    const protocol = rawProtocol === "http" ? "http" : "https";
    if (!host) return null;
    const url = new URL(`${protocol}://${host}`);
    const subdomainSlug = extractTenantSlugFromHost(url.hostname, process.env.PUBLIC_STOREFRONT_URL);
    const tenantCookie = cookieStore.get("bazion_tenant")?.value?.trim().toLowerCase();
    const tenantSlug = subdomainSlug || tenantCookie;
    const extraHeaders: Record<string, string> = {};
    if (tenantSlug) {
      extraHeaders["x-bazion-tenant"] = tenantSlug;
    }
    return {
      origin: url.origin,
      headers: { "x-forwarded-host": url.host, "x-forwarded-proto": protocol, ...extraHeaders },
    };
  } catch {
    return null;
  }
}

async function fetchFromApi(baseUrl: string, path: string, requestHeaders: HeadersInit): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    headers: requestHeaders,
    cache: "no-store",
    signal: AbortSignal.timeout(3_000),
  });
}

/** Fetch public tenant content for server-rendered metadata using the site's incoming host. */
export const fetchTenantPublicData = cache(async function fetchTenantPublicData<T>(path: string): Promise<T | null> {
  const tenantContext = await getTenantRequestContext();
  if (!tenantContext) return null;

  try {
    const response = await fetchFromApi(apiBaseUrl, path, tenantContext.headers);
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    if (process.env.NODE_ENV !== "production" && apiBaseUrl !== devFallbackApiBaseUrl) {
      try {
        const retry = await fetchFromApi(devFallbackApiBaseUrl, path, tenantContext.headers);
        if (!retry.ok) return null;
        return await retry.json() as T;
      } catch {
        return null;
      }
    }
    return null;
  }
});
