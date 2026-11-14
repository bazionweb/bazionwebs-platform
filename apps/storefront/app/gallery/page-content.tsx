"use client";

import { SiteChrome } from "../../components/gmfc/SiteChrome";
import { PageHero } from "../../components/gmfc/PageHero";
import { GallerySlider } from "../../components/gmfc/GallerySlider";
import { useMinistrySite } from "../../lib/use-ministry-site";

export default function GalleryPage() {
  const site = useMinistrySite();
  const images = site.galleryImages.map((img) => ({
    src: img.imageUrl,
    alt: img.alt,
    caption: img.caption,
  }));

  return (
    <SiteChrome currentPath="/gallery">
      <main id="main-content">
        <PageHero
          eyebrow="Visual Journey"
          title="Our Missions Gallery"
          subtitle="Witness the transformative power of God across our various outreaches, medical camps, and revival meetings."
        />

        <div style={{ padding: "60px 0", background: "#f9fafb" }}>
          {images.length > 0 ? (
            <GallerySlider images={images} />
          ) : (
            <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center", padding: "40px 20px" }}>
              <p style={{ color: "#6b7280", fontSize: 16 }}>
                Ministry gallery photos have not been published yet.
              </p>
            </div>
          )}
        </div>
      </main>
    </SiteChrome>
  );
}
