import Link from "next/link";
import PageHero from "../components/PageHero";

export default function AccreditationPage() {
  return (
    <main id="main-content">
      <PageHero
        image="/images/academics-hero/academics-hero-3-classroom.jpg"
        eyebrow="Academic Standards & Compliance"
        title="Accreditation & Authorization"
        subtitle="Committed to rigorous theological scholarship, global quality assurance, and institutional integrity."
      />

      <section style={{ background: "#f8fafc", padding: "6rem 2rem" }}>
        <div style={{ maxWidth: "880px", margin: "0 auto" }}>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
            <section style={{ background: "#fff", padding: "2.75rem", borderRadius: "20px", boxShadow: "0 4px 20px rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.25rem" }}>
                <span style={{ fontSize: "2rem" }}>🏅</span>
                <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.6rem", color: "#0f172a", margin: 0 }}>
                  QAHE Accreditation
                </h2>
              </div>
              <p style={{ color: "#475569", fontSize: "1.05rem", lineHeight: 1.8, marginBottom: "1rem" }}>
                Bethel Ministries International University is fully accredited by the <strong>International Association for Quality Assurance in Pre-Tertiary and Higher Education (QAHE)</strong>. QAHE is an independent, private international accrediting agency that recognizes educational institutions for their commitment to maintaining high standards of academic quality and operational integrity.
              </p>
              <p style={{ color: "#475569", fontSize: "1.05rem", lineHeight: 1.8 }}>
                This accreditation underscores our dedication to providing a rigorous, faith-based education that equips students for global ministry and leadership.
              </p>
              <div style={{ marginTop: "1.75rem" }}>
                <Link
                  href="/verify"
                  className="btn btn-gold"
                  style={{ fontSize: "0.9rem", padding: "0.65rem 1.4rem" }}
                >
                  Verify QAHE Accreditation →
                </Link>
              </div>
            </section>

            <section style={{ background: "#fff", padding: "2.75rem", borderRadius: "20px", boxShadow: "0 4px 20px rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.25rem" }}>
                <span style={{ fontSize: "2rem" }}>🏛️</span>
                <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.6rem", color: "#0f172a", margin: 0 }}>
                  U.S. Recognition Status
                </h2>
              </div>
              <p style={{ color: "#475569", fontSize: "1.05rem", lineHeight: 1.8, marginBottom: "1rem" }}>
                Please note that QAHE is an independent international accrediting body and is <strong>not</strong> recognized by the United States Department of Education (USDE) or the Council for Higher Education Accreditation (CHEA).
              </p>
              <p style={{ color: "#475569", fontSize: "1.05rem", lineHeight: 1.8, margin: 0 }}>
                Prospective students should verify with receiving institutions or potential employers whether degrees issued under QAHE accreditation and religious exemption will satisfy specific transfer credit, professional licensure, or employment requirements.
              </p>
            </section>

            <section style={{ background: "#fff", padding: "2.75rem", borderRadius: "20px", boxShadow: "0 4px 20px rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.25rem" }}>
                <span style={{ fontSize: "2rem" }}>📜</span>
                <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.6rem", color: "#0f172a", margin: 0 }}>
                  State Licensure Exemption
                </h2>
              </div>
              <p style={{ color: "#475569", fontSize: "1.05rem", lineHeight: 1.8, margin: 0 }}>
                Degree programs of study offered by Bethel Ministries International University have been declared exempt from the requirements for licensure under provisions of North Carolina General Statutes Section (G.S.) 116-15(d) for exemption from licensure with respect to religious education. Exemption from licensure is not based upon any assessment of program quality under established licensing standards.
              </p>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
