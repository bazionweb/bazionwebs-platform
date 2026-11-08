"use client";

import { useState } from "react";
import {
  ChurchNav,
  ChurchFooter,
  PageHero,
  CategoryFilter,
  Modal,
} from "@bazion/ui";
import { globalMissionConfig } from "../../../../templates/global-mission.config";
import {
  sampleGallery,
  type GalleryItem,
} from "../../../../templates/church-sample-data";

const CATEGORIES = [
  "All",
  "Crusades",
  "Conferences",
  "Medical Outreach",
  "Prayer Meetings",
  "Community Outreach",
];

export default function GalleryPage() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [activePhoto, setActivePhoto] = useState<GalleryItem | null>(null);

  const filteredPhotos =
    selectedCategory === "All"
      ? sampleGallery
      : sampleGallery.filter(
          (p) => p.category.toLowerCase() === selectedCategory.toLowerCase()
        );

  return (
    <>
      <ChurchNav
        ministryName={globalMissionConfig.ministryName}
        logoUrl={globalMissionConfig.branding.logoUrl}
        currentPath="/gallery"
        giveHref="/give"
      />

      <main>
        {/* 1. Page Hero */}
        <PageHero
          eyebrow="PHOTO & VIDEO ARCHIVE"
          title="Our Ministry in"
          highlightedTitle="Action"
          subtitle="Capturing the transformative power of the Holy Spirit across our mission fields, medical outreaches, conferences, and crusades."
          bgImageUrl={globalMissionConfig.branding.heroBgUrl}
        />

        {/* 2. Category Filters & Grid */}
        <section className="ch-section">
          <div className="ch-container">
            <CategoryFilter
              categories={CATEGORIES}
              activeCategory={selectedCategory}
              onSelectCategory={(cat: string) => setSelectedCategory(cat)}
            />

            <div className="ch-grid-3">
              {filteredPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="ch-card"
                  style={{ cursor: "pointer" }}
                  onClick={() => setActivePhoto(photo)}
                >
                  <div className="ch-card-media" style={{ height: "240px" }}>
                    <img src={photo.imageUrl} alt={photo.title} loading="lazy" />
                  </div>
                  <div className="ch-card-body">
                    <span className="ch-eyebrow" style={{ fontSize: "11px", marginBottom: "6px" }}>
                      {photo.category} • {photo.eventDate}
                    </span>
                    <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 6px 0", color: "var(--church-primary)" }}>
                      {photo.title}
                    </h3>
                    <p style={{ fontSize: "13px", color: "var(--church-text-muted)", margin: 0 }}>
                      {photo.caption}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {filteredPhotos.length === 0 && (
              <div style={{ textAlign: "center", padding: "48px 0", color: "var(--church-text-muted)" }}>
                No photographs found in this category yet.
              </div>
            )}
          </div>
        </section>

        {/* 3. Ministry Video Spotlight */}
        <section className="ch-section ch-section-alt">
          <div className="ch-container">
            <div className="ch-heading-wrap">
              <span className="ch-eyebrow">Video Highlights</span>
              <h2 className="ch-title">Experience Our Crusades Live</h2>
              <p className="ch-subtitle">
                Watch full conference broadcasts, choir worship sessions, and field testimonies on
                YouTube.
              </p>
            </div>

            <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
              <div
                style={{
                  position: "relative",
                  paddingBottom: "56.25%",
                  height: 0,
                  borderRadius: "var(--church-radius-lg)",
                  overflow: "hidden",
                  boxShadow: "var(--church-shadow-lg)",
                }}
              >
                <iframe
                  src="https://www.youtube.com/embed/bO9p1a8_zV4"
                  title="Global Mission for Christ YouTube Video"
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

              <div style={{ marginTop: "28px" }}>
                <a
                  href={globalMissionConfig.social.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ch-btn ch-btn-accent"
                >
                  Subscribe to Official YouTube Channel ↗
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* 4. CTA */}
        <section className="ch-section ch-section-dark">
          <div className="ch-container" style={{ textAlign: "center", maxWidth: "680px" }}>
            <span className="ch-eyebrow">Be Part of the Next Mission</span>
            <h2 className="ch-title" style={{ color: "#ffffff" }}>
              Join Us at Our Upcoming Outreach
            </h2>
            <p className="ch-subtitle" style={{ color: "#cbd5e1", marginBottom: "32px" }}>
              God is moving powerfully. Register to attend our revival services or volunteer with our
              medical and prayer teams.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "16px" }}>
              <a href="/events" className="ch-btn ch-btn-accent">
                View Upcoming Events
              </a>
              <a href="/contact" className="ch-btn ch-btn-outline-white">
                Volunteer With Us
              </a>
            </div>
          </div>
        </section>
      </main>

      <ChurchFooter
        ministryName={globalMissionConfig.ministryName}
        phoneNumbers={globalMissionConfig.contact.phones}
        email={globalMissionConfig.contact.email}
        address={globalMissionConfig.contact.address}
      />

      {/* Lightbox Modal */}
      <Modal
        isOpen={Boolean(activePhoto)}
        onClose={() => setActivePhoto(null)}
        title={activePhoto?.title}
      >
        {activePhoto && (
          <div>
            <img
              src={activePhoto.imageUrl}
              alt={activePhoto.title}
              style={{
                width: "100%",
                maxHeight: "70vh",
                objectFit: "contain",
                borderRadius: "var(--church-radius)",
                marginBottom: "16px",
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--church-text-muted)", fontSize: "13px" }}>
              <span>Category: <strong>{activePhoto.category}</strong></span>
              <span>Date: <strong>{activePhoto.eventDate}</strong></span>
            </div>
            <p style={{ marginTop: "12px", fontSize: "15px", lineHeight: 1.6 }}>
              {activePhoto.caption}
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}
