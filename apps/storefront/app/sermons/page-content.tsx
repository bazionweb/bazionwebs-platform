"use client";

import { useEffect, useMemo, useState } from "react";
import { CategoryFilter, SermonCard, Modal } from "@bazion/ui";
import { SiteChrome } from "../../components/gmfc/SiteChrome";
import { PageHero } from "../../components/gmfc/PageHero";
import { getClientTenantHeaders } from "../../lib/client-tenant";
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
  return new Date(sermon.publishedAt ?? sermon.createdAt).toLocaleDateString("en-KE", {
    dateStyle: "long",
    timeZone: "Africa/Nairobi",
  });
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
    fetch("/v1/public/church/sermons?limit=100", {
      headers: getClientTenantHeaders(),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load this ministry's sermons.");
        return response.json() as Promise<{ items: PublicSermon[] }>;
      })
      .then((data) => {
        if (active) setSermons(data.items);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load sermons.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(
          sermons
            .map((sermon) => sermon.category)
            .filter((category): category is string => Boolean(category)),
        ),
      ),
    ],
    [sermons],
  );

  const filteredSermons = sermons.filter((sermon) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesCategory = selectedCategory === "All" || sermon.category === selectedCategory;
    const matchesSearch =
      !query ||
      [sermon.title, sermon.speaker, sermon.scriptureReference, sermon.description].some((value) =>
        value?.toLowerCase().includes(query),
      );
    return matchesCategory && matchesSearch;
  });

  const featuredSermon = sermons[0];
  const youtubeUrl = site.social.youtube || "https://www.youtube.com/@GlobalMissionfc";

  return (
    <SiteChrome currentPath="/sermons">
      <main id="main-content">
        <PageHero
          eyebrow="Online Ministry"
          title="Sermons & Messages"
          subtitle="Watch our latest sermons, worship sessions, and ministry updates."
          btn1Text="Watch on YouTube"
          btn1Url={youtubeUrl}
        />

        <div className="gmfci-videos-container">
          <div className="gmfci-videos-hub">
            <div className="gmfci-yt-tag">Online Ministry</div>
            <div className="gmfci-yt-icon-wrapper">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
              </svg>
            </div>
            <h2>Experience {site.ministryName.replace(/\s+for Christ International$/i, "")} Online</h2>
            <p>
              Join our online community and watch our latest sermons, worship sessions,
              and ministry updates directly on our official YouTube channel.
            </p>
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="gmfci-btn-yt"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              Watch on YouTube
            </a>
          </div>
        </div>

        {/* Platform Sermon Archive layered cleanly below when sermons are published */}
        {!loading && (sermons.length > 0 || error) && (
          <section className="ch-section" style={{ background: "#fff" }}>
            <div className="ch-container">
              {featuredSermon && (
                <div style={{ marginBottom: 48 }}>
                  <div className="ch-heading-wrap">
                    <span className="ch-eyebrow">Latest Message</span>
                    <h2 className="ch-title">{featuredSermon.title}</h2>
                    <p className="ch-subtitle">
                      By {featuredSermon.speaker} • {sermonDate(featuredSermon)}
                      {featuredSermon.scriptureReference ? ` • ${featuredSermon.scriptureReference}` : ""}
                    </p>
                  </div>
                  {featuredSermon.youtubeVideoId && (
                    <div style={{ maxWidth: 800, margin: "0 auto" }}>
                      <button
                        type="button"
                        className="ch-sermon-featured-video"
                        aria-label={`Play latest message: ${featuredSermon.title}`}
                        onClick={() =>
                          setActiveVideo({
                            title: featuredSermon.title,
                            youtubeVideoId: featuredSermon.youtubeVideoId ?? undefined,
                          })
                        }
                      >
                        <img
                          src={
                            featuredSermon.thumbnailUrl ||
                            `https://img.youtube.com/vi/${encodeURIComponent(featuredSermon.youtubeVideoId)}/hqdefault.jpg`
                          }
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                        <span className="ch-sermon-featured-play" aria-hidden="true">▶</span>
                        <span className="ch-sermon-featured-label" aria-hidden="true">
                          Watch the latest message
                        </span>
                      </button>
                      {featuredSermon.description && (
                        <p style={{ textAlign: "center", lineHeight: 1.7 }}>{featuredSermon.description}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div style={{ maxWidth: 600, margin: "0 auto 28px" }}>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title, speaker or scripture…"
                  aria-label="Search sermons"
                  style={{
                    width: "100%",
                    padding: 14,
                    borderRadius: "var(--church-radius)",
                    border: "1px solid var(--church-border)",
                  }}
                />
              </div>
              {categories.length > 1 && (
                <CategoryFilter
                  categories={categories}
                  activeCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                />
              )}
              {error && <p role="alert">{error}</p>}
              <div className="ch-grid-3">
                {filteredSermons.map((sermon) => (
                  <SermonCard
                    key={sermon.id}
                    id={sermon.id}
                    title={sermon.title}
                    speaker={sermon.speaker}
                    date={sermonDate(sermon)}
                    scriptureReference={sermon.scriptureReference ?? undefined}
                    category={sermon.category ?? undefined}
                    thumbnailUrl={sermon.thumbnailUrl ?? undefined}
                    youtubeVideoId={sermon.youtubeVideoId ?? undefined}
                    slug={sermon.slug}
                    onWatch={setActiveVideo}
                  />
                ))}
              </div>
              {!error && filteredSermons.length === 0 && (
                <p style={{ textAlign: "center", padding: "32px 0" }}>
                  No sermons match your search.
                </p>
              )}
            </div>
          </section>
        )}

        <Modal isOpen={Boolean(activeVideo)} onClose={() => setActiveVideo(null)} title={activeVideo?.title}>
          {activeVideo?.youtubeVideoId && (
            <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
              <iframe
                src={`https://www.youtube.com/embed/${encodeURIComponent(activeVideo.youtubeVideoId)}?autoplay=1`}
                title={activeVideo.title}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </Modal>
      </main>
    </SiteChrome>
  );
}
