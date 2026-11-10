"use client";

import { useState } from "react";
import { ChurchFooter, ChurchNav, Modal, PageHero } from "@bazion/ui";
import { useMinistrySite } from "../../lib/use-ministry-site";

export default function GalleryPage() {
  const site = useMinistrySite();
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
  const activeImage = activeImageIndex === null ? null : site.galleryImages[activeImageIndex] ?? null;

  function moveImage(direction: -1 | 1) {
    if (activeImageIndex === null || site.galleryImages.length < 2) return;
    setActiveImageIndex((activeImageIndex + direction + site.galleryImages.length) % site.galleryImages.length);
  }

  return <>
    <ChurchNav ministryName={site.ministryName} logoUrl={site.branding.logoUrl} links={site.navigation} currentPath="/gallery" giveHref={site.pages.some((page) => page.id === "giving" && page.enabled) ? "/give" : null} />
    <main id="main-content">
      <PageHero eyebrow="STORIES FROM OUR COMMUNITY" title="Our" highlightedTitle="Gallery" subtitle="Photos and moments shared by this ministry." bgImageUrl={site.branding.heroBgUrl} />
      <section className="ch-section">
        <div className="ch-container">
          <div className="ch-heading-wrap"><span className="ch-eyebrow">Ministry life</span><h2 className="ch-title">Moments together</h2></div>
          {site.galleryImages.length > 0 ? <div className="ch-gallery-grid">
            {site.galleryImages.map((item, index) => <figure className="ch-card ch-gallery-item" key={`${item.imageUrl}-${index}`}>
              <button
                type="button"
                className="ch-gallery-trigger"
                aria-label={"View photo " + (index + 1) + (item.caption ? ": " + item.caption : "")}
                onClick={() => setActiveImageIndex(index)}
              >
                <img src={item.imageUrl} alt={item.alt} loading="lazy" />
                <span className="ch-gallery-view-label" aria-hidden="true">View photo</span>
              </button>
              {item.caption && <figcaption>{item.caption}</figcaption>}
            </figure>)}
          </div> : <div className="ch-info-card" style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
            <h3>Ministry media will appear here</h3>
            <p>The team has not published any gallery images yet.</p>
          </div>}
          {site.social.youtube && <p style={{ textAlign: "center", marginTop: 28 }}><a className="ch-btn ch-btn-accent" href={site.social.youtube} target="_blank" rel="noopener noreferrer">Visit the ministry&apos;s YouTube channel ↗</a></p>}
        </div>
      </section>
      <section className="ch-section ch-section-dark">
        <div className="ch-container" style={{ textAlign: "center" }}>
          <h2 className="ch-title" style={{ color: "#fff" }}>Upcoming events</h2>
          <p className="ch-subtitle" style={{ color: "#cbd5e1" }}>See the public event calendar for current ministry gatherings.</p>
          <a href="/events" className="ch-btn ch-btn-accent">View events</a>
        </div>
      </section>
    </main>
    <ChurchFooter ministryName={site.ministryName} tagline={site.tagline} phoneNumbers={site.contact.phones} email={site.contact.email} address={site.contact.address} />
    <Modal
      isOpen={Boolean(activeImage)}
      onClose={() => setActiveImageIndex(null)}
      title={activeImage?.caption || ("Photo " + (activeImageIndex === null ? "" : activeImageIndex + 1))}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") moveImage(-1);
        if (event.key === "ArrowRight") moveImage(1);
      }}
    >
      {activeImage && activeImageIndex !== null && <div className="ch-gallery-viewer">
        <img src={activeImage.imageUrl} alt={activeImage.alt} />
        {activeImage.caption && <p>{activeImage.caption}</p>}
        {site.galleryImages.length > 1 && <div className="ch-gallery-controls">
          <button type="button" className="ch-btn ch-btn-outline" onClick={() => moveImage(-1)} aria-label="Previous photo">← Previous</button>
          <span aria-live="polite">{activeImageIndex + 1} of {site.galleryImages.length}</span>
          <button type="button" className="ch-btn ch-btn-outline" onClick={() => moveImage(1)} aria-label="Next photo">Next →</button>
        </div>}
      </div>}
    </Modal>
  </>;
}
