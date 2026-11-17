"use client";

import Link from "next/link";
import type { SchoolPortalConfig } from "@bazion/education-contracts";
import PageHero from "../components/PageHero";
import { useEducationTenant } from "../context/EducationTenantContext";

const DEFAULT_BMI_LEADERSHIP = [
  { name: "Dr. Christopher Cookhorne", role: "President, BMI University",     img: "/images/cookhorne.png" },
  { name: "Dr. George Githinji",       role: "Vice-President, BMI University", img: "/images/george-githinji.png" },
  { name: "Dr. Joseph Kiai",           role: "Dean of Academics",              img: "/images/dr-joseph.png" },
  { name: "Dr. Melba Layne",           role: "Chief Registrar",                img: "/images/melba.png" },
  { name: "Dr. Lilian Young",          role: "Dean of Students",               img: "/images/dr-young.png" },
];

const DEFAULT_BMI_TRUSTEES = [
  "Dr. Christopher Cookhorne, President",
  "Dr. George Githinji, Vice-President",
  "Dr. Melba Layne, Board Member",
  "Dr. Lilian Young, Board Member",
  "Dr. Joseph Kiai, Board Member",
];

const DEFAULT_BMI_FACULTY = [
  "Dr. Christopher Cookhorne, Professor",
  "Dr. Melba Layne, Professor",
  "Dr. Paul, Professor",
  "Dr. Lilian Young, Professor",
  "Dr. George Githinji, Professor",
  "Dr. Joseph Kiai, Professor",
];

export interface AboutPageProps {
  tenantConfig?: SchoolPortalConfig;
}

export default function About({ tenantConfig }: AboutPageProps = {}) {
  const config = useEducationTenant(tenantConfig);
  const isBmiDefault =
    config.shortName === "BMI University" ||
    config.institutionName === "Bethel Ministries International University";

  const leadership =
    config.leadership && config.leadership.length > 0
      ? config.leadership.map((l) => ({ ...l, img: l.img || "/images/cookhorne.png" }))
      : isBmiDefault
        ? DEFAULT_BMI_LEADERSHIP
        : [
            { name: config.founderName || "Office of the Chancellor", role: `President, ${config.shortName}`, img: config.branding.logoUrl },
          ];

  const trustees =
    config.trustees && config.trustees.length > 0
      ? config.trustees
      : isBmiDefault
        ? DEFAULT_BMI_TRUSTEES
        : [`${config.founderName || "Chancellor"}, Board Chair`, `Academic Senate, ${config.shortName}`];

  const faculty =
    config.faculty && config.faculty.length > 0
      ? config.faculty
      : isBmiDefault
        ? DEFAULT_BMI_FACULTY
        : [`Senior Academic Faculty, ${config.shortName}`];

  const pillars = [
    {
      icon: "🎯",
      title: "Mission",
      body:
        config.missionStatement ||
        (isBmiDefault
          ? "Maintaining the vision of the founder, Dr. Christopher L. Cookhorne, BMI University develops Christ-centered men and women with the values, knowledge, and skills essential to impact the world."
          : `${config.institutionName} develops leaders and scholars with the values, knowledge, and skills essential to impact the world.`),
    },
    {
      icon: "👁️",
      title: "Vision",
      body:
        config.visionStatement ||
        "Through its residential and online programs, services, facilities, and collaborations, the Seminary educates men and women who will make important contributions to their workplaces and communities, follow their chosen vocations as callings to glorify God, and fulfill the Great Commission.",
    },
    {
      icon: "✝️",
      title: "Values",
      body:
        config.valuesStatement ||
        `The educational philosophy of ${config.shortName} is based on the authority of the Word of God and the Lordship of Jesus Christ. Education involves the whole person by developing the knowledge, values, and skills which enable each individual to change freely — most effectively when both instructor and student are properly related to God through Christ.`,
    },
  ];

  return (
    <main id="main-content">
      <PageHero
        image="/images/about-hero/about-hero-4-community.jpg"
        eyebrow="Our Heritage & Vision"
        title={`About ${config.shortName}`}
        subtitle="A legacy of Christ-centered education, faith, and global impact since our founding."
      />

      {/* Mission Section */}
      <section style={{ background: "#fff", padding: "6rem 2rem" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5rem", alignItems: "center" }} className="split-section">
          <div>
            <div className="gold-bar" />
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "clamp(1.8rem, 3vw, 2.6rem)", color: "#0f172a", marginBottom: "1.5rem", lineHeight: 1.15 }}>
              Statement of Mission & Purpose
            </h2>
            <p style={{ color: "#334155", fontSize: "1.05rem", lineHeight: 1.85, marginBottom: "1.25rem" }}>
              {isBmiDefault ? (
                <>
                  Maintaining the vision of the founder, <strong>Dr. Christopher L. Cookhorne</strong>, Bethel Ministries International University develops
                  Christ-centered men and women with the values, knowledge, and skills essential to impact the world.
                </>
              ) : (
                config.missionStatement || config.description || config.tagline
              )}
            </p>
            <p style={{ color: "#64748b", fontSize: "1rem", lineHeight: 1.85, marginBottom: "1.25rem" }}>
              Through its residential and online programs, services, facilities, and collaborations, the Seminary educates
              men and women who will make important contributions to their workplaces and communities, follow their
              chosen vocations as callings to glorify God, and fulfill the Great Commission.
            </p>
            <div style={{ padding: "1.25rem 1.5rem", background: "rgba(197, 160, 72, 0.08)", borderLeft: "4px solid #c5a048", borderRadius: "0 12px 12px 0" }}>
              <p style={{ color: "#0f172a", fontWeight: 600, fontSize: "0.95rem", lineHeight: 1.7, margin: 0 }}>
                &ldquo;And the things that thou hast heard of me among many witnesses, the same commit thou to faithful men, who shall be able to teach others also.&rdquo; — 2 Timothy 2:2
              </p>
            </div>
          </div>
          <div style={{ borderRadius: "20px", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.12)", aspectRatio: "4/3" }}>
            <img
              src="/images/about-hero/about-hero-3-faculty.jpg"
              alt={`Faculty and students at ${config.shortName}`}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* Philosophy of Education */}
      <section aria-labelledby="philosophy-heading" style={{ background: "#f8fafc", padding: "6rem 2rem" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "4rem" }}>
            <div className="gold-bar" style={{ margin: "0 auto 1.25rem" }} />
            <h2 id="philosophy-heading" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "clamp(1.8rem, 3vw, 2.6rem)", color: "#0f172a", marginBottom: "1rem" }}>
              Our Philosophy of Education
            </h2>
            <p style={{ color: "#64748b", fontSize: "1.05rem", maxWidth: "700px", margin: "0 auto", lineHeight: 1.7 }}>
              {config.shortName} is a distinctively Christian academic community that continues the philosophy of education
              which first gave rise to the seminary.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "2rem" }}>
            {pillars.map((p, i) => (
              <div key={i} style={{ background: "#fff", borderRadius: "20px", padding: "2.5rem", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "1.25rem" }}>{p.icon}</div>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.25rem", color: "#0f172a", marginBottom: "1rem" }}>{p.title}</h3>
                <p style={{ color: "#64748b", lineHeight: 1.75, fontSize: "0.95rem" }}>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Doctrinal Position */}
      <section style={{ background: "linear-gradient(135deg, #091223 0%, #0e1d38 100%)", padding: "5rem 2rem", textAlign: "center" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <div className="gold-bar" style={{ margin: "0 auto 1.5rem" }} />
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "clamp(1.8rem, 3vw, 2.4rem)", color: "#fff", marginBottom: "1.5rem" }}>
            Doctrinal Position
          </h2>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "1.1rem", lineHeight: 1.85 }}>
            {config.shortName} stands firmly on the authority of Scripture and historic Christian orthodoxy. We are committed
            to equipping students with a biblical worldview that integrates faith and learning across all disciplines,
            preparing them to serve the Church and impact the world for Christ.
          </p>
        </div>
      </section>

      {/* ── REAL UNIVERSITY LEADERSHIP SECTION ── */}
      <section aria-labelledby="leadership-heading" style={{ background: "#fff", padding: "6rem 2rem" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "4rem" }}>
            <div className="gold-bar" style={{ margin: "0 auto 1.25rem" }} />
            <h2 id="leadership-heading" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "clamp(1.8rem, 3vw, 2.6rem)", color: "#0f172a", marginBottom: "1rem" }}>
              Our Leadership
            </h2>
            <blockquote style={{ color: "#64748b", fontSize: "1rem", fontStyle: "italic", maxWidth: "600px", margin: "0 auto", lineHeight: 1.8 }}>
              &ldquo;Remember your leaders, who spoke the word of God to you. Consider the outcome of their way of life and imitate their faith.&rdquo;
              <cite style={{ display: "block", marginTop: "0.5rem", fontStyle: "normal", fontWeight: 700, color: "#c5a048" }}>— Hebrews 13:7 (NIV)</cite>
            </blockquote>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "2.5rem" }}>
            {leadership.map((l, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{
                  width: "150px",
                  height: "150px",
                  borderRadius: "50%",
                  overflow: "hidden",
                  margin: "0 auto 1.25rem",
                  border: "4px solid #c5a048",
                  boxShadow: "0 6px 24px rgba(197, 160, 72, 0.3)",
                  background: "#091223",
                }}>
                  <img
                    src={l.img}
                    alt={l.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: "center top",
                      display: "block",
                      transform: l.img.includes("dr-young") ? "scaleX(-1)" : "none",
                    }}
                    loading="lazy"
                  />
                </div>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.1rem", color: "#0f172a", marginBottom: "0.3rem" }}>
                  {l.name}
                </h3>
                <p style={{ color: "var(--color-gold-dark, #a07e2c)", fontSize: "0.88rem", fontWeight: 700 }}>
                  {l.role}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FACULTY & BOARD OF TRUSTEES ── */}
      <section style={{ background: "#f8fafc", padding: "5rem 2rem" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem" }} className="split-section">
          
          <div style={{ background: "#fff", borderRadius: "20px", padding: "2.5rem", boxShadow: "0 4px 16px rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.05)" }}>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "1.6rem", color: "#0f172a", marginBottom: "2rem", paddingBottom: "1rem", borderBottom: "3px solid #c5a048", display: "inline-block" }}>
              Faculty
            </h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {faculty.map((f, i) => (
                <li key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "#334155", fontSize: "0.95rem" }}>
                  <span style={{ width: "8px", height: "8px", background: "#c5a048", borderRadius: "50%", flexShrink: 0 }} />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <div style={{ background: "#fff", borderRadius: "20px", padding: "2.5rem", boxShadow: "0 4px 16px rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.05)" }}>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "1.6rem", color: "#0f172a", marginBottom: "2rem", paddingBottom: "1rem", borderBottom: "3px solid #c5a048", display: "inline-block" }}>
              Board of Trustees
            </h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {trustees.map((t, i) => (
                <li key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "#334155", fontSize: "0.95rem" }}>
                  <span style={{ width: "8px", height: "8px", background: "#091223", borderRadius: "50%", flexShrink: 0 }} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── CONTINENTAL HUB & INSTITUTES ── */}
      <section style={{ background: "#ffffff", padding: "5rem 2rem", borderTop: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "4rem", alignItems: "center" }} className="split-section">
            <div>
              <div className="gold-bar" style={{ marginBottom: "1.25rem" }} />
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "clamp(1.8rem, 3vw, 2.4rem)", color: "#0f172a", marginBottom: "1.25rem" }}>
                Continental Representation: BEMI Training Institute
              </h2>
              <p style={{ color: "#334155", fontSize: "1.02rem", lineHeight: 1.8, marginBottom: "1rem" }}>
                To serve Kenya, East Africa, and the African continent at large, Bethel Ministries International operates through <strong>BEMI Training Institute</strong>, its legally registered educational institution based at Mukurweini Campus, Kenya.
              </p>
              <p style={{ color: "#64748b", fontSize: "0.95rem", lineHeight: 1.8, marginBottom: "1.5rem" }}>
                BEMI Training Institute coordinates regional admissions, ministerial training cohorts, and financial administration—ensuring that students across Africa experience world-class academic support grounded in local African community impact.
              </p>
              <Link href="/institutes/bemi" className="btn btn-gold" style={{ display: "inline-block" }}>
                Discover BEMI Training Institute →
              </Link>
            </div>
            <div style={{ background: "#f8fafc", borderRadius: "20px", padding: "2rem", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
                <span style={{ fontSize: "1.8rem" }}>🌍</span>
                <div>
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.15rem", color: "#0f172a", margin: 0 }}>
                    Pan-African Campus & Operations
                  </h3>
                  <div style={{ fontSize: "0.8rem", color: "#c5a048", fontWeight: 700 }}>
                    Mukurweini Campus, Kenya
                  </div>
                </div>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.9rem", color: "#475569" }}>
                <li style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                  <span style={{ color: "#c5a048", fontWeight: 900 }}>✓</span>
                  <span>Registered Kenyan educational institute representing BMI across Africa</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                  <span style={{ color: "#c5a048", fontWeight: 900 }}>✓</span>
                  <span>Authorized corporate merchant for IntaSend, Paystack & M-Pesa regional fee clearance</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                  <span style={{ color: "#c5a048", fontWeight: 900 }}>✓</span>
                  <span>Direct articulation into QAHE-accredited BMI University degree pathways</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Financial Integrity & CTA */}
      <section style={{ background: "#091223", padding: "5rem 2rem", textAlign: "center" }}>
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "1.9rem", color: "#fff", marginBottom: "1.25rem" }}>
            Financial Integrity & Stewardship
          </h2>
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "1rem", lineHeight: 1.85, marginBottom: "2rem" }}>
            Bethel Ministries International University is committed to the highest standards of financial stewardship. We seek to honor
            God in fulfilling our mission as a multi-denominational educational institution training students for global Christian ministry.
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <a href="https://www.paypal.com/donate/?hosted_button_id=NTSHAE86BEUBN" target="_blank" rel="noopener noreferrer" className="btn btn-gold">
              Give / Donate →
            </a>
            <Link href="/apply" className="btn btn-outline-white">
              Apply for Admission
            </Link>
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 900px) { .split-section { grid-template-columns: 1fr !important; gap: 2rem !important; } }
      `}</style>
    </main>
  );
}
