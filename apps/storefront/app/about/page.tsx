"use client";

import {
  ChurchNav,
  ChurchFooter,
  PageHero,
  LeadershipCard,
  ScriptureQuote,
} from "@bazion/ui";
import { globalMissionConfig } from "../../../../templates/global-mission.config";

export default function AboutPage() {
  return (
    <>
      <ChurchNav
        ministryName={globalMissionConfig.ministryName}
        logoUrl={globalMissionConfig.branding.logoUrl}
        currentPath="/about"
        giveHref="/give"
      />

      <main>
        {/* 1. Page Hero */}
        <PageHero
          eyebrow="ABOUT OUR MINISTRY"
          title="About Global Mission for Christ"
          highlightedTitle="International"
          subtitle="A Holy Ghost apostolic movement burning with a passion for souls, relentless prayer, and propagating revival across nations."
          bgImageUrl={globalMissionConfig.branding.heroBgUrl}
        />

        {/* 2. Ministry Introduction & Director's Message */}
        <section className="ch-section">
          <div className="ch-container">
            <div className="ch-grid-2" style={{ alignItems: "center" }}>
              <div>
                <img
                  src="/images/anthony-githui.jpg"
                  alt="Rev. Anthony Githui"
                  style={{
                    width: "100%",
                    maxHeight: "480px",
                    objectFit: "cover",
                    borderRadius: "var(--church-radius-lg)",
                    boxShadow: "var(--church-shadow-lg)",
                  }}
                />
              </div>
              <div>
                <span className="ch-eyebrow">Director&apos;s Message</span>
                <h2 className="ch-title">Rev. Anthony Githui</h2>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--church-accent)", marginBottom: "16px" }}>
                  Director, Global Mission for Christ International
                </div>
                <blockquote
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
                  &ldquo;At Global Mission for Christ International, our heartbeat is to see lives
                  transformed by the power of Jesus Christ and revival spread to the nations of the
                  world. We are committed to raising men and women grounded in prayer, rooted in the
                  Word of God, empowered by the Holy Spirit, passionate for righteousness, and
                  dedicated to impacting their generation for Christ.&rdquo;
                </blockquote>
                <p style={{ fontSize: "15px", lineHeight: 1.7, color: "var(--church-text-muted)" }}>
                  As a ministry, we continue to reach communities through the Gospel, prayer gatherings,
                  revival meetings, and acts of compassion — supporting the needy through medical and
                  community outreach programs. Together, let us shine His light and carry the message
                  of hope to the world.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Ministry History & Milestones */}
        <section className="ch-section ch-section-alt">
          <div className="ch-container">
            <div className="ch-heading-wrap">
              <span className="ch-eyebrow">Our Journey</span>
              <h2 className="ch-title">Ministry History & Milestones</h2>
              <p className="ch-subtitle">
                How God birthed an apostolic burden and guided us from humble beginnings to an
                international outreach ministry.
              </p>
            </div>

            <div style={{ maxWidth: "800px", margin: "0 auto", display: "grid", gap: "24px" }}>
              {[
                {
                  year: "Founding",
                  title: "The Heavenly Vision",
                  desc: "Global Mission for Christ International was founded with a divine mandate to raise an altar of prayer and propagate Holy Ghost revival to villages and nations.",
                },
                {
                  year: "Expansion",
                  title: "Regional Crusades & Medical Missions",
                  desc: "The ministry launched coordinated medical camps in underserved rural districts, integrating physical healing with gospel preaching.",
                },
                {
                  year: "Present",
                  title: "Over 34,200+ Souls Reached Across 10 Nations",
                  desc: "Through annual conferences, digital broadcasts, and cross-border missions, God continues to extend the ministry's reach across Africa and beyond.",
                },
              ].map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    gap: "24px",
                    background: "#ffffff",
                    padding: "24px",
                    borderRadius: "var(--church-radius)",
                    border: "1px solid var(--church-border)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 800,
                      color: "var(--church-accent)",
                      minWidth: "90px",
                    }}
                  >
                    {m.year}
                  </div>
                  <div>
                    <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px 0", color: "var(--church-primary)" }}>
                      {m.title}
                    </h3>
                    <p style={{ fontSize: "14px", color: "var(--church-text-muted)", margin: 0, lineHeight: 1.6 }}>
                      {m.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. Vision & Mission Cards */}
        <section className="ch-section">
          <div className="ch-container">
            <div className="ch-grid-3">
              <div className="ch-card">
                <div className="ch-card-body">
                  <span style={{ fontSize: "36px", marginBottom: "12px" }}>🌍</span>
                  <h3 style={{ fontSize: "20px", fontWeight: 700, color: "var(--church-primary)", marginBottom: "8px" }}>
                    {globalMissionConfig.vision.title}
                  </h3>
                  <p style={{ fontSize: "15px", lineHeight: 1.6, color: "var(--church-text-muted)", margin: 0 }}>
                    {globalMissionConfig.vision.statement}
                  </p>
                </div>
              </div>

              <div className="ch-card">
                <div className="ch-card-body">
                  <span style={{ fontSize: "36px", marginBottom: "12px" }}>⛪</span>
                  <h3 style={{ fontSize: "20px", fontWeight: 700, color: "var(--church-primary)", marginBottom: "8px" }}>
                    {globalMissionConfig.mission.title}
                  </h3>
                  <p style={{ fontSize: "15px", lineHeight: 1.6, color: "var(--church-text-muted)", margin: 0 }}>
                    {globalMissionConfig.mission.statement}
                  </p>
                </div>
              </div>

              <div className="ch-card">
                <div className="ch-card-body">
                  <span style={{ fontSize: "36px", marginBottom: "12px" }}>🌱</span>
                  <h3 style={{ fontSize: "20px", fontWeight: 700, color: "var(--church-primary)", marginBottom: "8px" }}>
                    {globalMissionConfig.outreach.title}
                  </h3>
                  <p style={{ fontSize: "15px", lineHeight: 1.6, color: "var(--church-text-muted)", margin: 0 }}>
                    {globalMissionConfig.outreach.statement}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Core Values */}
        <section className="ch-section ch-section-alt">
          <div className="ch-container">
            <div className="ch-heading-wrap">
              <span className="ch-eyebrow">Pillars of Faith</span>
              <h2 className="ch-title">Our Five Core Values</h2>
              <p className="ch-subtitle">
                The non-negotiable spiritual standards that guide our fellowship and ministry work.
              </p>
            </div>

            <div className="ch-grid-3">
              {globalMissionConfig.coreValues.map((val) => (
                <div key={val.title} className="ch-card">
                  <div className="ch-card-body">
                    <span style={{ fontSize: "32px", marginBottom: "12px" }}>{val.icon}</span>
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
        </section>

        {/* 6. Statement of Faith */}
        <section className="ch-section">
          <div className="ch-container">
            <div className="ch-heading-wrap">
              <span className="ch-eyebrow">Biblical Doctrine</span>
              <h2 className="ch-title">Statement of Faith</h2>
              <p className="ch-subtitle">
                What we believe based strictly on the Holy Scriptures of the Old and New Testaments.
              </p>
            </div>

            <div style={{ maxWidth: "840px", margin: "0 auto", display: "grid", gap: "16px" }}>
              {globalMissionConfig.statementOfFaith.map((sof, idx) => (
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
        </section>

        {/* 7. Leadership Team */}
        <section className="ch-section ch-section-alt">
          <div className="ch-container">
            <div className="ch-heading-wrap">
              <span className="ch-eyebrow">Servant Leaders</span>
              <h2 className="ch-title">Our Leadership Team</h2>
              <p className="ch-subtitle">
                Pastors, bishops, and directors serving under the divine appointment of God.
              </p>
            </div>

            <div className="ch-grid-3">
              {globalMissionConfig.leadership.map((leader) => (
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
        </section>

        {/* 8. Scripture Quote */}
        <div className="ch-container">
          <ScriptureQuote
            verse="Go therefore and make disciples of all the nations, baptizing them in the name of the Father and of the Son and of the Holy Spirit."
            reference="Matthew 28:19"
          />
        </div>

        {/* 9. Partnership Invitation */}
        <section className="ch-section ch-section-dark">
          <div className="ch-container" style={{ textAlign: "center", maxWidth: "700px" }}>
            <span className="ch-eyebrow">Join the Harvest</span>
            <h2 className="ch-title" style={{ color: "#ffffff" }}>
              Partner With Global Mission Today
            </h2>
            <p className="ch-subtitle" style={{ color: "#cbd5e1", marginBottom: "32px" }}>
              Whether through intercessory prayer, volunteering in our medical missions, or financial
              partnership, your participation makes an eternal impact.
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
        ministryName={globalMissionConfig.ministryName}
        phoneNumbers={globalMissionConfig.contact.phones}
        email={globalMissionConfig.contact.email}
        address={globalMissionConfig.contact.address}
      />
    </>
  );
}
