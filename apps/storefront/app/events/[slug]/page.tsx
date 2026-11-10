import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventDetail } from "./event-detail";
import { fetchTenantPublicData, getTenantRequestContext } from "../../../lib/server-tenant-api";
import { isTenantWebsitePageEnabled } from "../../../lib/server-site-pages";

interface PublicEventResponse {
  event?: { title?: string; description?: string | null; posterUrl?: string | null } | null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  if (!await isTenantWebsitePageEnabled("events")) return { title: "Page not available", robots: { index: false, follow: false } };
  const { slug } = await params;
  const [result, tenantContext] = await Promise.all([
    fetchTenantPublicData<PublicEventResponse>(`/v1/public/church/events/${encodeURIComponent(slug)}`),
    getTenantRequestContext(),
  ]);
  const event = result?.event;
  if (!event) return { title: "Event details", description: "Event information and registration." };
  const title = event.title || "Event details";
  const description = (event.description || `${title} event information and registration.`).slice(0, 320);
  const metadata: Metadata = {
    title,
    description,
    ...(tenantContext ? { alternates: { canonical: `${tenantContext.origin}/events/${encodeURIComponent(slug)}` } } : {}),
    openGraph: { type: "article", title, description },
  };
  if (event.posterUrl) {
    try {
      const image = new URL(event.posterUrl);
      if (image.protocol === "https:") metadata.openGraph = { ...metadata.openGraph, images: [image.toString()] };
    } catch { /* Omit an invalid or non-HTTPS event image from social metadata. */ }
  }
  return metadata;
}

export default async function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!await isTenantWebsitePageEnabled("events")) notFound();
  const { slug } = await params;
  return <EventDetail slug={slug} />;
}
