"use client";

import { useState } from "react";
import {
  ChurchNav,
  ChurchFooter,
  PageHero,
  SermonCard,
  CategoryFilter,
  Modal,
} from "@bazion/ui";
import { globalMissionConfig } from "../../../../templates/global-mission.config";
import { sampleSermons } from "../../../../templates/church-sample-data";

const CATEGORIES = [
  "All",
  "Revival",
  "Prayer",
  "Holy Spirit",
  "Evangelism",
  "Faith",
  "Salvation",
];

export default function SermonsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [activeVideo, setActiveVideo] = useState<{ title: string; youtubeVideoId?: string } | null>(
    null
  );

  const featuredSermon = sampleSermons[0];

  const filteredSermons = sampleSermons.filter((sermon) => {
    const matchesCategory =
      selectedCategory === "All" ||
      sermon.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      sermon.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sermon.speaker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sermon.scriptureReference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sermon.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <>
      <ChurchNav
        ministryName={globalMissionConfig.ministryName}
        logoUrl={globalMissionConfig.branding.logoUrl}
        currentPath="/sermons"
        giveHref="/give"
      />

      <main>
        {/* 1. Page Hero */}
        <PageHero
          eyebrow="ONLINE MINISTRY ARCHIVE"
          title="Sermons & Spiritual"
          highlightedTitle="Teachings"
          subtitle="Listen to powerful, Bible-based messages that equip you for spiritual warfare, persistent prayer, and Holy Ghost revival."
          bgImageUrl={globalMissionConfig.branding.heroBgUrl}
        />

        {/* 2. Featured Sermon Highlight */}
        <section className="ch-section ch-section-alt">
          <div className="ch-container">
            <div className="ch-heading-wrap">
              <span className="ch-eyebrow">Featured Message</span>
              <h2 className="ch-title">{featuredSermon.title}</h2>
              <p className="ch-subtitle">
                By {featuredSermon.speaker} • {featuredSermon.date} • 📖 {featuredSermon.scriptureReference}
              </p>
            </div>

            <div style={{ maxWidth: "800px", margin: "0 auto" }}>
              <div
                style={{
                  position: "relative",
                  paddingBottom: "56.25%",
                  height: 0,
                  borderRadius: "var(--church-radius-lg)",
                  overflow: "hidden",
                  boxShadow: "var(--church-shadow-lg)",
                  marginBottom: "20px",
                }}
              >
                <iframe
                  src={`https://www.youtube.com/embed/${featuredSermon.youtubeVideoId}`}
                  title={featuredSermon.title}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    border: 0,
                  }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>

              <p style={{ fontSize: "16px", lineHeight: 1.7, color: "var(--church-text)", textAlign: "center" }}>
                {featuredSermon.description}
              </p>
            </div>
          </div>
        </section>

        {/* 3. Search Bar & Category Filters */}
        <section className="ch-section">
          <div className="ch-container">
            <div style={{ maxWidth: "600px", margin: "0 auto 32px auto" }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages by title, speaker, scripture, or topic..."
                style={{
                  width: "100%",
                  padding: "14px 20px",
                  fontSize: "15px",
                  borderRadius: "var(--church-radius)",
                  border: "1px solid var(--church-border)",
                  backgroundColor: "#ffffff",
                  boxShadow: "var(--church-shadow-sm)",
                }}
              />
            </div>

            <CategoryFilter
              categories={CATEGORIES}
              activeCategory={selectedCategory}
              onSelectCategory={(cat: string) => setSelectedCategory(cat)}
            />

            {/* 4. Sermon Library Grid */}
            <div className="ch-grid-3">
              {filteredSermons.map((sermon) => (
                <SermonCard
                  key={sermon.id}
                  id={sermon.id}
                  title={sermon.title}
                  speaker={sermon.speaker}
                  date={sermon.date}
                  scriptureReference={sermon.scriptureReference}
                  category={sermon.category}
                  youtubeVideoId={sermon.youtubeVideoId}
                  slug={sermon.slug}
                  onWatch={(s: { id: string; title: string; youtubeVideoId?: string }) => setActiveVideo(s)}
                />
              ))}
            </div>

            {filteredSermons.length === 0 && (
              <div style={{ textAlign: "center", padding: "48px 0", color: "var(--church-text-muted)" }}>
                No sermons found matching &ldquo;{searchQuery}&rdquo;. Try another topic or speaker name.
              </div>
            )}
          </div>
        </section>

        {/* 5. YouTube Channel CTA */}
        <section className="ch-section ch-section-dark">
          <div className="ch-container" style={{ textAlign: "center", maxWidth: "680px" }}>
            <span className="ch-eyebrow">Stay Connected Online</span>
            <h2 className="ch-title" style={{ color: "#ffffff" }}>
              Subscribe to Global Mission on YouTube
            </h2>
            <p className="ch-subtitle" style={{ color: "#cbd5e1", marginBottom: "32px" }}>
              Never miss a live revival service, prophetic broadcast, or Sunday teaching. Subscribe
              today and enable notifications.
            </p>
            <a
              href={globalMissionConfig.social.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="ch-btn ch-btn-accent"
              style={{ padding: "16px 32px", fontSize: "16px" }}
            >
              Subscribe on YouTube ↗
            </a>
          </div>
        </section>
      </main>

      <ChurchFooter
        ministryName={globalMissionConfig.ministryName}
        phoneNumbers={globalMissionConfig.contact.phones}
        email={globalMissionConfig.contact.email}
        address={globalMissionConfig.contact.address}
      />

      <Modal
        isOpen={Boolean(activeVideo)}
        onClose={() => setActiveVideo(null)}
        title={activeVideo?.title}
      >
        {activeVideo?.youtubeVideoId && (
          <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
            <iframe
              src={`https://www.youtube.com/embed/${activeVideo.youtubeVideoId}?autoplay=1`}
              title={activeVideo.title}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                border: 0,
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
      </Modal>
    </>
  );
}
