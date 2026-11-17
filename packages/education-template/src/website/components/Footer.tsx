"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { SchoolPortalConfig } from "@bazion/education-contracts";
import { useEducationTenant } from "../context/EducationTenantContext";

const programCategories = [
  { label: "Bachelor's Degrees", href: "/academics#undergraduate" },
  { label: "Master's Degrees", href: "/academics#graduate" },
  { label: "Doctoral Studies (Ph.D./Th.D.)", href: "/academics#doctorate" },
  { label: "Graduate Certificates", href: "/academics#certificate" },
];

export interface FooterProps {
  tenantConfig?: SchoolPortalConfig;
}

export default function Footer({ tenantConfig }: FooterProps = {}) {
  const config = useEducationTenant(tenantConfig);
  const isBmiDefault =
    config.shortName === "BMI University" ||
    config.institutionName === "Bethel Ministries International University";
  const logoSrc =
    isBmiDefault && config.branding.logoUrl === "/images/bmi-logo.png"
      ? "/images/bmi-crest-270.png"
      : config.branding.logoUrl;
  const institutionalPortals = isBmiDefault
    ? [
        { label: "BEMI Training Institute (Africa Hub)", href: "/institutes/bemi", external: false },
        { label: "All BMI Institutes & Campuses", href: "/institutes", external: false },
        { label: "Student Portal Login ↗", href: config.portalPath || "/portal", external: false },
        { label: "Document Verification Engine", href: "/verify", external: false },
        { label: "University Management System (UMS) ↗", href: config.umsPath || "/ums", external: false },
        { label: "Terms & Student Refund Policy", href: "/terms", external: false },
        { label: "Privacy Policy & FERPA", href: "/privacy", external: false },
      ]
    : [
        { label: "Institutes & Campuses", href: "/institutes", external: false },
        { label: "Student Portal Login ↗", href: config.portalPath || "/portal", external: false },
        { label: "Document Verification Engine", href: "/verify", external: false },
        { label: "University Management System (UMS) ↗", href: config.umsPath || "/ums", external: false },
        { label: "Terms & Student Refund Policy", href: "/terms", external: false },
        { label: "Privacy Policy & FERPA", href: "/privacy", external: false },
      ];

  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const canvasRef = useRef(null);

  // Dynamic golden particle system for the footer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId;
    let particles = [];
    const PARTICLE_COUNT = 35;

    const resize = () => {
      if (!canvas.parentElement) return;
      canvas.width = canvas.parentElement.offsetWidth;
      canvas.height = canvas.parentElement.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * (canvas.width || 1200),
        y: Math.random() * (canvas.height || 400),
        r: Math.random() * 1.8 + 0.5,
        dx: (Math.random() - 0.5) * 0.35,
        dy: -(Math.random() * 0.35 + 0.15),
        baseAlpha: Math.random() * 0.4 + 0.2,
        twinkleSpeed: Math.random() * 0.03 + 0.015,
        twinkleOffset: Math.random() * Math.PI * 2,
      });
    }

    let frame = 0;
    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.x += p.dx;
        p.y += p.dy;

        if (p.y < -5) p.y = canvas.height + 5;
        if (p.x < -5) p.x = canvas.width + 5;
        if (p.x > canvas.width + 5) p.x = -5;

        const currentAlpha = p.baseAlpha * (0.65 + 0.35 * Math.sin(frame * p.twinkleSpeed + p.twinkleOffset));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(229, 197, 120, ${currentAlpha})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = "rgba(229, 197, 120, 0.6)";
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email) setSubscribed(true);
  };

  return (
    <footer
      className="bmi-footer"
      style={{
        display: "block",
        width: "100%",
        boxSizing: "border-box",
        position: "relative",
        background: "linear-gradient(135deg, rgba(85, 12, 24, 0.95) 0%, rgba(35, 10, 20, 0.96) 35%, #091223 75%, #040812 100%)",
        color: "#ffffff",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        overflow: "hidden",
        borderTop: "none",
        padding: 0,
        margin: 0,
      }}
    >
      {/* ── Background Particle Canvas ── */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          zIndex: 1,
          pointerEvents: "none",
        }}
      />

      {/* ── Gold Accent Top Border ── */}
      <div style={{ height: "4px", width: "100%", background: "linear-gradient(90deg, #c5a048 0%, #e5c578 50%, #c5a048 100%)", position: "relative", zIndex: 2 }} />

      {/* ── Main Footer Grid ── */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: "1280px",
          width: "100%",
          boxSizing: "border-box",
          margin: "0 auto",
          padding: "64px 32px 48px",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "48px",
        }}
        className="footer-grid"
      >
        {/* Column 1 — Brand & Accreditation */}
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <Link href="/" aria-label={`${config.shortName} — Home`} style={{ display: "flex", alignItems: "center", gap: "12px", textDecoration: "none" }}>
            <img src={logoSrc} alt={`${config.shortName} Crest`} style={{ height: "54px", width: "auto", objectFit: "contain", filter: "drop-shadow(0 2px 8px rgba(197, 160, 72, 0.3))" }} />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "1.5rem", color: "#ffffff", letterSpacing: "-0.01em", lineHeight: 0.95 }}>
                {isBmiDefault ? "BMI" : config.shortName}
              </span>
              <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: "0.58rem", color: "#e5c578", letterSpacing: "0.22em", textTransform: "uppercase", marginTop: "3px" }}>
                {isBmiDefault ? "University" : config.institutionName}
              </span>
            </div>
          </Link>

          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.88rem", lineHeight: 1.7, margin: 0 }}>
            {isBmiDefault
              ? "Bethel Ministries International University is dedicated to empowering Christ-centered scholars with biblical truth, academic excellence, and servant leadership."
              : config.description || config.tagline}
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.5rem" }}>
            <Link href="/accreditation" aria-label="QAHE Accreditation" style={{ display: "inline-block" }}>
              <span style={{
                background: "#ffffff",
                padding: "6px 10px",
                borderRadius: "6px",
                display: "inline-flex",
                alignItems: "center",
                boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
              }}>
                <img 
                  src="/images/qahe-logo.jpg" 
                  alt="QAHE Accredited Institution" 
                  style={{ height: "38px", width: "auto", objectFit: "contain", display: "block" }} 
                />
              </span>
            </Link>
          </div>
        </div>

        {/* Column 2 — Academic Programs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.1rem", fontWeight: 800, color: "#e5c578", letterSpacing: "-0.01em", margin: 0 }}>
            Academic Degrees
          </h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
            {programCategories.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.88rem", transition: "color 0.2s" }}
                  onMouseEnter={(e) => e.currentTarget.style.color = "#e5c578"}
                  onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.8)"}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Column 3 — Portals & Verification */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.1rem", fontWeight: 800, color: "#e5c578", letterSpacing: "-0.01em", margin: 0 }}>
            Portals & Verification
          </h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
            {institutionalPortals.map((item) => (
              <li key={item.label}>
                {item.external ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.88rem", transition: "color 0.2s" }}
                    onMouseEnter={(e) => e.currentTarget.style.color = "#e5c578"}
                    onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.8)"}
                  >
                    {item.label} ↗
                  </a>
                ) : (
                  <Link
                    href={item.href}
                    style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.88rem", transition: "color 0.2s" }}
                    onMouseEnter={(e) => e.currentTarget.style.color = "#e5c578"}
                    onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.8)"}
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Column 4 — Institutional Contact */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.1rem", fontWeight: 800, color: "#e5c578", letterSpacing: "-0.01em", margin: 0 }}>
            Admissions Office
          </h3>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.88rem", lineHeight: 1.6, margin: 0 }}>
            Office of Admissions & Student Records<br />
            {config.institutionName}<br />
            {isBmiDefault ? (
              <>
                <strong>Africa Regional Hub:</strong> BEMI Training Institute, Mukurweini Campus, Kenya<br />
              </>
            ) : (
              <>
                <strong>Campus:</strong> {config.contact.address}<br />
              </>
            )}
            <strong>Email:</strong> {config.contact.adminEmail}<br />
            <strong>Admissions:</strong> {config.contact.admissionsEmail}
          </p>

          <form onSubmit={handleSubscribe} style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <input
              type="email"
              placeholder="Your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                padding: "0.65rem 0.9rem",
                borderRadius: "8px",
                border: "1px solid rgba(197,160,72,0.4)",
                background: "rgba(255,255,255,0.08)",
                color: "#ffffff",
                fontSize: "0.85rem",
                outline: "none",
              }}
            />
            <button type="submit" className="btn btn-gold" style={{ padding: "0.6rem 1rem", fontSize: "0.82rem" }}>
              {subscribed ? "✓ Subscribed" : "Subscribe to Academic Updates"}
            </button>
          </form>
        </div>
      </div>

      {/* ── Bottom Bar ── */}
      <div
        className="footer-bottom-bar"
        style={{
          position: "relative",
          zIndex: 2,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          padding: "24px 32px",
          background: "rgba(4, 7, 13, 0.85)",
          fontSize: "0.78rem",
          color: "rgba(255,255,255,0.6)",
          textAlign: "center",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <div style={{ maxWidth: "1280px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              © {new Date().getFullYear()} {config.institutionName} ({config.shortName}). All rights reserved.
            </div>
            <div>
              {isBmiDefault
                ? "Exempt from licensure under N.C.G.S. 116-15(d) for religious education • QAHE Accredited"
                : config.accreditationLabel || "Accredited Higher Education Institution"}
            </div>
          </div>
          <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.5, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "0.5rem" }}>
            {isBmiDefault ? (
              <>
                In Africa, Bethel Ministries International operates through <strong>BEMI Training Institute</strong> (registered in Kenya, Mukurweini Campus). All continental tuition payments and IntaSend / Paystack / M-Pesa settlements are legally receipted by BEMI Training Institute (trading as BMI University).
              </>
            ) : (
              config.legalDisclaimer ||
              `All academic programs, tuition settlements, and credentials are issued under the authority of ${config.legalEntityName || config.institutionName}.`
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .footer-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 32px !important; }
        }
        @media (max-width: 580px) {
          .footer-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
        }
      `}</style>
    </footer>
  );
}
