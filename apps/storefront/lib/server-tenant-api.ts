import { cookies, headers } from "next/headers";
import { cache } from "react";

const apiBaseUrl = (process.env.API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");
const publicSiteDataRevalidateSeconds = 30;

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
    const tenantCookie = cookieStore.get("bazion_tenant")?.value;
    const extraHeaders: Record<string, string> = {};
    if (tenantCookie) {
      extraHeaders["x-bazion-tenant"] = tenantCookie;
    }
    return {
      origin: url.origin,
      headers: { "x-forwarded-host": url.host, "x-forwarded-proto": protocol, ...extraHeaders },
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
      // Public content is host-resolved. The forwarded host and explicit tenant
      // selector are part of the fetch cache key, keeping tenants isolated.
      next: { revalidate: publicSiteDataRevalidateSeconds },
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
});
