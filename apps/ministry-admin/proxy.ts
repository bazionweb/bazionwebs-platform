import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { extractTenantSlugFromHost } from "@bazion/auth";

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

  const incomingHost =
    request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim()
    || request.headers.get("host")?.trim()
    || request.nextUrl.host;

  requestHeaders.delete("x-forwarded-host");
  requestHeaders.delete("x-forwarded-proto");

  requestHeaders.set("x-forwarded-host", incomingHost);
  requestHeaders.set("x-forwarded-proto", request.nextUrl.protocol.replace(/:$/, ""));

  const subdomainSlug = extractTenantSlugFromHost(incomingHost, process.env.PUBLIC_STOREFRONT_URL);
  const explicitQueryTenant = request.nextUrl.searchParams.get("tenant")?.trim().toLowerCase() || null;
  const cookieTenant = request.cookies.get("bazion_tenant")?.value?.trim().toLowerCase() || null;
  const resolvedTenant = subdomainSlug || explicitQueryTenant || cookieTenant;

  if (resolvedTenant) {
    requestHeaders.set("x-bazion-tenant", resolvedTenant);
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const cookieToPersist = subdomainSlug || explicitQueryTenant;
  if (cookieToPersist) {
    response.cookies.set("bazion_tenant", cookieToPersist, { path: "/", sameSite: "lax" });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

