"use client";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { PROGRAMS as FALLBACK_PROGRAMS, API_WORKER_URL } from "../lib/contracts-bridge";
import PageHero from "../components/PageHero";

export default function Academics() {
  // ── Authoritative program catalog from @bmi/shared with live API fallback ──
  const [programs, setPrograms] = useState(FALLBACK_PROGRAMS);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_WORKER_URL}/api/public/programs`, { cache: 'no-store' });
        if (!res.ok) return;
        const body = await res.json();
        // Only override if the API returned a non-empty array of valid programs
        if (!body?.success || !Array.isArray(body.data) || body.data.length === 0) return;
        if (cancelled) return;
        setPrograms(body.data.map(p => ({
          label: p.label ?? p.name,
          level: p.level,
          description: p.description,
          icon: p.icon ?? undefined,
        })));
      } catch { /* silently keep complete catalog */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const diplomas = useMemo(() => programs.filter(p => p.level === 'diploma').map(p => ({ title: p.label, desc: p.description })), [programs]);
  const bachelors = useMemo(() => programs.filter(p => p.level === 'undergraduate').map(p => ({ title: p.label, desc: p.description })), [programs]);
  const masters = useMemo(() => programs.filter(p => p.level === 'graduate').map(p => ({ title: p.label, desc: p.description })), [programs]);
  const doctorates = useMemo(() => programs.filter(p => p.level === 'doctorate').map(p => ({ title: p.label, desc: p.description })), [programs]);
  const certificates = useMemo(() => programs.filter(p => p.level === 'certificate').map(p => ({ title: p.label, desc: p.description })), [programs]);

  const renderCards = (items) =>
    items.map((p, i) => (
      <article
        key={i}
        className="program-card"
        style={{
          background: "#fff",
          borderRadius: "16px",
          padding: "2rem",
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          transition: "transform 0.25s ease, box-shadow 0.25s ease",
        }}
      >
        <div style={{ width: "40px", height: "4px", borderRadius: "999px", background: "linear-gradient(90deg, #c5a048, #e5c578)", marginBottom: "0.25rem" }} />
        <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.15rem", color: "#0f172a", lineHeight: 1.3 }}>
          {p.title}
        </h3>
        <p style={{ color: "#64748b", fontSize: "0.92rem", lineHeight: 1.7, flexGrow: 1 }}>
          {p.desc}
        </p>
        <Link
          href="/apply"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            color: "var(--color-gold-dark, #a07e2c)",
            fontWeight: 700,
            fontSize: "0.88rem",
            marginTop: "0.5rem",
            textDecoration: "underline",
            width: "fit-content",
          }}
        >
          Apply Today →
        </Link>
      </article>
    ));

  return (
    <main id="main-content">
      <PageHero
        image="/images/academics-hero/academics-hero-1-studying.jpg"
        eyebrow="BMI University • Academic Excellence"
        title="Academics at BMI"
        subtitle="A Christ-centered curriculum designed to equip you for ministry and global impact."
      />

      {/* Intro */}
      <section style={{ background: "#fff", padding: "5rem 2rem" }}>
        <div style={{ maxWidth: "880px", margin: "0 auto", textAlign: "center" }}>
          <div className="gold-bar" style={{ margin: "0 auto 1.25rem" }} />
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "clamp(1.8rem, 3vw, 2.6rem)", color: "#0f172a", marginBottom: "1.25rem" }}>
            Programs of Study
          </h2>
          <p style={{ color: "#64748b", fontSize: "1.1rem", lineHeight: 1.8 }}>
            Bethel Ministries International University offers degree programs at the Bachelor&apos;s, Master&apos;s, and Doctoral level, along with
            Graduate Certificates. All programs are designed to develop Christ-centered leaders with the values,
            knowledge, and skills essential to impact the world.
          </p>
          <div style={{ marginTop: "1.5rem", padding: "1rem 1.5rem", background: "rgba(197, 160, 72, 0.1)", borderRadius: "12px", border: "1px solid rgba(197, 160, 72, 0.3)", display: "inline-block" }}>
            <p style={{ color: "#0f172a", fontSize: "0.9rem", fontWeight: 700, margin: 0 }}>
              🏅 Fully accredited by QAHE — International Association for Quality Assurance in Higher Education
            </p>
          </div>
        </div>
      </section>

      {/* Diplomas */}
      {diplomas.length > 0 && (
        <section id="diplomas" aria-labelledby="diplomas-heading" style={{ background: "#fff", padding: "5rem 2rem", scrollMarginTop: "120px" }}>
          <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2.5rem" }}>
              <div style={{ width: "70px", height: "70px", background: "#c5a048", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", padding: "8px", flexShrink: 0 }}>
                <img src="/images/diploma-icon.png" alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} loading="lazy" />
              </div>
              <div>
                <h2 id="diplomas-heading" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "clamp(1.6rem, 2.5vw, 2.2rem)", color: "#0f172a", lineHeight: 1.1 }}>
                  Diploma Programmes
                </h2>
                <p style={{ color: "#64748b", marginTop: "0.25rem" }}>Foundational ministry and theological training</p>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
              {renderCards(diplomas)}
            </div>
          </div>
        </section>
      )}

      {/* Bachelor's */}
      <section id="undergraduate" aria-labelledby="bachelors-heading" style={{ background: "#f8fafc", padding: "5rem 2rem", scrollMarginTop: "120px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2.5rem" }}>
            <div style={{ width: "70px", height: "70px", background: "#091223", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", padding: "8px", flexShrink: 0 }}>
              <img src="/images/bachelor-icon.png" alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} loading="lazy" />
            </div>
            <div>
              <h2 id="bachelors-heading" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "clamp(1.6rem, 2.5vw, 2.2rem)", color: "#0f172a", lineHeight: 1.1 }}>
                Bachelor&apos;s Degrees
              </h2>
              <p style={{ color: "#64748b", marginTop: "0.25rem" }}>Undergraduate programs grounded in Scripture and theology</p>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
            {renderCards(bachelors)}
          </div>
        </div>
      </section>

      {/* Master's */}
      <section id="graduate" aria-labelledby="masters-heading" style={{ background: "#fff", padding: "5rem 2rem", scrollMarginTop: "120px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2.5rem" }}>
            <div style={{ width: "70px", height: "70px", background: "#c5a048", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", padding: "8px", flexShrink: 0 }}>
              <img src="/images/masters-icon.png" alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} loading="lazy" />
            </div>
            <div>
              <h2 id="masters-heading" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "clamp(1.6rem, 2.5vw, 2.2rem)", color: "#0f172a", lineHeight: 1.1 }}>
                Master&apos;s Degrees
              </h2>
              <p style={{ color: "#64748b", marginTop: "0.25rem" }}>Advanced theological and ministry education</p>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
            {renderCards(masters)}
          </div>
        </div>
      </section>

      {/* Doctorate */}
      <section id="doctorate" aria-labelledby="doctorate-heading" style={{ background: "#f8fafc", padding: "5rem 2rem", scrollMarginTop: "120px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2.5rem" }}>
            <div style={{ width: "70px", height: "70px", background: "#091223", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", padding: "8px", flexShrink: 0 }}>
              <img src="/images/phd-icon.png" alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} loading="lazy" />
            </div>
            <div>
              <h2 id="doctorate-heading" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "clamp(1.6rem, 2.5vw, 2.2rem)", color: "#0f172a", lineHeight: 1.1 }}>
                Doctorate Programs
              </h2>
              <p style={{ color: "#64748b", marginTop: "0.25rem" }}>The highest level of theological education</p>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
            {renderCards(doctorates)}
          </div>
        </div>
      </section>

      {/* Certificates */}
      <section id="certificate" aria-labelledby="certificates-heading" style={{ background: "#091223", padding: "5rem 2rem", scrollMarginTop: "120px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <h2 id="certificates-heading" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "clamp(1.6rem, 2.5vw, 2.2rem)", color: "#fff", marginBottom: "0.75rem" }}>
              Graduate Certificates
            </h2>
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "1rem" }}>Focused credentials for continued growth and ministry preparation</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem", marginBottom: "3rem" }}>
            {certificates.map((c, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(197,160,72,0.25)", borderRadius: "16px", padding: "2rem" }}>
                <div style={{ width: "40px", height: "4px", background: "#c5a048", borderRadius: "999px", marginBottom: "1rem" }} />
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, color: "#fff", fontSize: "1.1rem", marginBottom: "0.75rem" }}>{c.title}</h3>
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.9rem", lineHeight: 1.7 }}>{c.desc}</p>
              </div>
            ))}
          </div>

          {/* Disclaimer */}
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "1.5rem 2rem", marginBottom: "3rem" }}>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem", lineHeight: 1.7, margin: 0 }}>
              Degree Program(s) of study offered by Bethel Ministries International University have been declared by the appropriate state authority exempt from the requirements for licensure, under provisions of North Carolina General Statutes (G.S.) 116-15 (d) for exemption from licensure with respect to religious education. Exemption from licensure is not based upon any assessment of program quality under established licensing standards.
            </p>
          </div>

          <div style={{ textAlign: "center" }}>
            <Link href="/apply" className="btn btn-gold" style={{ fontSize: "1rem", padding: "1rem 2.5rem" }}>
              Apply Today →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
