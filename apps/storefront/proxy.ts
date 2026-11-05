import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * The storefront rewrites /v1/* and /api/auth/* to the shared Fastify API.
 * Replace client-supplied forwarding headers using the original Next request
 * URL so Fastify can resolve the client's verified hostname.
 *
 * This is not an authorization boundary by itself. Fastify accepts these
 * headers only from explicitly configured trusted ingress IPs/CIDRs, and the
 * origin API must not be directly reachable from the public internet.
 */
export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

  // Never forward caller-supplied forwarding metadata.
  requestHeaders.delete("x-forwarded-host");
  requestHeaders.delete("x-forwarded-proto");

  // The hostname/URL is supplied by the incoming request as seen by Next.js.
  requestHeaders.set("x-forwarded-host", request.nextUrl.host);
  requestHeaders.set("x-forwarded-proto", request.nextUrl.protocol.replace(/:$/, ""));

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/v1/:path*", "/api/auth/:path*"],
};
