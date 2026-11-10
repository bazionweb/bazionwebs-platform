import type { MetadataRoute } from "next";
import { getTenantRequestContext } from "../lib/server-tenant-api";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tenantContext = await getTenantRequestContext();
  const baseUrl = tenantContext?.origin ?? process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!baseUrl) return [];

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/visit`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/ministries`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/gallery`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/sermons`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/events`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/give`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];

  const apiBaseUrl = (process.env.API_BASE_URL ?? baseUrl).replace(/\/$/, "");
  const tenantHeaders = tenantContext?.headers ?? {
    "x-forwarded-host": new URL(baseUrl).host,
    "x-forwarded-proto": new URL(baseUrl).protocol.slice(0, -1),
  };
  const [sermonItems, eventItems] = await Promise.all([
    fetch(`${apiBaseUrl}/v1/public/church/sermons?limit=100`, { headers: tenantHeaders, cache: "no-store" })
      .then(async (response) => response.ok ? (await response.json() as { items?: Array<{ slug: string; publishedAt: string | null }> }).items ?? [] : [])
      .catch(() => []),
    fetch(`${apiBaseUrl}/v1/public/church/events?filter=all&limit=50`, { headers: tenantHeaders, cache: "no-store" })
      .then(async (response) => response.ok ? (await response.json() as { events?: Array<{ slug: string; startsAt: string }> }).events ?? [] : [])
      .catch(() => []),
  ]);
  const contentRoutes: MetadataRoute.Sitemap = [
    ...sermonItems.map((sermon) => ({
      url: `${baseUrl}/sermons/${encodeURIComponent(sermon.slug)}`,
      lastModified: sermon.publishedAt ? new Date(sermon.publishedAt) : new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...eventItems.map((event) => ({
      url: `${baseUrl}/events/${encodeURIComponent(event.slug)}`,
      lastModified: new Date(event.startsAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];

  return [...staticRoutes, ...contentRoutes];
}
