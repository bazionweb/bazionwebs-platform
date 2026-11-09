"use client";

import { useEffect, useState } from "react";
import { ChurchFooter, ChurchNav, PageHero } from "@bazion/ui";
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
    fetch(`/v1/public/church/events/${encodeURIComponent(slug)}`)
      .then(async (response) => {
        if (response.status === 404) throw new Error("This event is not available.");
        if (!response.ok) throw new Error("Could not load event details.");
        return response.json() as Promise<{ event: PublicEvent }>;
      })
      .then((data) => { if (active) setEvent(data.event); })
      .catch((reason: unknown) => { if (active) setLoadError(reason instanceof Error ? reason.message : "Could not load event details."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  async function register(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!event) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/v1/public/church/events/${event.id}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  const start = event ? new Date(event.startsAt) : null;
  const registrationOpen = Boolean(event?.registrationEnabled && event.status === "upcoming" && start && start.getTime() > Date.now());
  const dateLabel = start?.toLocaleString("en-KE", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Nairobi" }) ?? "";
  const eventJsonLd = event?.status === "upcoming" && start && start.getTime() > Date.now() && event.venue && event.address ? JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description || `${event.title} hosted by ${site.ministryName}.`,
    startDate: event.startsAt,
    ...(event.endsAt ? { endDate: event.endsAt } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event.venue,
      address: { "@type": "PostalAddress", streetAddress: event.address },
    },
    organizer: { "@type": "Organization", name: site.ministryName },
    ...(event.posterUrl ? { image: [event.posterUrl] } : {}),
  }).replace(/</g, "\\u003c") : null;

  return <>
    <ChurchNav ministryName={site.ministryName} logoUrl={site.branding.logoUrl} currentPath="/events" giveHref="/give" />
    {loading ? <main id="main-content" className="ch-section ch-container"><p role="status">Loading event…</p></main>
      : loadError || !event ? <main id="main-content" className="ch-section ch-container"><h1>Event unavailable</h1><p role="alert">{loadError || "This event is not available."}</p><a className="ch-btn ch-btn-outline" href="/events">Browse events</a></main>
        : <main id="main-content">
          {eventJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: eventJsonLd }} />}
          <PageHero eyebrow="EVENT DETAILS" title={event.title} subtitle={`${dateLabel}${event.venue ? ` • ${event.venue}` : ""}${event.address ? ` • ${event.address}` : ""}`} bgImageUrl={event.posterUrl ?? site.branding.heroBgUrl} />
          <section className="ch-section"><div className="ch-container ch-grid-2" style={{ alignItems: "start" }}>
            <article>
              {event.posterUrl && <img src={event.posterUrl} alt={event.title} style={{ width: "100%", maxHeight: 460, objectFit: "cover", borderRadius: "var(--church-radius-lg)", marginBottom: 24 }} />}
              <h2>About this event</h2>
              <p style={{ lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{event.description || "More details will be shared by the ministry."}</p>
              <p><strong>Venue:</strong> {event.venue || "To be announced"}{event.address ? `, ${event.address}` : ""}</p>
              {event.registrationCapacity !== null && <p><strong>Capacity:</strong> {event.registrationCapacity}</p>}
            </article>
            <section className="ch-card"><div className="ch-card-body">
              <h2>Registration</h2>
              {reference ? <div role="status"><p>Your registration is confirmed.</p><p>Reference: <strong>{reference}</strong></p></div>
                : registrationOpen ? <form onSubmit={register} style={{ display: "grid", gap: 12 }}>
                  <p>Register to let the event team plan for your attendance.</p>
                  {error && <p role="alert">{error}</p>}
                  <label>Full name<input required maxLength={160} value={fullName} onChange={(e) => setFullName(e.target.value)} /></label>
                  <label>Email<input required type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
                  <label>Telephone<input required type="tel" maxLength={30} value={telephone} onChange={(e) => setTelephone(e.target.value)} /></label>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, lineHeight: 1.6 }}><input type="checkbox" required checked={privacyConsent} onChange={(e) => setPrivacyConsent(e.target.checked)} style={{ marginTop: 3, minWidth: 18, minHeight: 18 }} /><span>I agree that the ministry may use these details to manage this event registration. Read the <a href="/privacy">privacy notice</a>.</span></label>
                  <button className="ch-btn ch-btn-accent" type="submit" disabled={saving}>{saving ? "Submitting…" : "Confirm registration"}</button>
                </form>
                  : <p>Registration is closed for this event.</p>}
            </div></section>
          </div></section>
        </main>}
    <ChurchFooter ministryName={site.ministryName} tagline={site.tagline} phoneNumbers={site.contact.phones} email={site.contact.email} address={site.contact.address} />
  </>;
}
