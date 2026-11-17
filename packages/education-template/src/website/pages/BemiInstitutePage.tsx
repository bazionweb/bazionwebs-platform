import Link from "next/link";
import PageHero from "../components/PageHero";

export const metadata = {
  title: "BEMI Training Institute — Africa Regional Hub | BMI University",
  description:
    "BEMI Training Institute is the registered Kenyan educational institute and regional African headquarters for Bethel Ministries International (BMI University), serving Kenya and the continent at large.",
};

export default function BemiInstitutePage() {
  const highlights = [
    {
      icon: "🇰🇪",
      title: "Registered in Kenya",
      desc: "Incorporated and operating from Nairobi, Kenya, serving as the official legal and regional anchor.",
    },
    {
      icon: "🌍",
      title: "Pan-African Representation",
      desc: "Responsible for coordinating admissions, regional cohorts, and academic delivery across the African continent.",
    },
    {
      icon: "🏛️",
      title: "Mukurweini Campus & Online",
      desc: "Situated at Mukurweini Campus, Kenya, with blended physical workshops and hybrid digital classrooms for all African nations.",
    },
    {
      icon: "💳",
      title: "Official Settlement Entity",
      desc: "Registered corporate merchant for IntaSend, Paystack, M-Pesa, and regional tuition payment clearances.",
    },
  ];

  const pathways = [
    {
      badge: "Certificate & Foundation",
      title: "Certificate in Biblical Studies & Ministry",
      duration: "6 - 12 Months",
      format: "Online & Blended",
      desc: "Designed for pastors, church planters, and lay leaders seeking rigorous theological grounding and practical ministerial tools.",
      outcomes: ["Scriptural Hermeneutics", "Pastoral Care", "Foundational Christian Ethics"],
    },
    {
      badge: "Executive Diploma",
      title: "Diploma in Christian Leadership & Administration",
      duration: "1 - 2 Years",
      format: "Hybrid Cohorts",
      desc: "Equipping ministry executives, non-profit directors, and educators with strategic governance, organizational leadership, and community development skills.",
      outcomes: ["Strategic Church Governance", "Financial Stewardship", "Pan-African Missions Strategy"],
    },
    {
      badge: "University Articulation",
      title: "BMI University Degree Pathways",
      duration: "Full Degree Programs",
      format: "Fully Accredited Online / Hybrid",
      desc: "Direct progression into BMI University undergraduate, master’s, and doctoral programs (B.Th., M.Div., Ph.D., Th.D.) with full credit transfer recognition.",
      outcomes: ["Bachelor of Theology (B.Th.)", "Master of Divinity (M.Div.)", "Doctor of Ministry (D.Min.) / Ph.D."],
    },
  ];

  const faqs = [
    {
      q: "What is the relationship between BEMI Training Institute and BMI University?",
      a: "BEMI Training Institute is the registered educational institution established in Kenya under Bethel Ministries International (BMI). It serves as BMI’s official regional headquarters and representation for Africa at large, coordinating regional admissions, student welfare, academic mentorship, and physical campus operations.",
    },
    {
      q: "Why do I see 'BEMI TRAINING INSTITUTE' on my fee payment checkout or bank statement?",
      a: "BEMI Training Institute is the officially registered corporate and banking merchant in Kenya through which Bethel Ministries International processes all regional financial settlements via licensed payment partners IntaSend and Paystack. In banking and gateway terms, the entity is registered as 'BEMI TRAINING INSTITUTE (trading as BMI University)' with the statement descriptor 'BEMI*TRAINING'. Every fee paid through these authorized gateways is instantly credited directly to your official BMI University student account.",
    },
    {
      q: "Can students from outside Kenya study through BEMI Training Institute?",
      a: "Yes. BEMI Training Institute is expressly mandated to serve the entire African continent. Students from Nigeria, Ghana, South Africa, Uganda, Tanzania, Rwanda, Liberia, Zimbabwe, and across Africa enroll in programs supported by BEMI's regional student support and administrative team.",
    },
    {
      q: "Are credentials issued through BEMI recognized internationally?",
      a: "Yes. In addition to local institutional standing, programs articulated through Bethel Ministries International University benefit from international accreditation through the International Association for Quality Assurance in Pre-Tertiary & Higher Education (QAHE) and reciprocal institutional partnerships.",
    },
  ];

  return (
    <main id="main-content" style={{ background: "#ffffff", color: "#0f172a" }}>
      {/* ── Page Hero ── */}
      <PageHero
        image="/images/home-hero/home-hero-3-campus.jpg"
        eyebrow="Pan-African Continental Representation"
        title="BEMI Training Institute"
        subtitle="The Kenyan registered institute and continental gateway for Bethel Ministries International — empowering Christ-centered scholars and leaders across Africa."
      />

      {/* ── Institutional Breadcrumb / Badge Strip ── */}
      <section
        style={{
          background: "#091223",
          borderBottom: "1px solid rgba(197, 160, 72, 0.25)",
          padding: "1rem 2rem",
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
            fontSize: "0.85rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", color: "rgba(255,255,255,0.7)" }}>
            <Link href="/" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none" }}>
              Home
            </Link>
            <span>›</span>
            <Link href="/institutes" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none" }}>
              Institutes
            </Link>
            <span>›</span>
            <span style={{ color: "#e5c578", fontWeight: 700 }}>BEMI Training Institute (Africa Hub)</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
            <span style={{ color: "#e5c578", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span>📍</span> Mukurweini Campus, Kenya
            </span>
            <span style={{ color: "rgba(255,255,255,0.3)" }}>|</span>
            <a
              href="#tuition-transparency"
              style={{
                color: "#ffffff",
                textDecoration: "underline",
                textUnderlineOffset: "4px",
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
              }}
            >
              <span>💳</span> Fee Verification Guide
            </a>
          </div>
        </div>
      </section>

      {/* ── Key Highlights Strip ── */}
      <section style={{ padding: "4rem 2rem", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "1.75rem",
            }}
          >
            {highlights.map((h) => (
              <div
                key={h.title}
                style={{
                  background: "#ffffff",
                  padding: "2rem",
                  borderRadius: "16px",
                  border: "1px solid rgba(15, 23, 42, 0.08)",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  transition: "transform 0.2s, box-shadow 0.2s",
                }}
              >
                <div style={{ fontSize: "2rem" }}>{h.icon}</div>
                <h3
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontWeight: 800,
                    fontSize: "1.15rem",
                    color: "#0f172a",
                    margin: 0,
                  }}
                >
                  {h.title}
                </h3>
                <p style={{ color: "#475569", fontSize: "0.92rem", lineHeight: 1.6, margin: 0 }}>
                  {h.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pan-African Mandate & Representation Section ── */}
      <section style={{ padding: "6rem 2rem", background: "#ffffff" }}>
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "5rem",
            alignItems: "center",
          }}
          className="split-section"
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                color: "#c5a048",
                fontWeight: 800,
                fontSize: "0.82rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                marginBottom: "0.75rem",
              }}
            >
              <span>✦</span> Continental Mandate
            </div>
            <h2
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontWeight: 900,
                fontSize: "clamp(2rem, 3.2vw, 2.8rem)",
                color: "#0f172a",
                lineHeight: 1.15,
                marginBottom: "1.5rem",
              }}
            >
              Rooted in Kenya, Empowering all of Africa
            </h2>
            <p style={{ color: "#334155", fontSize: "1.05rem", lineHeight: 1.85, marginBottom: "1.25rem" }}>
              <strong>BEMI Training Institute</strong> is Bethel Ministries International’s official, legally registered educational institute in Kenya. Established to advance theological education and leadership training throughout the African continent, BEMI serves as the vital continental bridge between BMI’s global academic administration and African students, ministries, and communities.
            </p>
            <p style={{ color: "#64748b", fontSize: "0.98rem", lineHeight: 1.8, marginBottom: "1.75rem" }}>
              From its Mukurweini Campus in Kenya, BEMI provides local administrative oversight, accredited vocational and theological training courses, and seamless articulation into BMI University degree programs. Whether you reside in Kenya, East Africa, West Africa, or Southern Africa, BEMI Training Institute ensures that your educational journey is supported locally with world-class integrity.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1.25rem",
                background: "#f1f5f9",
                padding: "1.5rem",
                borderRadius: "14px",
                borderLeft: "4px solid #c5a048",
              }}
            >
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                  Registered Entity
                </span>
                <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "0.95rem", marginTop: "2px" }}>
                  BEMI Training Institute
                </div>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                  Continental Role
                </span>
                <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "0.95rem", marginTop: "2px" }}>
                  African Representation & Operations
                </div>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                  Campus Headquarters
                </span>
                <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "0.95rem", marginTop: "2px" }}>
                  Mukurweini Campus, Kenya
                </div>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                  Academic Alliance
                </span>
                <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "0.95rem", marginTop: "2px" }}>
                  BMI University (Bethel Ministries Int.)
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div
              style={{
                borderRadius: "20px",
                overflow: "hidden",
                boxShadow: "0 20px 50px rgba(0,0,0,0.12)",
                aspectRatio: "16/10",
                position: "relative",
              }}
            >
              <img
                src="/images/home-hero/home-hero-1-graduation.jpg"
                alt="BEMI Training Institute and BMI University scholars and leaders"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: "1.25rem 1.5rem",
                  background: "linear-gradient(to top, rgba(9, 18, 35, 0.95), transparent)",
                  color: "#ffffff",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: "1rem" }}>Equipping Christian Leaders for Africa</div>
                <div style={{ fontSize: "0.8rem", color: "#e5c578" }}>Serving scholars across the African continent</div>
              </div>
            </div>

            <div
              style={{
                background: "linear-gradient(135deg, #1a0040 0%, #2d1060 100%)",
                borderRadius: "16px",
                padding: "1.75rem",
                color: "#ffffff",
                border: "1px solid rgba(197, 160, 72, 0.3)",
              }}
            >
              <h4 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.1rem", color: "#e5c578", margin: "0 0 0.5rem" }}>
                Our Pan-African Service Pledge
              </h4>
              <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.88rem", lineHeight: 1.65, margin: 0 }}>
                We believe in contextualized theological education that addresses Africa’s spiritual, social, and leadership realities. BEMI Training Institute provides accessible education without sacrificing biblical orthodoxy or academic excellence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CRITICAL FEATURE: Tuition, Fees & Payment Verification Center ── */}
      <section
        id="tuition-transparency"
        style={{
          padding: "6rem 2rem",
          background: "linear-gradient(180deg, #091223 0%, #111a2e 100%)",
          color: "#ffffff",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ maxWidth: "1280px", margin: "0 auto", position: "relative", zIndex: 2 }}>
          <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                background: "rgba(197, 160, 72, 0.15)",
                border: "1px solid rgba(197, 160, 72, 0.4)",
                padding: "0.4rem 1.1rem",
                borderRadius: "999px",
                color: "#e5c578",
                fontWeight: 800,
                fontSize: "0.78rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                marginBottom: "1rem",
              }}
            >
              <span>🛡️</span> Financial Transparency & Anti-Fraud Guarantee
            </div>
            <h2
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontWeight: 900,
                fontSize: "clamp(2rem, 3.5vw, 2.9rem)",
                color: "#ffffff",
                lineHeight: 1.15,
                marginBottom: "1rem",
              }}
            >
              Why Does My Fee Payment Show &ldquo;BEMI&rdquo;?
            </h2>
            <p style={{ color: "rgba(255, 255, 255, 0.8)", fontSize: "1.05rem", maxWidth: "780px", margin: "0 auto", lineHeight: 1.7 }}>
              When paying school fees, application fees, or graduation fees online via our licensed processing partners (<strong>IntaSend</strong> for M-Pesa / Mobile Money and <strong>Paystack</strong> for Cards & Pan-African rails), you will see our official Kenyan corporate entity: <strong>BEMI TRAINING INSTITUTE</strong>. Here is why you can pay with 100% confidence.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.1fr 0.9fr",
              gap: "3rem",
              alignItems: "center",
            }}
            className="split-section"
          >
            {/* Explanation Column */}
            <div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "16px",
                    padding: "1.75rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "0.75rem" }}>
                    <div style={{ background: "#c5a048", color: "#000", width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "0.95rem" }}>
                      1
                    </div>
                    <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.2rem", color: "#ffffff", margin: 0 }}>
                      Registered Banking Entity in Kenya
                    </h3>
                  </div>
                  <p style={{ color: "rgba(255,255,255,0.78)", fontSize: "0.92rem", lineHeight: 1.7, margin: 0 }}>
                    In compliance with the Central Bank of Kenya (CBK) and regional financial regulations, all continental banking rails, IntaSend and Paystack merchant profiles, and M-Pesa business accounts are legally registered under <strong>BEMI TRAINING INSTITUTE</strong>.
                  </p>
                </div>

                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "16px",
                    padding: "1.75rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "0.75rem" }}>
                    <div style={{ background: "#c5a048", color: "#000", width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "0.95rem" }}>
                      2
                    </div>
                    <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.2rem", color: "#ffffff", margin: 0 }}>
                      Trading As BMI University
                    </h3>
                  </div>
                  <p style={{ color: "rgba(255,255,255,0.78)", fontSize: "0.92rem", lineHeight: 1.7, margin: 0 }}>
                    The official legal harmonization descriptor is <strong>&ldquo;BEMI TRAINING INSTITUTE (trading as BMI University)&rdquo;</strong>. This guarantees that every transaction made to BEMI is legally and financially applied directly toward your BMI University tuition and academic records.
                  </p>
                </div>

                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "16px",
                    padding: "1.75rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "0.75rem" }}>
                    <div style={{ background: "#c5a048", color: "#000", width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "0.95rem" }}>
                      3
                    </div>
                    <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.2rem", color: "#ffffff", margin: 0 }}>
                      Instant Verification & Tamper-Evident Receipts
                    </h3>
                  </div>
                  <p style={{ color: "rgba(255,255,255,0.78)", fontSize: "0.92rem", lineHeight: 1.7, margin: 0 }}>
                    Once payment clears, your student portal account updates automatically. You receive an official digital receipt carrying your unique gateway reference (IntaSend or Paystack) and the BEMI institutional authorization code.
                  </p>
                </div>
              </div>
            </div>

            {/* Visual Transaction Mockup Card */}
            <div>
              <div
                style={{
                  background: "#ffffff",
                  color: "#0f172a",
                  borderRadius: "20px",
                  padding: "2rem",
                  boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
                  border: "2px solid #e5c578",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "1rem", marginBottom: "1.25rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <span style={{ fontSize: "1.4rem" }}>🔒</span>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                        Transaction Verification Preview
                      </div>
                      <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#0f172a" }}>
                        What you will see at checkout:
                      </div>
                    </div>
                  </div>
                  <span style={{ background: "#dcfce7", color: "#166534", padding: "0.25rem 0.6rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 800 }}>
                    VERIFIED
                  </span>
                </div>

                {/* Simulated Payment Row 1 */}
                <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "1rem", marginBottom: "1rem", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>
                    Authorized Gateway Merchant / Payee (IntaSend & Paystack):
                  </div>
                  <div style={{ fontSize: "1.05rem", fontWeight: 900, color: "#1e1b4b", fontFamily: "monospace" }}>
                    BEMI TRAINING INSTITUTE
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#c5a048", fontWeight: 700, marginTop: "0.25rem" }}>
                    Trading as: BMI University
                  </div>
                </div>

                {/* Simulated Payment Row 2 */}
                <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "1rem", marginBottom: "1rem", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>
                    Bank Statement / SMS Descriptor:
                  </div>
                  <div style={{ fontSize: "1rem", fontWeight: 800, color: "#0f172a", fontFamily: "monospace" }}>
                    BEMI*TRAINING &bull; NAIROBI KE
                  </div>
                </div>

                {/* Simulated Payment Row 3 */}
                <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "1rem", marginBottom: "1.5rem", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>
                    Official Receipt Footer:
                  </div>
                  <div style={{ fontSize: "0.82rem", fontStyle: "italic", color: "#475569" }}>
                    &ldquo;Payment received by BEMI TRAINING INSTITUTE (trading as BMI University).&rdquo;
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(197, 160, 72, 0.12)",
                    borderLeft: "4px solid #c5a048",
                    padding: "0.85rem 1rem",
                    borderRadius: "0 8px 8px 0",
                    fontSize: "0.82rem",
                    color: "#334155",
                    lineHeight: 1.5,
                  }}
                >
                  <strong>Tip for Students:</strong> Seeing &ldquo;BEMI&rdquo; confirms that your transaction is hitting the official, licensed BMI payment pipeline in Africa.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Academic Programs & Pathways ── */}
      <section style={{ padding: "6rem 2rem", background: "#f8fafc" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                color: "#c5a048",
                fontWeight: 800,
                fontSize: "0.82rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                marginBottom: "0.75rem",
              }}
            >
              <span>✦</span> Educational Pathways
            </div>
            <h2
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontWeight: 900,
                fontSize: "clamp(2rem, 3.2vw, 2.7rem)",
                color: "#0f172a",
                lineHeight: 1.15,
                marginBottom: "0.75rem",
              }}
            >
              Academic Offerings & Degree Articulations
            </h2>
            <p style={{ color: "#64748b", fontSize: "1.05rem", maxWidth: "680px", margin: "0 auto" }}>
              BEMI Training Institute delivers dedicated certificate curricula while providing seamless progression into BMI University’s accredited global degree programs.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "2rem" }}>
            {pathways.map((p) => (
              <div
                key={p.title}
                style={{
                  background: "#ffffff",
                  borderRadius: "18px",
                  padding: "2.25rem",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 8px 25px rgba(0,0,0,0.04)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <span
                    style={{
                      background: "rgba(197, 160, 72, 0.12)",
                      color: "#996d19",
                      padding: "0.3rem 0.75rem",
                      borderRadius: "6px",
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      display: "inline-block",
                      marginBottom: "1rem",
                    }}
                  >
                    {p.badge}
                  </span>
                  <h3
                    style={{
                      fontFamily: "'Outfit', sans-serif",
                      fontWeight: 800,
                      fontSize: "1.3rem",
                      color: "#0f172a",
                      marginBottom: "0.75rem",
                      lineHeight: 1.3,
                    }}
                  >
                    {p.title}
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      gap: "1rem",
                      fontSize: "0.82rem",
                      color: "#64748b",
                      marginBottom: "1.25rem",
                      fontWeight: 600,
                    }}
                  >
                    <span>⏱ {p.duration}</span>
                    <span>•</span>
                    <span>💻 {p.format}</span>
                  </div>
                  <p style={{ color: "#475569", fontSize: "0.92rem", lineHeight: 1.65, marginBottom: "1.5rem" }}>
                    {p.desc}
                  </p>

                  <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "1.25rem" }}>
                    <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#64748b", fontWeight: 700, marginBottom: "0.5rem" }}>
                      Key Focus Areas / Degrees:
                    </div>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      {p.outcomes.map((o) => (
                        <li key={o} style={{ fontSize: "0.85rem", color: "#334155", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ color: "#c5a048" }}>✓</span> {o}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div style={{ marginTop: "2rem" }}>
                  <Link
                    href="/apply"
                    className="btn btn-gold"
                    style={{ width: "100%", textAlign: "center", display: "block", padding: "0.75rem" }}
                  >
                    Apply for this Pathway →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Campus & African Operations ── */}
      <section style={{ padding: "6rem 2rem", background: "#ffffff", borderTop: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div
            style={{
              background: "linear-gradient(135deg, #1a0040 0%, #2d1060 100%)",
              borderRadius: "24px",
              padding: "3.5rem 3rem",
              color: "#ffffff",
              display: "grid",
              gridTemplateColumns: "1.2fr 0.8fr",
              gap: "3.5rem",
              alignItems: "center",
              boxShadow: "0 20px 50px rgba(26,0,64,0.3)",
            }}
            className="split-section"
          >
            <div>
              <div
                style={{
                  color: "#e5c578",
                  fontWeight: 800,
                  fontSize: "0.82rem",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  marginBottom: "0.75rem",
                }}
              >
                Physical Presence & Regional Administration
              </div>
              <h2
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontWeight: 900,
                  fontSize: "clamp(1.8rem, 3vw, 2.5rem)",
                  color: "#ffffff",
                  lineHeight: 1.2,
                  marginBottom: "1.25rem",
                }}
              >
                Visit Our Mukurweini Campus
              </h2>
              <p style={{ color: "rgba(255, 255, 255, 0.85)", fontSize: "0.98rem", lineHeight: 1.75, marginBottom: "1.75rem" }}>
                Our Mukurweini campus provides the regional headquarters for African student records, faculty coordination, in-person intensive residency sessions, and institutional leadership symposiums.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", fontSize: "0.92rem", color: "rgba(255,255,255,0.9)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                  <span style={{ fontSize: "1.2rem", color: "#e5c578" }}>📍</span>
                  <div>
                    <strong>Campus & Registered Office:</strong> Mukurwe-ini Plaza, Mukurweini Road, Nyeri County, Kenya
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                  <span style={{ fontSize: "1.2rem", color: "#e5c578" }}>📮</span>
                  <div>
                    <strong>Postal Correspondence:</strong> P.O. Box 79534 - 00200, City Square, Kenya
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                  <span style={{ fontSize: "1.2rem", color: "#e5c578" }}>✉️</span>
                  <div>
                    <strong>Admissions & Inquiries:</strong> admissions@bmiuniversities.org
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                  <span style={{ fontSize: "1.2rem", color: "#e5c578" }}>📞</span>
                  <div>
                    <strong>Regional Support Line:</strong> +254 721 341 793 / +254 704 500 872
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(197, 160, 72, 0.3)",
                borderRadius: "20px",
                padding: "2rem",
                backdropFilter: "blur(12px)",
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem",
              }}
            >
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.2rem", color: "#e5c578", margin: 0 }}>
                Need Regional Assistance?
              </h3>
              <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.88rem", lineHeight: 1.6, margin: 0 }}>
                Our African student support officers assist applicants with fee payments in Kenyan Shillings (KES), M-Pesa statements, admission letters, and transcript verifications.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>
                <Link
                  href="/contact"
                  className="btn btn-gold"
                  style={{ width: "100%", textAlign: "center", padding: "0.75rem" }}
                >
                  Contact Admissions Office →
                </Link>
                <a
                  href="/portal"
                  className="btn btn-outline-white"
                  style={{ width: "100%", textAlign: "center", padding: "0.75rem" }}
                >
                  Student Portal Access
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Frequently Asked Questions ── */}
      <section style={{ padding: "6rem 2rem", background: "#f8fafc" }}>
        <div style={{ maxWidth: "880px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <div
              style={{
                color: "#c5a048",
                fontWeight: 800,
                fontSize: "0.82rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                marginBottom: "0.5rem",
              }}
            >
              Transparency & Verification
            </div>
            <h2
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontWeight: 900,
                fontSize: "clamp(1.8rem, 3vw, 2.5rem)",
                color: "#0f172a",
                margin: 0,
              }}
            >
              Frequently Asked Questions
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {faqs.map((f) => (
              <div
                key={f.q}
                style={{
                  background: "#ffffff",
                  borderRadius: "14px",
                  padding: "1.75rem",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                }}
              >
                <h3
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontWeight: 800,
                    fontSize: "1.08rem",
                    color: "#0f172a",
                    marginBottom: "0.6rem",
                  }}
                >
                  {f.q}
                </h3>
                <p style={{ color: "#475569", fontSize: "0.92rem", lineHeight: 1.7, margin: 0 }}>
                  {f.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
