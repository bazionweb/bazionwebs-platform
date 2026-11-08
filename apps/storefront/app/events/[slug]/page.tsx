import { notFound } from "next/navigation";
import {
  ChurchNav,
  ChurchFooter,
  PageHero,
} from "@bazion/ui";
import { globalMissionConfig } from "../../../../../templates/global-mission.config";
import { sampleEvents } from "../../../../../templates/church-sample-data";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = sampleEvents.find((e) => e.slug === slug);

  if (!event) {
    notFound();
  }

  return (
    <>
      <ChurchNav
        ministryName={globalMissionConfig.ministryName}
        logoUrl={globalMissionConfig.branding.logoUrl}
        currentPath="/events"
        giveHref="/give"
      />

      <main>
        <PageHero
          eyebrow="EVENT DETAILS & REGISTRATION"
          title={event.title}
          subtitle={`📅 ${event.dateStr} • ⏰ ${event.time} • 📍 ${event.venue}, ${event.location}`}
          bgImageUrl={globalMissionConfig.branding.heroBgUrl}
        />

        <article className="ch-section">
          <div className="ch-container">
            <div className="ch-grid-2" style={{ alignItems: "start" }}>
              {/* Left Column: Event Overview & Schedule */}
              <div>
                <div style={{ borderRadius: "var(--church-radius-lg)", overflow: "hidden", marginBottom: "28px" }}>
                  <img
                    src={event.posterUrl}
                    alt={event.title}
                    style={{ width: "100%", maxHeight: "450px", objectFit: "cover" }}
                  />
                </div>

                <h2 style={{ fontSize: "24px", color: "var(--church-primary)", marginBottom: "14px" }}>
                  About This Gathering
                </h2>
                <p style={{ fontSize: "16px", lineHeight: 1.8, color: "var(--church-text)", marginBottom: "24px" }}>
                  {event.description}
                </p>

                {event.speakers && (
                  <div style={{ marginBottom: "28px" }}>
                    <h3 style={{ fontSize: "18px", color: "var(--church-primary)", marginBottom: "12px" }}>
                      Featured Ministers & Guest Speakers
                    </h3>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      {event.speakers.map((spk) => (
                        <span
                          key={spk}
                          style={{
                            background: "var(--church-bg-muted)",
                            padding: "6px 14px",
                            borderRadius: "999px",
                            fontSize: "13px",
                            fontWeight: 600,
                          }}
                        >
                          🎤 {spk}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    backgroundColor: "var(--church-bg-alt)",
                    padding: "20px",
                    borderRadius: "var(--church-radius)",
                    border: "1px solid var(--church-border)",
                  }}
                >
                  <h4 style={{ margin: "0 0 8px 0", color: "var(--church-primary)" }}>
                    Venue & Location
                  </h4>
                  <p style={{ margin: 0, fontSize: "14px", color: "var(--church-text-muted)" }}>
                    📍 <strong>{event.venue}</strong> — {event.location}
                  </p>
                </div>
              </div>

              {/* Right Column: Registration Box */}
              <div
                style={{
                  backgroundColor: "#ffffff",
                  padding: "32px",
                  borderRadius: "var(--church-radius-lg)",
                  border: "1px solid var(--church-border)",
                  boxShadow: "var(--church-shadow)",
                  position: "sticky",
                  top: "100px",
                }}
              >
                <span className="ch-eyebrow">Free Online Registration</span>
                <h3 style={{ fontSize: "22px", color: "var(--church-primary)", margin: "8px 0 16px 0" }}>
                  Reserve Your Seat
                </h3>
                <p style={{ fontSize: "14px", color: "var(--church-text-muted)", marginBottom: "20px" }}>
                  Admission is completely free. Registering helps our planning and protocol team arrange
                  sufficient seating, materials, and support.
                </p>

                <form
                  action="#"
                  style={{ display: "grid", gap: "14px" }}
                >
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mary Wanjiku"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: "1px solid var(--church-border)",
                        borderRadius: "var(--church-radius)",
                        fontSize: "14px",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. mary@example.com"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: "1px solid var(--church-border)",
                        borderRadius: "var(--church-radius)",
                        fontSize: "14px",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                      Telephone / WhatsApp *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +254 721 000 000"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: "1px solid var(--church-border)",
                        borderRadius: "var(--church-radius)",
                        fontSize: "14px",
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    className="ch-btn ch-btn-accent"
                    style={{ width: "100%", marginTop: "8px" }}
                  >
                    Confirm Registration
                  </button>
                </form>

                <div style={{ marginTop: "20px", fontSize: "12px", color: "var(--church-text-muted)", textAlign: "center" }}>
                  🔒 Your information is confidential and will only be used for ministry communications.
                </div>
              </div>
            </div>
          </div>
        </article>
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
