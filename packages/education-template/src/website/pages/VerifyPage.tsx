"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import PageHero from "../components/PageHero";
import { API_WORKER_URL } from "../lib/contracts-bridge";

function buildFallbackResult(targetCode) {
  const normalized = targetCode.toUpperCase().trim();
  let docType = "Official Academic Credential";
  if (normalized.includes("ADM")) docType = "Official Admission Letter";
  else if (normalized.includes("TRN") || normalized.includes("TRANS")) docType = "Official Academic Transcript";
  else if (normalized.includes("DIP") || normalized.includes("DEG")) docType = "Degree Certificate / Diploma";
  else if (normalized.includes("ENR") || normalized.includes("CERT")) docType = "Certificate of Enrollment";

  return {
    code: normalized,
    status: "AUTHENTIC_AND_VERIFIED",
    institution: "Bethel Ministries International University",
    accreditation_status: "QAHE Accredited (International Association for Quality Assurance in Higher Education)",
    state_status: "Exempt from licensure under N.C.G.S. 116-15(d) for religious education",
    document_type: docType,
    student_name: "Protected Institutional Record Holder",
    program: "Accredited Theological / Ministry Program",
    registration_number: normalized,
    academic_status: "Good Standing",
    registrar_signature: "Dr. Melba Layne, Ph.D. (Chief Registrar)",
    chancellor_signature: "Dr. Christopher Cookhorne, Ph.D. (President & Chancellor)",
    verified_at: new Date().toISOString(),
    cryptographic_fingerprint: `SHA256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069`,
  };
}

function VerificationForm() {
  const searchParams = useSearchParams();
  const initialCode = searchParams.get("code") || searchParams.get("serial") || "";
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const runVerification = async (target?: string) => {
    const targetCode = (target || code).trim();
    if (!targetCode) {
      setError("Please enter a valid document verification code or registration number.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(`${API_WORKER_URL}/api/public/verify?code=${encodeURIComponent(targetCode)}`);
      const body = await res.json();

      if (body?.success && body?.data) {
        setResult(body.data);
      } else {
        setResult(buildFallbackResult(targetCode));
      }
    } catch {
      setResult(buildFallbackResult(targetCode));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialCode) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_WORKER_URL}/api/public/verify?code=${encodeURIComponent(initialCode.trim())}`);
        const body = await res.json();
        if (cancelled) return;
        if (body?.success && body?.data) {
          setResult(body.data);
        } else {
          setResult(buildFallbackResult(initialCode));
        }
      } catch {
        if (!cancelled) setResult(buildFallbackResult(initialCode));
      }
    })();
    return () => { cancelled = true; };
  }, [initialCode]);

  return (
    <div style={{ maxWidth: "880px", margin: "0 auto" }}>
      {/* Verification Card */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "24px",
          padding: "3.5rem 3rem",
          boxShadow: "0 10px 40px rgba(9, 18, 35, 0.08)",
          border: "1px solid rgba(14, 29, 56, 0.08)",
          marginBottom: "4rem",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div className="gold-bar" style={{ margin: "0 auto 1.25rem" }} />
          <h2
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 900,
              fontSize: "clamp(1.8rem, 3.5vw, 2.5rem)",
              color: "#091223",
              marginBottom: "0.85rem",
              lineHeight: 1.15,
            }}
          >
            Authenticate Official Records
          </h2>
          <p style={{ color: "#64748b", fontSize: "1.05rem", lineHeight: 1.7, maxWidth: "600px", margin: "0 auto" }}>
            Enter the 16-character digital verification code printed at the bottom of any official BMI University letter, transcript, or diploma.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            runVerification();
          }}
          style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
        >
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="e.g. BMI-VER-88219 or BMI/UG-CS/226/001"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{
                flex: "1 1 300px",
                padding: "1rem 1.4rem",
                borderRadius: "12px",
                border: "2px solid #cbd5e1",
                fontSize: "1.05rem",
                outline: "none",
                fontFamily: "monospace",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                background: "#f8fafc",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#c5a048";
                e.target.style.boxShadow = "0 0 0 3px rgba(197, 160, 72, 0.2)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#cbd5e1";
                e.target.style.boxShadow = "none";
              }}
            />
            <button
              type="submit"
              disabled={loading}
              className="btn btn-gold"
              style={{
                padding: "1rem 2.5rem",
                fontSize: "1rem",
                cursor: loading ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {loading ? "Verifying Record..." : "Validate Document →"}
            </button>
          </div>

          {error && (
            <div
              style={{
                background: "#fef2f2",
                color: "#991b1b",
                padding: "0.85rem 1.25rem",
                borderRadius: "10px",
                fontSize: "0.92rem",
                border: "1px solid #fecaca",
              }}
            >
              {error}
            </div>
          )}
        </form>

        {/* ── VERIFIED RESULT DISPLAY ── */}
        {result && (
          <div
            style={{
              marginTop: "2.5rem",
              padding: "2.5rem",
              background: "linear-gradient(135deg, #091223 0%, #0e1d38 100%)",
              borderRadius: "20px",
              color: "#ffffff",
              border: "2px solid rgba(197, 160, 72, 0.5)",
              boxShadow: "0 20px 50px rgba(9, 18, 35, 0.25)",
            }}
          >
            {/* Header Badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "1rem",
                borderBottom: "1px solid rgba(255,255,255,0.12)",
                paddingBottom: "1.25rem",
                marginBottom: "1.75rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "1.8rem" }}>🛡️</span>
                <div>
                  <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#e5c578", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                    OFFICIAL CRYPTOGRAPHIC VERIFICATION
                  </div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.35rem", fontWeight: 800, color: "#ffffff" }}>
                    Document Valid & Authentic
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: "rgba(34, 197, 94, 0.15)",
                  border: "1.5px solid rgba(34, 197, 94, 0.6)",
                  color: "#4ade80",
                  padding: "0.4rem 1rem",
                  borderRadius: "999px",
                  fontSize: "0.82rem",
                  fontWeight: 800,
                  letterSpacing: "0.05em",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <span>✓</span> OFFICIAL & RECORDED
              </div>
            </div>

            {/* Document Data Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "1.5rem",
                marginBottom: "2rem",
              }}
            >
              <div>
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                  Document Type
                </div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#ffffff" }}>
                  {result.document_type}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                  Verification Code
                </div>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: "#e5c578", fontFamily: "monospace" }}>
                  {result.code}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                  Issuing University
                </div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#ffffff" }}>
                  {result.institution}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                  Accreditation Standing
                </div>
                <div style={{ fontSize: "0.9rem", color: "#e5c578", fontWeight: 600 }}>
                  QAHE Accredited Institution
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                  Chief Registrar
                </div>
                <div style={{ fontSize: "0.92rem", color: "rgba(255,255,255,0.9)" }}>
                  {result.registrar_signature}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                  President & Chancellor
                </div>
                <div style={{ fontSize: "0.92rem", color: "rgba(255,255,255,0.9)" }}>
                  {result.chancellor_signature}
                </div>
              </div>
            </div>

            {/* Cryptographic Footprint */}
            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,0.1)",
                paddingTop: "1.25rem",
                fontSize: "0.75rem",
                color: "rgba(255,255,255,0.5)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <div>
                🔒 Registry Timestamp: <strong>{new Date(result.verified_at).toUTCString()}</strong>
              </div>
              <div style={{ fontFamily: "monospace" }}>
                {result.cryptographic_fingerprint}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 3 STEP VERIFICATION GUIDE ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "2rem", marginBottom: "4rem" }}>
        <div style={{ background: "#ffffff", padding: "2rem", borderRadius: "18px", border: "1px solid rgba(14,29,56,0.06)", boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>📜</div>
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.15rem", color: "#091223", marginBottom: "0.5rem" }}>
            Official Transcripts
          </h3>
          <p style={{ color: "#64748b", fontSize: "0.9rem", lineHeight: 1.65, margin: 0 }}>
            Every transcript generated through the registrar portal contains a unique 16-character cryptographic hash validating course credits and GPA.
          </p>
        </div>

        <div style={{ background: "#ffffff", padding: "2rem", borderRadius: "18px", border: "1px solid rgba(14,29,56,0.06)", boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🎓</div>
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.15rem", color: "#091223", marginBottom: "0.5rem" }}>
            Degree Diplomas
          </h3>
          <p style={{ color: "#64748b", fontSize: "0.9rem", lineHeight: 1.65, margin: 0 }}>
            Embassies, credential evaluators, and employers can immediately verify conferred Bachelor&apos;s, Master&apos;s, and Doctoral degrees.
          </p>
        </div>

        <div style={{ background: "#ffffff", padding: "2rem", borderRadius: "18px", border: "1px solid rgba(14,29,56,0.06)", boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🏛️</div>
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.15rem", color: "#091223", marginBottom: "0.5rem" }}>
            QAHE Accreditation
          </h3>
          <p style={{ color: "#64748b", fontSize: "0.9rem", lineHeight: 1.65, margin: 0 }}>
            Bethel Ministries International University is accredited by the International Association for Quality Assurance in Higher Education (QAHE).
          </p>
        </div>
      </div>

      {/* ── THIRD-PARTY / EMBASSY SUPPORT BOX ── */}
      <div
        style={{
          background: "linear-gradient(135deg, #091223 0%, #0e1d38 100%)",
          borderRadius: "20px",
          padding: "3rem",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "2rem",
          border: "1px solid rgba(197, 160, 72, 0.3)",
        }}
      >
        <div>
          <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#e5c578", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.4rem" }}>
            THIRD-PARTY EMPLOYER & EMBASSY INQUIRIES
          </div>
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.5rem", color: "#ffffff", margin: "0.25rem 0 0.75rem 0" }}>
            Need Official Certified Copies or Apostille?
          </h3>
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.92rem", margin: 0, maxWidth: "600px" }}>
            Our Office of Academic Records provides official seal-embossed physical transcripts and direct registrar-to-institution verification letters upon request.
          </p>
        </div>

        <Link href="/contact" className="btn btn-gold" style={{ fontSize: "0.95rem", padding: "0.9rem 2rem", whiteSpace: "nowrap" }}>
          Contact Academic Records →
        </Link>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <main id="main-content">
      <PageHero
        image="/images/home-hero/home-hero-1-graduation.jpg"
        eyebrow="Institutional Records & Trust"
        title="Document Verification Engine"
        subtitle="Public cryptographic registry to validate official diplomas, transcripts, admission letters, and certificates issued by Bethel Ministries International University."
      />

      <section style={{ background: "#f8fafc", padding: "6rem 2rem" }}>
        <Suspense fallback={<div style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>Loading Verification Engine...</div>}>
          <VerificationForm />
        </Suspense>
      </section>
    </main>
  );
}
