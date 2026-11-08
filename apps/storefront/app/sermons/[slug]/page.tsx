import { notFound } from "next/navigation";
import {
  ChurchNav,
  ChurchFooter,
  PageHero,
  ScriptureQuote,
} from "@bazion/ui";
import { globalMissionConfig } from "../../../../../templates/global-mission.config";
import { sampleSermons } from "../../../../../templates/church-sample-data";

export default async function SermonDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sermon = sampleSermons.find((s) => s.slug === slug);

  if (!sermon) {
    notFound();
  }

  const relatedSermons = sampleSermons.filter((s) => s.id !== sermon.id).slice(0, 3);

  return (
    <>
      <ChurchNav
        ministryName={globalMissionConfig.ministryName}
        logoUrl={globalMissionConfig.branding.logoUrl}
        currentPath="/sermons"
        giveHref="/give"
      />

      <main>
        <PageHero
          eyebrow={`SERMON ARCHIVE • ${sermon.category.toUpperCase()}`}
          title={sermon.title}
          subtitle={`Preached by ${sermon.speaker} • ${sermon.date}`}
          bgImageUrl={globalMissionConfig.branding.heroBgUrl}
        />

        <article className="ch-section">
          <div className="ch-container">
            {/* Embedded YouTube Video */}
            <div style={{ maxWidth: "860px", margin: "0 auto" }}>
              <div
                style={{
                  position: "relative",
                  paddingBottom: "56.25%",
                  height: 0,
                  borderRadius: "var(--church-radius-lg)",
                  overflow: "hidden",
                  boxShadow: "var(--church-shadow-lg)",
                  marginBottom: "32px",
                }}
              >
                <iframe
                  src={`https://www.youtube.com/embed/${sermon.youtubeVideoId}`}
                  title={sermon.title}
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

              {/* Sermon Scripture */}
              <ScriptureQuote
                verse="Thy word is a lamp unto my feet, and a light unto my path."
                reference={sermon.scriptureReference}
              />

              {/* Description */}
              <div style={{ margin: "32px 0" }}>
                <h2 style={{ fontSize: "24px", color: "var(--church-primary)", marginBottom: "12px" }}>
                  Message Overview
                </h2>
                <p style={{ fontSize: "16px", lineHeight: 1.8, color: "var(--church-text)" }}>
                  {sermon.description}
                </p>
              </div>

              {/* Study Notes */}
              {sermon.notes && sermon.notes.length > 0 && (
                <div
                  style={{
                    backgroundColor: "var(--church-bg-alt)",
                    padding: "24px",
                    borderRadius: "var(--church-radius)",
                    border: "1px solid var(--church-border)",
                    marginBottom: "36px",
                  }}
                >
                  <h3 style={{ fontSize: "18px", color: "var(--church-primary)", marginBottom: "12px" }}>
                    Key Biblical Takeaways & Study Notes
                  </h3>
                  <ul style={{ paddingLeft: "20px", margin: 0, lineHeight: 1.8 }}>
                    {sermon.notes.map((note, idx) => (
                      <li key={idx} style={{ color: "var(--church-text)", fontSize: "15px" }}>
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Share & Actions */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "16px",
                  borderTop: "1px solid var(--church-border)",
                  paddingTop: "24px",
                }}
              >
                <a href="/sermons" className="ch-btn ch-btn-outline">
                  ← Back to All Sermons
                </a>
                <a
                  href={`https://www.youtube.com/watch?v=${sermon.youtubeVideoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ch-btn ch-btn-accent"
                >
                  Watch Directly on YouTube ↗
                </a>
              </div>
            </div>

            {/* Related Sermons */}
            <div style={{ marginTop: "64px" }}>
              <div className="ch-heading-wrap">
                <span className="ch-eyebrow">Continue Listening</span>
                <h2 className="ch-title">Related Messages</h2>
              </div>
              <div className="ch-grid-3">
                {relatedSermons.map((rel) => (
                  <div key={rel.id} className="ch-card">
                    <div className="ch-card-body">
                      <span className="ch-sermon-badge">{rel.category}</span>
                      <h3 className="ch-sermon-title">
                        <a href={`/sermons/${rel.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
                          {rel.title}
                        </a>
                      </h3>
                      <p style={{ fontSize: "13px", color: "var(--church-text-muted)" }}>
                        By {rel.speaker} • {rel.date}
                      </p>
                      <a href={`/sermons/${rel.slug}`} className="ch-btn ch-btn-outline" style={{ marginTop: "12px" }}>
                        Listen / Watch Notes →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>
      </main>

      <ChurchFooter
        ministryName={globalMissionConfig.ministryName}
        phoneNumbers={globalMissionConfig.contact.phones}
        email={globalMissionConfig.contact.email}
        address={globalMissionConfig.contact.address}
      />
    </>
  );
}
