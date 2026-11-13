import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SermonDetail } from "./sermon-detail";
import { fetchTenantPublicData, getTenantRequestContext } from "../../../lib/server-tenant-api";
import { isTenantWebsitePageEnabled } from "../../../lib/server-site-pages";

interface PublicSermonResponse {
  sermon?: { title?: string; speaker?: string; description?: string | null; youtubeVideoId?: string | null } | null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  if (!await isTenantWebsitePageEnabled("sermons")) return { title: "Page not available", robots: { index: false, follow: false } };
  const { slug } = await params;
  const [result, tenantContext] = await Promise.all([
    fetchTenantPublicData<PublicSermonResponse>(`/v1/public/church/sermons/${encodeURIComponent(slug)}`),
    getTenantRequestContext(),
  ]);
  const sermon = result?.sermon;
  if (!sermon) return { title: "Sermon", description: "Watch and read a ministry sermon." };
  const title = sermon.title || "Sermon";
  const metadata: Metadata = {
    title,
    description: (sermon.description || `${title}${sermon.speaker ? ` by ${sermon.speaker}` : ""}. Watch and read the sermon.`).slice(0, 320),
    ...(tenantContext ? { alternates: { canonical: `${tenantContext.origin}/sermons/${encodeURIComponent(slug)}` } } : {}),
    openGraph: { type: "video.other", title, description: sermon.description || `${title} sermon.` },
  };
  if (sermon.youtubeVideoId) {
    metadata.openGraph = { ...metadata.openGraph, images: [`https://img.youtube.com/vi/${encodeURIComponent(sermon.youtubeVideoId)}/hqdefault.jpg`] };
  }
  return metadata;
}

export default async function SermonDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!await isTenantWebsitePageEnabled("sermons")) notFound();
  const { slug } = await params;
  return <SermonDetail slug={slug} />;
}
