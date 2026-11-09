"use client";

import {
  ChurchNav,
  ChurchFooter,
  PageHero,
  LeadershipCard,
  ScriptureQuote,
} from "@bazion/ui";
import { useMinistrySite } from "../../lib/use-ministry-site";

export default function AboutPage() {
  const site = useMinistrySite();
  const lead = site.leadership[0];
  return (
    <>
      <ChurchNav
        ministryName={site.ministryName}
        logoUrl={site.branding.logoUrl}
        currentPath="/about"
        giveHref="/give"
      />

      <main id="main-content">
        {/* 1. Page Hero */}
        <PageHero
          eyebrow="ABOUT OUR MINISTRY"
          title={`About ${site.ministryName}`}
          highlightedTitle="Ministry"
          subtitle={site.tagline}
          bgImageUrl={site.branding.heroBgUrl}
        />

        {/* 2. Ministry Introduction & Leadership Message */}
        <section className="ch-section">
          <div className="ch-container">
            <div className="ch-grid-2" style={{ alignItems: "center" }}>
              <div>
                {lead?.photoUrl && <div className="ch-lead-portrait">
                  <img src={lead.photoUrl} alt={lead.name} />
                </div>}
              </div>
              <div>
                <span className="ch-eyebrow">{lead ? "A Message from Ministry Leadership" : "Our story"}</span>
                <h2 className="ch-title">{lead?.name || site.ministryName}</h2>
                {lead?.role && <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--church-accent)", marginBottom: "16px" }}>
                  {lead.role}
                </div>}
                {lead?.bio && <blockquote
                  style={{
                    fontSize: "16px",
                    lineHeight: 1.8,
                    color: "var(--church-text)",
                    fontStyle: "italic",
                    margin: "0 0 20px 0",
                    borderLeft: "4px solid var(--church-secondary)",
                    paddingLeft: "16px",
                  }}
                >
                  {lead.bio}
                </blockquote>}
                <p style={{ fontSize: "15px", lineHeight: 1.7, color: "var(--church-text-muted)" }}>
                  {site.mission.statement || site.outreach.statement || "More information about this ministry will be shared here."}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Vision & Mission Cards */}
        <section className="ch-section">
          <div className="ch-container">
            <div className="ch-grid-3">
              {site.vision.statement && <div className="ch-card">
                <div className="ch-card-body">
                  <span style={{ fontSize: "36px", marginBottom: "12px" }}>🌍</span>
                  <h3 style={{ fontSize: "20px", fontWeight: 700, color: "var(--church-primary)", marginBottom: "8px" }}>
                    {site.vision.title}
                  </h3>
                  <p style={{ fontSize: "15px", lineHeight: 1.6, color: "var(--church-text-muted)", margin: 0 }}>
                    {site.vision.statement}
                  </p>
                </div>
              </div>}

              {site.mission.statement && <div className="ch-card">
                <div className="ch-card-body">
                  <span style={{ fontSize: "36px", marginBottom: "12px" }}>⛪</span>
                  <h3 style={{ fontSize: "20px", fontWeight: 700, color: "var(--church-primary)", marginBottom: "8px" }}>
                    {site.mission.title}
                  </h3>
                  <p style={{ fontSize: "15px", lineHeight: 1.6, color: "var(--church-text-muted)", margin: 0 }}>
                    {site.mission.statement}
                  </p>
                </div>
              </div>}

              {site.outreach.statement && <div className="ch-card">
                <div className="ch-card-body">
                  <span style={{ fontSize: "36px", marginBottom: "12px" }}>🌱</span>
                  <h3 style={{ fontSize: "20px", fontWeight: 700, color: "var(--church-primary)", marginBottom: "8px" }}>
                    {site.outreach.title}
                  </h3>
                  <p style={{ fontSize: "15px", lineHeight: 1.6, color: "var(--church-text-muted)", margin: 0 }}>
                    {site.outreach.statement}
                  </p>
                </div>
              </div>}
              {!site.vision.statement && !site.mission.statement && !site.outreach.statement && <p>Ministry profile information will appear here when published.</p>}
            </div>
          </div>
        </section>

        {/* 5. Core Values */}
        {site.coreValues.length > 0 && <section className="ch-section ch-section-alt">
          <div className="ch-container">
            <div className="ch-heading-wrap">
              <span className="ch-eyebrow">Pillars of Faith</span>
              <h2 className="ch-title">Our Core Values</h2>
              <p className="ch-subtitle">
                The non-negotiable spiritual standards that guide our fellowship and ministry work.
              </p>
            </div>

            <div className="ch-grid-3">
              {site.coreValues.map((val) => (
                <div key={val.title} className="ch-card">
                  <div className="ch-card-body">
                    {val.icon && <span aria-hidden="true" style={{ fontSize: "32px", marginBottom: "12px" }}>{val.icon}</span>}
                    <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px 0", color: "var(--church-primary)" }}>
                      {val.title}
                    </h3>
                    <p style={{ fontSize: "14px", lineHeight: 1.6, color: "var(--church-text-muted)", margin: 0 }}>
                      {val.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>}

        {/* 6. Statement of Faith */}
        {site.statementOfFaith.length > 0 && <section className="ch-section">
          <div className="ch-container">
            <div className="ch-heading-wrap">
              <span className="ch-eyebrow">Biblical Doctrine</span>
              <h2 className="ch-title">Statement of Faith</h2>
              <p className="ch-subtitle">
                What we believe based strictly on the Holy Scriptures of the Old and New Testaments.
              </p>
            </div>

            <div style={{ maxWidth: "840px", margin: "0 auto", display: "grid", gap: "16px" }}>
              {site.statementOfFaith.map((sof, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "#ffffff",
                    padding: "20px 24px",
                    borderRadius: "var(--church-radius)",
                    border: "1px solid var(--church-border)",
                  }}
                >
                  <h3 style={{ fontSize: "17px", fontWeight: 700, color: "var(--church-secondary)", margin: "0 0 6px 0" }}>
                    {sof.topic}
                  </h3>
                  <p style={{ fontSize: "14px", lineHeight: 1.6, color: "var(--church-text-muted)", margin: 0 }}>
                    {sof.belief}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>}

        {/* 7. Leadership Team */}
        {site.leadership.length > 0 && <section className="ch-section ch-section-alt">
          <div className="ch-container">
            <div className="ch-heading-wrap">
              <span className="ch-eyebrow">Servant Leaders</span>
              <h2 className="ch-title">Our Leadership Team</h2>
              <p className="ch-subtitle">
                Meet the people serving this ministry.
              </p>
            </div>

            <div className="ch-grid-3">
              {site.leadership.map((leader) => (
                <LeadershipCard
                  key={leader.id}
                  id={leader.id}
                  name={leader.name}
                  role={leader.role}
                  bio={leader.bio}
                  photoUrl={leader.photoUrl}
                />
              ))}
            </div>
          </div>
        </section>}

        {site.scripture.verse && <div className="ch-container">
          <ScriptureQuote
            verse={site.scripture.verse}
            reference={site.scripture.reference}
            version={site.scripture.version || undefined}
          />
        </div>}

        {/* 9. Partnership Invitation */}
        <section className="ch-section ch-section-dark">
          <div className="ch-container" style={{ textAlign: "center", maxWidth: "700px" }}>
            <span className="ch-eyebrow">Join the Harvest</span>
            <h2 className="ch-title" style={{ color: "#ffffff" }}>
              Partner With {site.ministryName} Today
            </h2>
            <p className="ch-subtitle" style={{ color: "#cbd5e1", marginBottom: "32px" }}>
              Connect with the ministry through prayer, service, or financial support.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "16px" }}>
              <a href="/give" className="ch-btn ch-btn-accent">
                Partner Financially
              </a>
              <a href="/contact" className="ch-btn ch-btn-outline-white">
                Contact Ministry Office
              </a>
            </div>
          </div>
        </section>
      </main>

      <ChurchFooter
        ministryName={site.ministryName}
        tagline={site.tagline}
        phoneNumbers={site.contact.phones}
        email={site.contact.email}
        address={site.contact.address}
      />
    </>
  );
}
