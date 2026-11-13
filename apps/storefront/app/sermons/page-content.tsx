"use client";

import { useEffect, useMemo, useState } from "react";
import { ChurchFooter, ChurchNav, CategoryFilter, PageHero, SermonCard, Modal } from "@bazion/ui";
import { useMinistrySite } from "../../lib/use-ministry-site";

interface PublicSermon {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  speaker: string;
  youtubeVideoId: string | null;
  thumbnailUrl: string | null;
  scriptureReference: string | null;
  category: string | null;
  publishedAt: string | null;
  createdAt: string;
}

function sermonDate(sermon: PublicSermon) {
  return new Date(sermon.publishedAt ?? sermon.createdAt).toLocaleDateString("en-KE", { dateStyle: "long", timeZone: "Africa/Nairobi" });
}

export default function SermonsPage() {
  const site = useMinistrySite();
  const [sermons, setSermons] = useState<PublicSermon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [activeVideo, setActiveVideo] = useState<{ title: string; youtubeVideoId?: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/v1/public/church/sermons?limit=100")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load this ministry's sermons.");
        return response.json() as Promise<{ items: PublicSermon[] }>;
      })
      .then((data) => { if (active) setSermons(data.items); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load sermons."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const categories = useMemo(() => ["All", ...Array.from(new Set(sermons.map((sermon) => sermon.category).filter((category): category is string => Boolean(category))))], [sermons]);
  const filteredSermons = sermons.filter((sermon) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesCategory = selectedCategory === "All" || sermon.category === selectedCategory;
    const matchesSearch = !query || [sermon.title, sermon.speaker, sermon.scriptureReference, sermon.description]
      .some((value) => value?.toLowerCase().includes(query));
    return matchesCategory && matchesSearch;
  });
  const featuredSermon = sermons[0];

  return <>
    <ChurchNav ministryName={site.ministryName} logoUrl={site.branding.logoUrl} links={site.navigation} currentPath="/sermons" giveHref={site.pages.some((page) => page.id === "giving" && page.enabled) ? "/give" : null} />
    <main id="main-content">
      <PageHero eyebrow="ONLINE MINISTRY ARCHIVE" title="Sermons & Spiritual" highlightedTitle="Teachings" subtitle="Browse messages published by this ministry." bgImageUrl={site.branding.heroBgUrl} />
      {featuredSermon && <section className="ch-section ch-section-alt"><div className="ch-container">
        <div className="ch-heading-wrap"><span className="ch-eyebrow">Latest Message</span><h2 className="ch-title">{featuredSermon.title}</h2><p className="ch-subtitle">By {featuredSermon.speaker} • {sermonDate(featuredSermon)}{featuredSermon.scriptureReference ? ` • ${featuredSermon.scriptureReference}` : ""}</p></div>
        {featuredSermon.youtubeVideoId ? <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <button
            type="button"
            className="ch-sermon-featured-video"
            aria-label={"Play latest message: " + featuredSermon.title}
            onClick={() => setActiveVideo({ title: featuredSermon.title, youtubeVideoId: featuredSermon.youtubeVideoId ?? undefined })}
          >
            <img
              src={featuredSermon.thumbnailUrl || "https://img.youtube.com/vi/" + encodeURIComponent(featuredSermon.youtubeVideoId) + "/hqdefault.jpg"}
              alt=""
              loading="lazy"
              decoding="async"
            />
            <span className="ch-sermon-featured-play" aria-hidden="true">▶</span>
            <span className="ch-sermon-featured-label" aria-hidden="true">Watch the latest message</span>
          </button>
          {featuredSermon.description && <p style={{ textAlign: "center", lineHeight: 1.7 }}>{featuredSermon.description}</p>}
        </div> : <p className="ch-container">Video details have not been published for this message.</p>}
      </div></section>}
      <section className="ch-section"><div className="ch-container">
        <div style={{ maxWidth: 600, margin: "0 auto 28px" }}><input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by title, speaker or scripture…" aria-label="Search sermons" style={{ width: "100%", padding: 14, borderRadius: "var(--church-radius)", border: "1px solid var(--church-border)" }} /></div>
        {categories.length > 1 && <CategoryFilter categories={categories} activeCategory={selectedCategory} onSelectCategory={setSelectedCategory} />}
        {loading && <p role="status">Loading sermons…</p>}
        {error && <p role="alert">{error}</p>}
        <div className="ch-grid-3">{filteredSermons.map((sermon) => <SermonCard key={sermon.id} id={sermon.id} title={sermon.title} speaker={sermon.speaker} date={sermonDate(sermon)} scriptureReference={sermon.scriptureReference ?? undefined} category={sermon.category ?? undefined} thumbnailUrl={sermon.thumbnailUrl ?? undefined} youtubeVideoId={sermon.youtubeVideoId ?? undefined} slug={sermon.slug} onWatch={setActiveVideo} />)}</div>
        {!loading && !error && filteredSermons.length === 0 && <p style={{ textAlign: "center", padding: "48px 0" }}>{sermons.length ? "No sermons match your search." : "No sermons have been published yet."}</p>}
      </div></section>
      {site.social.youtube && <section className="ch-section ch-section-dark"><div className="ch-container" style={{ textAlign: "center" }}><span className="ch-eyebrow">Stay Connected</span><h2 className="ch-title" style={{ color: "#fff" }}>Follow the ministry online</h2><a href={site.social.youtube} target="_blank" rel="noopener noreferrer" className="ch-btn ch-btn-accent">Visit YouTube ↗</a></div></section>}
    </main>
    <ChurchFooter ministryName={site.ministryName} tagline={site.tagline} phoneNumbers={site.contact.phones} email={site.contact.email} address={site.contact.address} />
    <Modal isOpen={Boolean(activeVideo)} onClose={() => setActiveVideo(null)} title={activeVideo?.title}>{activeVideo?.youtubeVideoId && <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}><iframe src={`https://www.youtube.com/embed/${encodeURIComponent(activeVideo.youtubeVideoId)}?autoplay=1`} title={activeVideo.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>}</Modal>
  </>;
}
