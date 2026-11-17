import Link from "next/link";
import PageHero from "../components/PageHero";

export const metadata = {
  title: "Institutes & Regional Campuses | BMI University",
  description:
    "Explore the institutes, campuses, and regional educational entities under Bethel Ministries International, including BEMI Training Institute serving Africa from Kenya.",
};

export default function InstitutesDirectoryPage() {
  const institutes = [
    {
      name: "BEMI Training Institute",
      region: "Africa Regional Hub • Nairobi, Kenya",
      badge: "Flagship Regional Institute",
      badgeColor: "#166534",
      badgeBg: "#dcfce7",
      flag: "🇰🇪 🌍",
      image: "/images/home-hero/home-hero-3-campus.jpg",
      href: "/institutes/bemi",
      status: "Active & Enrolling",
      role: "Official Kenyan registered educational institute representing Bethel Ministries International across Africa at large. Oversees regional admissions, executive training, and tuition settlement via IntaSend, Paystack & M-Pesa.",
      features: [
        "Pan-African student representation and regional cohorts",
        "Physical presence at Mukurweini Campus, Kenya",
        "Official IntaSend & Paystack KES corporate settlement payee",
        "Direct articulation to BMI University degrees",
      ],
      cta: "Explore BEMI Institute →",
    },
    {
      name: "BMI Global University & Theological Seminary",
      region: "Global Administration • North Carolina, USA",
      badge: "International Academic Authority",
      badgeColor: "#1e40af",
      badgeBg: "#dbeafe",
      flag: "🌐 🎓",
      image: "/images/about-hero/about-hero-4-community.jpg",
      href: "/academics",
      status: "QAHE Accredited",
      role: "The global chartered degree-granting entity offering Bachelor's, Master's, and Doctoral programs in theology, leadership, and religious education with international QAHE accreditation.",
      features: [
        "Doctoral, Master's & Bachelor's degree conferral",
        "QAHE International Accreditation",
        "Global distance learning and virtual symposiums",
        "Decades of Christ-centered academic heritage",
      ],
      cta: "View Degree Programs →",
    },
    {
      name: "BMI Center for Executive Leadership & Missions",
      region: "Global & Regional Extension",
      badge: "Professional & Ministry Development",
      badgeColor: "#854d0e",
      badgeBg: "#fef9c3",
      flag: "✝️ ⚡",
      image: "/images/about-hero/about-hero-1-team.jpg",
      href: "/academics#certificate",
      status: "Cohort Programs",
      role: "Specialized training center focusing on church planting, non-profit stewardship, and servant leadership for ministers and community leaders worldwide.",
      features: [
        "Executive leadership masterclasses",
        "Church planting and missions strategy",
        "Continuing education certificates",
        "Mentorship by international senior faculty",
      ],
      cta: "Learn More →",
    },
  ];

  return (
    <main id="main-content" style={{ background: "#ffffff", color: "#0f172a" }}>
      <PageHero
        image="/images/home-hero/home-hero-2-students.jpg"
        eyebrow="Global Institutional Network"
        title="BMI Institutes & Regional Hubs"
        subtitle="Discover our constituent institutes, regional campuses, and training centers dedicated to theological scholarship and servant leadership across the globe."
      />

      {/* Directory Grid */}
      <section style={{ padding: "5rem 2rem", background: "#f8fafc" }}>
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
              <span>✦</span> Collegiate Network
            </div>
            <h2
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontWeight: 900,
                fontSize: "clamp(2rem, 3.2vw, 2.8rem)",
                color: "#0f172a",
                lineHeight: 1.15,
                marginBottom: "0.75rem",
              }}
            >
              Constituent Institutes & Regional Representation
            </h2>
            <p style={{ color: "#64748b", fontSize: "1.05rem", maxWidth: "720px", margin: "0 auto", lineHeight: 1.7 }}>
              Bethel Ministries International operates through dedicated institutes and regional entities to deliver contextualized higher education with global standards of integrity.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "2.5rem" }}>
            {institutes.map((inst) => (
              <div
                key={inst.name}
                style={{
                  background: "#ffffff",
                  borderRadius: "20px",
                  overflow: "hidden",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "transform 0.25s ease, box-shadow 0.25s ease",
                }}
              >
                <div>
                  <div style={{ height: "200px", position: "relative", overflow: "hidden" }}>
                    <img
                      src={inst.image}
                      alt={inst.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: "1rem",
                        left: "1rem",
                        background: inst.badgeBg,
                        color: inst.badgeColor,
                        padding: "0.35rem 0.8rem",
                        borderRadius: "8px",
                        fontSize: "0.75rem",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {inst.badge}
                    </div>
                  </div>

                  <div style={{ padding: "2rem 2rem 1rem" }}>
                    <div style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 700, marginBottom: "0.4rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <span>{inst.flag}</span> {inst.region}
                    </div>
                    <h3
                      style={{
                        fontFamily: "'Outfit', sans-serif",
                        fontWeight: 800,
                        fontSize: "1.45rem",
                        color: "#0f172a",
                        marginBottom: "0.85rem",
                        lineHeight: 1.25,
                      }}
                    >
                      {inst.name}
                    </h3>
                    <p style={{ color: "#475569", fontSize: "0.93rem", lineHeight: 1.7, marginBottom: "1.5rem" }}>
                      {inst.role}
                    </p>

                    <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "1.25rem", marginBottom: "1rem" }}>
                      <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#64748b", fontWeight: 700, marginBottom: "0.6rem" }}>
                        Key Capabilities & Roles:
                      </div>
                      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {inst.features.map((f) => (
                          <li key={f} style={{ fontSize: "0.85rem", color: "#334155", display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                            <span style={{ color: "#c5a048", fontWeight: 900 }}>✓</span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div style={{ padding: "1.5rem 2rem 2rem" }}>
                  <Link
                    href={inst.href}
                    className="btn btn-gold"
                    style={{ width: "100%", textAlign: "center", display: "block", padding: "0.85rem" }}
                  >
                    {inst.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Corporate & Registration Statement */}
      <section style={{ padding: "4rem 2rem", background: "#ffffff", borderTop: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", textAlign: "center" }}>
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.25rem", color: "#0f172a", marginBottom: "0.75rem" }}>
            Institutional Governance & Legal Standing
          </h3>
          <p style={{ color: "#64748b", fontSize: "0.92rem", lineHeight: 1.75, margin: 0 }}>
            Bethel Ministries International operates in full compliance with local regulatory frameworks across all jurisdictions. In Kenya and throughout the African continent, operations, admissions liaison, and banking settlements are conducted via <strong>BEMI Training Institute</strong> (trading as BMI University). Global religious degree programs are conferred under Bethel Ministries International University.
          </p>
        </div>
      </section>
    </main>
  );
}
