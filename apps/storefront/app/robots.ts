import type { MetadataRoute } from "next";
import { getTenantRequestContext } from "../lib/server-tenant-api";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const tenantContext = await getTenantRequestContext();
  const baseUrl = tenantContext?.origin ?? process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/workspace", "/accept-invitation", "/api/"],
      },
    ],
    ...(baseUrl ? { sitemap: `${baseUrl}/sitemap.xml` } : {}),
  };
}
