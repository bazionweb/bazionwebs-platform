"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteChrome } from "../../../components/gmfc/SiteChrome";
import { PageHero } from "../../../components/gmfc/PageHero";
import { EventCalendarButton } from "../event-calendar-button";
import { getClientTenantHeaders } from "../../../lib/client-tenant";
import { sanitizeRichEventHtml, stripHtmlToExcerpt } from "../../../lib/gmfc-events";
import { useMinistrySite } from "../../../lib/use-ministry-site";

interface PublicEvent {
  id: string;
  title: string;
  description: string | null;
  posterUrl: string | null;
  venue: string | null;
  address: string | null;
  startsAt: string;
  endsAt: string | null;
  registrationEnabled: boolean;
  registrationCapacity: number | null;
  status: "upcoming" | "in_progress" | "completed" | "cancelled";
}

export function EventDetail({ slug }: { slug: string }) {
  const site = useMinistrySite();
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (event) document.title = `${event.title} | ${site.ministryName}`;
  }, [event, site.ministryName]);

  useEffect(() => {
    let active = true;
    fetch(`/v1/public/church/events/${encodeURIComponent(slug)}`, {
      cache: "no-store",
      headers: getClientTenantHeaders(),
    })
      .then(async (response) => {
        if (response.status === 404) throw new Error("This event is not available.");
        if (!response.ok) throw new Error("Could not load event details.");
        return response.json() as Promise<{ event: PublicEvent }>;
      })
      .then((data) => {
        if (active) setEvent(data.event);
      })
      .catch((reason: unknown) => {
        if (active) setLoadError(reason instanceof Error ? reason.message : "Could not load event details.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  async function register(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!event) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/v1/public/church/events/${event.id}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getClientTenantHeaders(),
        },
        body: JSON.stringify({ fullName, email, telephone, privacyConsent: true }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success !== true || typeof data.registrationReference !== "string") {
        throw new Error(typeof data?.message === "string" ? data.message : "Registration could not be confirmed.");
      }
      setReference(data.registrationReference);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Registration could not be confirmed.");
    } finally {
      setSaving(false);
    }
  }

  const startDate = event ? new Date(event.startsAt) : null;
  const endDate = event?.endsAt ? new Date(event.endsAt) : null;
  const isPast = event
    ? event.status === "completed" || (startDate ? Date.now() > startDate.getTime() : false)
    : false;
  const registrationOpen = Boolean(
    event?.registrationEnabled && event.status === "upcoming" && startDate && startDate.getTime() > Date.now(),
  );

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Africa/Nairobi",
    });

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" });

  const excerpt = stripHtmlToExcerpt(event?.description, 175);
  const locationDisplay = [event?.venue, event?.address].filter(Boolean).join(", ");
  const hasHtml = Boolean(event?.description && /<[a-z][\s\S]*>/i.test(event.description));

  const eventJsonLd =
    event?.status === "upcoming" && startDate && startDate.getTime() > Date.now() && event.venue
      ? JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Event",
          name: event.title,
          description: excerpt || `${event.title} hosted by ${site.ministryName}.`,
          startDate: event.startsAt,
          ...(event.endsAt ? { endDate: event.endsAt } : {}),
          eventStatus: "https://schema.org/EventScheduled",
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          location: {
            "@type": "Place",
            name: event.venue,
            address: { "@type": "PostalAddress", streetAddress: event.address || event.venue },
          },
          organizer: { "@type": "Organization", name: site.ministryName },
          ...(event.posterUrl ? { image: [event.posterUrl] } : {}),
        }).replace(/</g, "\\u003c")
      : null;

  return (
    <SiteChrome currentPath="/events">
      {loading ? (
        <main id="main-content" className="gmfci-evd-main">
          <div className="gmfci-evd-container">
            <p role="status">Loading event…</p>
          </div>
        </main>
      ) : loadError || !event ? (
        <main id="main-content" className="gmfci-evd-main">
          <div className="gmfci-evd-container">
            <h1 className="gmfci-evd-title">Event unavailable</h1>
            <p role="alert" style={{ marginTop: 12, color: "#4b5563" }}>
              {loadError || "This event is not available."}
            </p>
            <Link href="/events" className="gmfci-evd-back-link">
              Back to All Events
            </Link>
          </div>
        </main>
      ) : (
        <main id="main-content" className="gmfci-evd-main">
          {eventJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: eventJsonLd }} />}

          <PageHero
            eyebrow={isPast ? "Past Event" : "Upcoming Event"}
            title={event.title}
            subtitle={excerpt || undefined}
          />

          <div className="gmfci-evd-container">
            <div className="gmfci-evd-layout">
              {event.posterUrl && (
                <div className="gmfci-evd-image-col">
                  <div className="gmfci-evd-image-wrap">
                    <img
                      src={event.posterUrl}
                      alt={event.title}
                      className="gmfci-evd-image"
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                    />
                  </div>
                </div>
              )}

              <div className={`gmfci-evd-content-col${!event.posterUrl ? " gmfci-evd-content-col--full" : ""}`}>
                <div className="gmfci-evd-meta-row">
                  <span className={`gmfci-evd-status-pill${isPast ? " past" : " upcoming"}`}>
                    {isPast ? "Past Event" : "Upcoming"}
                  </span>
                </div>

                <h1 className="gmfci-evd-title">{event.title}</h1>

                <div className="gmfci-evd-info-cards">
                  {startDate && (
                    <div className="gmfci-evd-info-card">
                      <div className="gmfci-evd-info-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                      </div>
                      <div>
                        <span className="gmfci-evd-info-label">Date</span>
                        <span className="gmfci-evd-info-value">{formatDate(startDate)}</span>
                        {endDate && endDate.toDateString() !== startDate.toDateString() && (
                          <span className="gmfci-evd-info-value">to {formatDate(endDate)}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {startDate && (
                    <div className="gmfci-evd-info-card">
                      <div className="gmfci-evd-info-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      </div>
                      <div>
                        <span className="gmfci-evd-info-label">Time</span>
                        <span className="gmfci-evd-info-value">{formatTime(startDate)}</span>
                      </div>
                    </div>
                  )}

                  {locationDisplay && (
                    <div className="gmfci-evd-info-card">
                      <div className="gmfci-evd-info-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                      </div>
                      <div>
                        <span className="gmfci-evd-info-label">Location</span>
                        <span className="gmfci-evd-info-value">{locationDisplay}</span>
                      </div>
                    </div>
                  )}
                </div>

                {event.description &&
                  (hasHtml ? (
                    <div
                      className="gmfci-evd-description"
                      dangerouslySetInnerHTML={{ __html: sanitizeRichEventHtml(event.description) }}
                    />
                  ) : (
                    <div className="gmfci-evd-description">
                      <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{event.description}</p>
                    </div>
                  ))}

                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                  <EventCalendarButton
                    event={{
                      id: event.id,
                      title: event.title,
                      startsAt: event.startsAt,
                      endsAt: event.endsAt,
                      description: excerpt || event.description,
                      location: locationDisplay,
                    }}
                  />
                  {event.registrationCapacity !== null && (
                    <span style={{ fontSize: 13, color: "#4b5563" }}>
                      Capacity: <strong>{event.registrationCapacity}</strong>
                    </span>
                  )}
                </div>

                {/* Platform Event Registration layered cleanly when enabled */}
                {registrationOpen && (
                  <section
                    style={{
                      background: "white",
                      borderRadius: 16,
                      padding: "24px 28px",
                      boxShadow: "0 1px 4px rgba(0, 0, 0, 0.06)",
                      border: "1px solid #f3f4f6",
                    }}
                  >
                    <h2 style={{ margin: "0 0 12px", fontSize: 20, fontFamily: "var(--font-outfit)" }}>
                      Event Registration
                    </h2>
                    {reference ? (
                      <div role="status" className="gmfci-form-message success">
                        Your registration is confirmed. Reference: <strong>{reference}</strong>
                      </div>
                    ) : (
                      <form onSubmit={register} style={{ display: "grid", gap: 12 }}>
                        {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
                        <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 600 }}>
                          Full name
                          <input
                            required
                            maxLength={160}
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db" }}
                          />
                        </label>
                        <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 600 }}>
                          Email
                          <input
                            required
                            type="email"
                            maxLength={254}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db" }}
                          />
                        </label>
                        <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 600 }}>
                          Telephone
                          <input
                            required
                            type="tel"
                            maxLength={30}
                            value={telephone}
                            onChange={(e) => setTelephone(e.target.value)}
                            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db" }}
                          />
                        </label>
                        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, lineHeight: 1.5 }}>
                          <input
                            type="checkbox"
                            required
                            checked={privacyConsent}
                            onChange={(e) => setPrivacyConsent(e.target.checked)}
                            style={{ marginTop: 3, minWidth: 16, minHeight: 16 }}
                          />
                          <span>
                            I agree that the ministry may use these details to manage this event registration. Read the{" "}
                            <Link href="/privacy" style={{ textDecoration: "underline" }}>
                              privacy notice
                            </Link>
                            .
                          </span>
                        </label>
                        <button type="submit" className="gmfci-form-submit" disabled={saving}>
                          {saving ? "Submitting…" : "Confirm registration"}
                        </button>
                      </form>
                    )}
                  </section>
                )}

                <Link href="/events" className="gmfci-evd-back-link">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 5l-7 7 7 7" />
                  </svg>
                  Back to All Events
                </Link>
              </div>
            </div>
          </div>
        </main>
      )}
    </SiteChrome>
  );
}

export default EventDetail;
