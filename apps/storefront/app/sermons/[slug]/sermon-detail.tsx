"use client";

import { useEffect, useState } from "react";
import { ChurchFooter, ChurchNav, PageHero } from "@bazion/ui";
import { useMinistrySite } from "../../../lib/use-ministry-site";

interface Sermon {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  speaker: string;
  youtubeVideoId: string | null;
  scriptureReference: string | null;
  category: string | null;
  notesJson: unknown;
  publishedAt: string | null;
  createdAt: string;
}

export function SermonDetail({ slug }: { slug: string }) {
  const site = useMinistrySite();
  const [sermon, setSermon] = useState<Sermon | null>(null);
  const [related, setRelated] = useState<Sermon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/v1/public/church/sermons/${encodeURIComponent(slug)}`)
      .then(async (response) => {
        if (response.status === 404) throw new Error("This sermon is not available.");
        if (!response.ok) throw new Error("Could not load the sermon.");
        return response.json() as Promise<{ sermon: Sermon; related: Sermon[] }>;
      })
      .then((data) => { if (active) { setSermon(data.sermon); setRelated(data.related); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load the sermon."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  const date = sermon ? new Date(sermon.publishedAt ?? sermon.createdAt).toLocaleDateString("en-KE", { dateStyle: "long", timeZone: "Africa/Nairobi" }) : "";
  const notes = Array.isArray(sermon?.notesJson) ? sermon.notesJson.filter((note): note is string => typeof note === "string") : [];
  const videoJsonLd = sermon?.youtubeVideoId ? JSON.stringify({
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: sermon.title,
    description: sermon.description || `${sermon.title} by ${sermon.speaker}.`,
    thumbnailUrl: [`https://img.youtube.com/vi/${encodeURIComponent(sermon.youtubeVideoId)}/hqdefault.jpg`],
    uploadDate: sermon.publishedAt ?? sermon.createdAt,
    embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(sermon.youtubeVideoId)}`,
    publisher: { "@type": "Organization", name: site.ministryName },
  }).replace(/</g, "\\u003c") : null;
  useEffect(() => {
    if (sermon) document.title = `${sermon.title} | ${site.ministryName}`;
  }, [sermon, site.ministryName]);

  return <>
    <ChurchNav ministryName={site.ministryName} logoUrl={site.branding.logoUrl} links={site.navigation} currentPath="/sermons" giveHref={site.pages.some((page) => page.id === "giving" && page.enabled) ? "/give" : null} />
    {loading ? <main id="main-content" className="ch-section ch-container"><p role="status">Loading sermon…</p></main>
      : !sermon ? <main id="main-content" className="ch-section ch-container"><h1>Sermon unavailable</h1><p role="alert">{error || "This sermon is not available."}</p><a className="ch-btn ch-btn-outline" href="/sermons">Browse sermons</a></main>
        : <main id="main-content">
          {videoJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: videoJsonLd }} />}
          <PageHero eyebrow={sermon.category ? `SERMON • ${sermon.category.toUpperCase()}` : "SERMON ARCHIVE"} title={sermon.title} subtitle={`Preached by ${sermon.speaker}${date ? ` • ${date}` : ""}`} bgImageUrl={site.branding.heroBgUrl} />
          <article className="ch-section"><div className="ch-container" style={{ maxWidth: 900 }}>
            {sermon.youtubeVideoId ? <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: "var(--church-radius-lg)", overflow: "hidden", marginBottom: 32 }}><iframe src={`https://www.youtube.com/embed/${encodeURIComponent(sermon.youtubeVideoId)}`} title={sermon.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div> : <p>Video details have not been published for this sermon.</p>}
            {sermon.scriptureReference && <p className="ch-sermon-scripture"><strong>Scripture:</strong> {sermon.scriptureReference}</p>}
            {sermon.description && <section><h2>Message overview</h2><p style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>{sermon.description}</p></section>}
            {notes.length > 0 && <section className="ch-card"><div className="ch-card-body"><h2>Study notes</h2><ul>{notes.map((note, index) => <li key={`${index}-${note}`}>{note}</li>)}</ul></div></section>}
            <p><a className="ch-btn ch-btn-outline" href="/sermons">← Back to sermons</a>{sermon.youtubeVideoId && <> <a className="ch-btn ch-btn-accent" href={`https://www.youtube.com/watch?v=${encodeURIComponent(sermon.youtubeVideoId)}`} target="_blank" rel="noopener noreferrer">Watch on YouTube ↗</a></>}</p>
            {related.length > 0 && <section style={{ marginTop: 56 }}><h2>More sermons</h2><div className="ch-grid-3">{related.map((item) => <article className="ch-card" key={item.id}><div className="ch-card-body"><span className="ch-sermon-badge">{item.category ?? "Sermon"}</span><h3><a href={`/sermons/${item.slug}`}>{item.title}</a></h3><p>By {item.speaker}</p></div></article>)}</div></section>}
          </div></article>
        </main>}
    <ChurchFooter ministryName={site.ministryName} tagline={site.tagline} phoneNumbers={site.contact.phones} email={site.contact.email} address={site.contact.address} />
  </>;
}
