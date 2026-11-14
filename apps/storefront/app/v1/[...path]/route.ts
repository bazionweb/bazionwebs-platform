import type { NextRequest } from "next/server";
import { extractTenantSlugFromHost } from "@bazion/auth";

export const dynamic = "force-dynamic";

const PRIMARY_API_BASE_URL = (process.env.API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");
const DEV_FALLBACK_API_BASE_URL = "http://localhost:4000";

const FORWARDED_REQUEST_HEADERS = [
  "cookie",
  "authorization",
  "content-type",
  "idempotency-key",
  "x-donation-status-token",
  "x-payment-status-token",
  "x-requested-with",
  "origin",
  "referer",
  "sec-fetch-site",
  "accept",
] as const;

function extractTenantFromReferer(refererHeader: string | null): string | null {
  if (!refererHeader) return null;
  try {
    const refererUrl = new URL(refererHeader);
    const fromQuery = refererUrl.searchParams.get("tenant")?.trim().toLowerCase();
    if (fromQuery) return fromQuery;
    return extractTenantSlugFromHost(refererUrl.hostname, process.env.PUBLIC_STOREFRONT_URL);
  } catch {
    return null;
  }
}

function resolveProxyTenantSlug(request: NextRequest, incomingHost: string): string | null {
  const fromHost = extractTenantSlugFromHost(incomingHost, process.env.PUBLIC_STOREFRONT_URL);
  if (fromHost) return fromHost;

  const fromQuery = request.nextUrl.searchParams.get("tenant")?.trim().toLowerCase();
  if (fromQuery) return fromQuery;

  const fromHeader = request.headers.get("x-bazion-tenant")?.trim().toLowerCase();
  if (fromHeader) return fromHeader;

  const fromReferer = extractTenantFromReferer(request.headers.get("referer"));
  if (fromReferer) return fromReferer;

  const fromCookie = request.cookies.get("bazion_tenant")?.value?.trim().toLowerCase();
  return fromCookie || null;
}

async function handleProxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  const targetPath = `/v1/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;

  const incomingHost =
    request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim()
    || request.headers.get("host")?.trim()
    || request.nextUrl.host;
  const rawProto =
    request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim()
    || request.nextUrl.protocol.replace(/:$/, "");

  const forwardHeaders = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) forwardHeaders.set(name, value);
  }
  forwardHeaders.set("x-forwarded-host", incomingHost);
  forwardHeaders.set("x-forwarded-proto", rawProto);

  const tenantSlug = resolveProxyTenantSlug(request, incomingHost);
  if (tenantSlug) {
    forwardHeaders.set("x-bazion-tenant", tenantSlug);
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const bodyBuffer = hasBody ? await request.arrayBuffer() : undefined;

  const forwardOnce = (baseUrl: string) =>
    fetch(`${baseUrl}${targetPath}`, {
      method: request.method,
      headers: forwardHeaders,
      ...(hasBody && bodyBuffer && bodyBuffer.byteLength > 0 ? { body: bodyBuffer } : {}),
      cache: "no-store",
      redirect: "manual",
    });

  let upstream: Response;
  try {
    upstream = await forwardOnce(PRIMARY_API_BASE_URL);
  } catch (error) {
    if (process.env.NODE_ENV !== "production" && PRIMARY_API_BASE_URL !== DEV_FALLBACK_API_BASE_URL) {
      upstream = await forwardOnce(DEV_FALLBACK_API_BASE_URL);
    } else {
      const message = error instanceof Error ? error.message : "Upstream API request failed.";
      return Response.json({ error: "API_UNREACHABLE", message }, { status: 502 });
    }
  }

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) responseHeaders.set("content-type", contentType);
  const cacheControl = upstream.headers.get("cache-control");
  if (cacheControl) responseHeaders.set("cache-control", cacheControl);
  const location = upstream.headers.get("location");
  if (location) responseHeaders.set("location", location);
  const setCookies = upstream.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookies) {
    responseHeaders.append("set-cookie", cookie);
  }

  const responseBody = [204, 205, 304].includes(upstream.status)
    ? null
    : await upstream.arrayBuffer();

  return new Response(responseBody, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
export const OPTIONS = handleProxy;

