import Link from "next/link";
import PageHero from "../components/PageHero";
import { API_WORKER_URL } from "../lib/contracts-bridge";

async function getFees() {
  try {
    const res = await fetch(`${API_WORKER_URL}/api/public/fees`, {
      next: { revalidate: 300 },
    } as any);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data || null;
  } catch (e) {
    console.warn("Could not fetch public fees from API:", e);
    return null;
  }
}

export default async function Admissions() {
  const feeData = await getFees();

  const tuitionRates = feeData?.tuition || [];
  const fees = feeData?.fees || [];
  const transferFees = feeData?.transfer_fees || [];
  const aidBands = feeData?.aid_bands || [];

  const steps = [
    { num: "01", title: "Create Your Account", body: "Fill out the initial form at /apply to create your applicant account. You will receive a verification email to confirm your email address." },
    { num: "02", title: "Complete the Application", body: "Log into the applicant portal and complete the multi-step application form, including program selection, educational background, and personal statement." },
    { num: "03", title: "Submit Transcripts & Documents", body: "Upload transcripts from all colleges and universities attended, along with ID documents and any additional materials through the secure applicant portal." },
    { num: "04", title: "Request Recommendations", body: "Use the portal to send secure recommendation requests to your referees. They will receive a unique link to upload their letters directly." },
    { num: "05", title: "Pay Application Fee", body: "Submit the non-refundable Application Fee to finalize your submission. Your application is officially submitted once the fee is cleared or deferred." },
  ];

  return (
    <main id="main-content">
      <PageHero
        image="/images/admissions-hero/admissions-hero-3-orientation.jpg"
        eyebrow="Admissions & Enrollment"
        title="Admissions at BMI"
        subtitle="Your journey toward Christ-centered leadership begins here. Join a worldwide cohort of scholars."
      />

      <section style={{ background: "#fff", padding: "5rem 2rem" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5rem", alignItems: "center" }} className="split-section">
          <div>
            <div className="gold-bar" />
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "clamp(1.8rem, 3vw, 2.6rem)", color: "#0f172a", marginBottom: "1.5rem", lineHeight: 1.15 }}>
              Ready to Begin<br />Your Journey?
            </h2>
            <p style={{ color: "#64748b", fontSize: "1.05rem", lineHeight: 1.85, marginBottom: "1.5rem" }}>
              BMI University welcomes applicants who are called to serve Christ and His Church. Whether you are pursuing
              a Bachelor&apos;s, Master&apos;s, or Doctoral degree, our admissions process is designed to be straightforward
              and supportive.
            </p>
            <Link href="/apply" className="btn btn-gold" style={{ fontSize: "1rem" }}>
              Apply Now →
            </Link>
          </div>
          <div style={{ borderRadius: "20px", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.12)", aspectRatio: "4/3" }}>
            <img
              src="/images/admissions-hero/admissions-hero-1-students-group.jpg"
              alt="Prospective and current scholars collaborating at BMI University"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* Steps */}
      <section style={{ background: "#f8fafc", padding: "5rem 2rem" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
            <div className="gold-bar" style={{ margin: "0 auto 1.25rem" }} />
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "clamp(1.8rem, 3vw, 2.6rem)", color: "#0f172a", marginBottom: "1rem" }}>
              How to Apply
            </h2>
            <p style={{ color: "#64748b", fontSize: "1.05rem", maxWidth: "600px", margin: "0 auto" }}>
              Follow these simple steps to submit your application and begin your studies at BMI University.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem" }}>
            {steps.map((s) => (
              <div key={s.num} style={{ background: "#fff", borderRadius: "16px", padding: "2rem 1.5rem", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                <span style={{ fontSize: "2rem", fontWeight: 900, color: "#d4af37", fontFamily: "'Outfit', sans-serif", display: "block", marginBottom: "0.75rem" }}>
                  {s.num}
                </span>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "1rem", color: "#0f172a", marginBottom: "0.75rem" }}>
                  {s.title}
                </h3>
                <p style={{ color: "#64748b", fontSize: "0.88rem", lineHeight: 1.65 }}>
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tuition */}
      <section style={{ background: "#fff", padding: "5rem 2rem" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <div className="gold-bar" style={{ margin: "0 auto 1.25rem" }} />
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "clamp(1.8rem, 3vw, 2.6rem)", color: "#0f172a", marginBottom: "1rem" }}>
              Tuition Rates
            </h2>
            <p style={{ color: "#64748b", fontSize: "1.05rem" }}>
              Affordable, transparent standard tuition rates across academic levels.
            </p>
          </div>

          <div style={{ borderRadius: "16px", overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 4px 16px rgba(0,0,0,0.05)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#0f172a", color: "#fff", textAlign: "left" }}>
                  <th style={{ padding: "1rem 1.5rem", fontFamily: "'Outfit', sans-serif", fontWeight: 700 }}>Program Level</th>
                  <th style={{ padding: "1rem 1.5rem", fontFamily: "'Outfit', sans-serif", fontWeight: 700 }}>Tuition Rate</th>
                </tr>
              </thead>
              <tbody>
                {tuitionRates.map((t, i) => (
                  <tr key={t.code || t.program} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "1rem 1.5rem", fontWeight: 600, color: "#1e293b" }}>{t.program}</td>
                    <td style={{ padding: "1rem 1.5rem", color: "#d4af37", fontWeight: 700 }}>{t.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Fees */}
      <section style={{ background: "#f8fafc", padding: "5rem 2rem" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <div className="gold-bar" style={{ margin: "0 auto 1.25rem" }} />
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "clamp(1.8rem, 3vw, 2.6rem)", color: "#0f172a", marginBottom: "1rem" }}>
              Institutional Fees
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }} className="split-section">
            <div style={{ background: "#fff", borderRadius: "16px", padding: "2rem", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "#0f172a", marginBottom: "1.25rem" }}>
                General Fees
              </h3>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                {fees.map((f) => (
                  <li key={f.code || f.label} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", color: "#475569", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
                    <span>{f.label}</span>
                    <strong style={{ color: "#0f172a" }}>{f.amount}</strong>
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ background: "#fff", borderRadius: "16px", padding: "2rem", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "#0f172a", marginBottom: "1.25rem" }}>
                Transfer Credit Fees
              </h3>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                {transferFees.map((tf) => (
                  <li key={tf.credits} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", color: "#475569", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
                    <span>{tf.credits}</span>
                    <strong style={{ color: "#0f172a" }}>{tf.fee}</strong>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Official Payee & Transaction Verification Notice */}
          <div
            style={{
              marginTop: "2.5rem",
              background: "#ffffff",
              borderRadius: "16px",
              padding: "2rem",
              border: "1.5px solid #e5c578",
              boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.25rem", flexWrap: "wrap" }}>
              <div style={{ fontSize: "2rem", lineHeight: 1 }}>🛡️</div>
              <div style={{ flex: 1, minWidth: "280px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem", flexWrap: "wrap" }}>
                  <h4 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.15rem", color: "#0f172a", margin: 0 }}>
                    Official Fee Payment & Payee Notice (Africa & International)
                  </h4>
                  <span style={{ background: "#dcfce7", color: "#166534", fontSize: "0.72rem", fontWeight: 800, padding: "0.15rem 0.5rem", borderRadius: "4px" }}>
                    TRANSACTION VERIFIED
                  </span>
                </div>
                <p style={{ color: "#475569", fontSize: "0.92rem", lineHeight: 1.7, margin: "0 0 1rem" }}>
                  When paying application or tuition fees online via our licensed processing partners (<strong>IntaSend</strong> for M-Pesa / Mobile Money and <strong>Paystack</strong> for Cards & Pan-African payments), your checkout merchant and bank statement will display our registered Kenyan educational institute: <strong>BEMI TRAINING INSTITUTE (trading as BMI University)</strong> with descriptor <code>BEMI*TRAINING</code>. Every transaction is directly credited to your official student account.
                </p>
                <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                  <Link
                    href="/institutes/bemi#tuition-transparency"
                    style={{
                      color: "#996d19",
                      fontWeight: 700,
                      fontSize: "0.88rem",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      textDecoration: "underline",
                      textUnderlineOffset: "3px",
                    }}
                  >
                    <span>→</span> BEMI Payment Verification Guide
                  </Link>
                  <Link
                    href="/terms"
                    style={{
                      color: "#475569",
                      fontWeight: 700,
                      fontSize: "0.88rem",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      textDecoration: "underline",
                      textUnderlineOffset: "3px",
                    }}
                  >
                    <span>→</span> Student Terms &amp; Tuition Refund Policy
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Financial Aid Overview */}
      {aidBands.length > 0 && (
        <section style={{ background: "#fff", padding: "4rem 2rem", borderTop: "1px solid #e2e8f0" }}>
          <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
              <div className="gold-bar" style={{ margin: "0 auto 1.25rem" }} />
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "clamp(1.6rem, 2.5vw, 2.2rem)", color: "#0f172a", marginBottom: "0.75rem" }}>
                Institutional Financial Aid & Rate Cards
              </h2>
              <p style={{ color: "#64748b", fontSize: "1rem", maxWidth: "680px", margin: "0 auto" }}>
                Need-based and regional subsidies are awarded as institutional fee credits against standard tuition.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
              {aidBands.map((band) => (
                <div key={band.band_key} style={{ background: "#f8fafc", borderRadius: "12px", padding: "1.5rem", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.8rem", color: "#d4af37", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
                    {band.band_key.toUpperCase()}
                  </div>
                  <h4 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "1.05rem", color: "#0f172a", marginBottom: "0.5rem" }}>
                    {band.name}
                  </h4>
                  <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#1e293b", marginBottom: "0.5rem" }}>
                    {band.discount_bps ? `${(band.discount_bps / 100).toFixed(0)}% Subsidy` : 'Access Rate Card'}
                  </div>
                  <p style={{ fontSize: "0.82rem", color: "#64748b", lineHeight: 1.5 }}>
                    Evaluated through confidential student financial aid applications.
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section style={{ background: "#0f172a", padding: "5rem 2rem", textAlign: "center" }}>
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "2.2rem", color: "#fff", marginBottom: "1rem" }}>
            Start Your Application
          </h2>
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "1.05rem", lineHeight: 1.7, marginBottom: "2rem" }}>
            Take the first step toward earning your accredited degree at BMI University.
          </p>
          <Link href="/apply" className="btn btn-gold" style={{ fontSize: "1rem", padding: "0.85rem 2.5rem" }}>
            Apply Now →
          </Link>
        </div>
      </section>

      <style>{`
        @media (max-width: 900px) { .split-section { grid-template-columns: 1fr !important; } }
      `}</style>
    </main>
  );
}
