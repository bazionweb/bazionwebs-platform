"use client";

import { useEffect, useState } from "react";
import {
  ChurchNav,
  ChurchFooter,
  PageHero,
  EventCard,
  CategoryFilter,
  Modal,
} from "@bazion/ui";
import { useMinistrySite } from "../../lib/use-ministry-site";

interface PublicEvent {
  id: string;
  slug: string;
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

function eventDisplay(event: PublicEvent) {
  const date = new Date(event.startsAt);
  return {
    dateStr: date.toLocaleDateString("en-KE", { dateStyle: "long", timeZone: "Africa/Nairobi" }),
    dayBadge: date.toLocaleDateString("en-KE", { day: "2-digit", timeZone: "Africa/Nairobi" }),
    monthBadge: date.toLocaleDateString("en-KE", { month: "short", timeZone: "Africa/Nairobi" }).toUpperCase(),
    time: date.toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Nairobi" }),
    location: event.address ?? "",
    upcoming: event.status === "upcoming" && date.getTime() > Date.now(),
    registrationOpen: event.registrationEnabled && event.status === "upcoming" && date.getTime() > Date.now(),
  };
}

const CATEGORIES = ["All", "Upcoming", "Past Events"];

export default function EventsPage() {
  const site = useMinistrySite();
  const [filter, setFilter] = useState("All");
  const [registeringEvent, setRegisteringEvent] = useState<PublicEvent | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/v1/public/church/events?filter=all")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load this ministry's events.");
        return response.json() as Promise<{ events: PublicEvent[] }>;
      })
      .then((data) => { if (active) setEvents(data.events); })
      .catch((error: unknown) => { if (active) setEventsError(error instanceof Error ? error.message : "Could not load events."); })
      .finally(() => { if (active) setEventsLoading(false); });
    return () => { active = false; };
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registeringEvent) return;
    setIsSubmitting(true);
    setRegistrationError(null);
    try {
      const res = await fetch(`/v1/public/church/events/${registeringEvent.id}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: regName,
          email: regEmail,
          telephone: regPhone,
          privacyConsent: true,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success === true && typeof data.registrationReference === "string") {
        setRegSuccess(data.registrationReference);
      } else {
        setRegistrationError(typeof data?.message === "string" ? data.message : "Registration could not be confirmed. Please try again.");
      }
    } catch (error) {
      setRegistrationError(error instanceof Error ? error.message : "Registration could not be confirmed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredEvents = events.filter((event) => {
    const display = eventDisplay(event);
    if (filter === "Upcoming") return display.upcoming;
    if (filter === "Past Events") return event.status === "completed" || new Date(event.startsAt).getTime() < Date.now();
    return event.status !== "cancelled";
  });

  const featuredEvent = events.find((event) => eventDisplay(event).upcoming);
  const featuredDisplay = featuredEvent ? eventDisplay(featuredEvent) : null;

  return (
    <>
      <ChurchNav
        ministryName={site.ministryName}
        logoUrl={site.branding.logoUrl}
        currentPath="/events"
        giveHref="/give"
      />

      <main id="main-content">
        {/* 1. Page Hero */}
        <PageHero
          eyebrow="MINISTRY CALENDAR & PROGRAMMES"
          title="Events &"
          highlightedTitle="Programmes"
          subtitle="Browse events published by this ministry and register when registration is open."
          bgImageUrl={site.branding.heroBgUrl}
        />

        {/* 2. Featured Event Spotlight */}
        {featuredEvent && (
          <section className="ch-section ch-section-alt">
            <div className="ch-container">
              <div className="ch-heading-wrap">
                <span className="ch-eyebrow">Major Upcoming Event</span>
                <h2 className="ch-title">{featuredEvent.title}</h2>
                <p className="ch-subtitle">
                  📅 {featuredDisplay?.dateStr} • ⏰ {featuredDisplay?.time} • 📍 {featuredEvent.venue ?? "Venue to be announced"}{featuredDisplay?.location ? `, ${featuredDisplay.location}` : ""}
                </p>
              </div>

              <div
                style={{
                  maxWidth: "900px",
                  margin: "0 auto",
                  backgroundColor: "#ffffff",
                  borderRadius: "var(--church-radius-lg)",
                  border: "1px solid var(--church-border)",
                  overflow: "hidden",
                  boxShadow: "var(--church-shadow)",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                }}
              >
                <div style={{ height: "340px", backgroundColor: "var(--church-primary)" }}>
                  {featuredEvent.posterUrl ? <img
                      src={featuredEvent.posterUrl}
                      alt={featuredEvent.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    /> : <div className="ch-event-placeholder" aria-hidden="true"><span>Event details</span></div>}
                </div>
                <div style={{ padding: "32px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <span className="ch-eyebrow">Featured Gathering</span>
                  <h3 style={{ fontSize: "22px", fontWeight: 700, margin: "6px 0 12px 0", color: "var(--church-primary)" }}>
                    {featuredEvent.title}
                  </h3>
                  <p style={{ fontSize: "14px", lineHeight: 1.7, color: "var(--church-text)", marginBottom: "20px" }}>
                    {featuredEvent.description}
                  </p>
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                    {featuredDisplay?.registrationOpen && <button
                      type="button"
                      className="ch-btn ch-btn-accent"
                      onClick={() => { setRegistrationError(null); setPrivacyConsent(false); setRegisteringEvent(featuredEvent); }}
                    >Register Online (Free)</button>}
                    <a href={`/events/${featuredEvent.slug}`} className="ch-btn ch-btn-outline">
                      Full Programme Details →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 3. Filter Bar & Event Grid */}
        <section className="ch-section">
          <div className="ch-container">
            {eventsLoading && <p role="status">Loading events…</p>}
            {eventsError && <p role="alert">{eventsError}</p>}
            <CategoryFilter
              categories={CATEGORIES}
              activeCategory={filter}
              onSelectCategory={(cat: string) => setFilter(cat)}
            />

            <div className="ch-grid-3">
              {filteredEvents.map((evt) => {
                const display = eventDisplay(evt);
                return <EventCard
                  key={evt.id}
                  id={evt.id}
                  title={evt.title}
                  dateStr={display.dateStr}
                  dayBadge={display.dayBadge}
                  monthBadge={display.monthBadge}
                  time={display.time}
                  venue={evt.venue ?? "Venue to be announced"}
                  location={display.location}
                  slug={evt.slug}
                  posterUrl={evt.posterUrl ?? undefined}
                  registrationOpen={display.registrationOpen}
                  onRegister={() => { setRegistrationError(null); setPrivacyConsent(false); setRegisteringEvent(evt); }}
                />;
              })}
              {!eventsLoading && !eventsError && filteredEvents.length === 0 && <p>No events are available for this filter.</p>}
            </div>
          </div>
        </section>
      </main>

      <ChurchFooter
        ministryName={site.ministryName}
        tagline={site.tagline}
        phoneNumbers={site.contact.phones}
        email={site.contact.email}
        address={site.contact.address}
      />

      {/* Registration Modal */}
      <Modal
        isOpen={Boolean(registeringEvent)}
        onClose={() => {
          setRegisteringEvent(null);
          setRegSuccess(null);
          setRegistrationError(null);
          setPrivacyConsent(false);
        }}
        title={registeringEvent ? `Register for ${registeringEvent.title}` : undefined}
      >
        {regSuccess ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>✅</div>
            <h3 style={{ fontSize: "20px", fontWeight: 700, color: "var(--church-success)" }}>
              Registration Confirmed!
            </h3>
            <p style={{ fontSize: "14px", color: "var(--church-text)", margin: "10px 0 20px 0" }}>
              Your unique registration reference is:
            </p>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: "18px",
                fontWeight: 700,
                padding: "10px 18px",
                background: "var(--church-bg-muted)",
                display: "inline-block",
                borderRadius: "var(--church-radius)",
                marginBottom: "20px",
              }}
            >
              {regSuccess}
            </div>
            <p style={{ fontSize: "13px", color: "var(--church-text-muted)" }}>
              Please show this code or message at the entrance. We look forward to fellowshiping with you!
            </p>
            <button
              type="button"
              className="ch-btn ch-btn-primary"
              style={{ marginTop: "16px" }}
              onClick={() => {
                setRegisteringEvent(null);
                setRegSuccess(null);
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleRegister}
            style={{ display: "grid", gap: "16px" }}
          >
            {registrationError && <p role="alert" style={{ color: "#b91c1c" }}>{registrationError}</p>}
            <div>
              <label htmlFor="event-reg-name" style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                Full Name *
              </label>
              <input
                id="event-reg-name"
                type="text"
                required
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="e.g. John Doe"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid var(--church-border)",
                  borderRadius: "var(--church-radius)",
                }}
              />
            </div>
            <div>
              <label htmlFor="event-reg-email" style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                Email Address *
              </label>
              <input
                id="event-reg-email"
                type="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="e.g. john@example.com"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid var(--church-border)",
                  borderRadius: "var(--church-radius)",
                }}
              />
            </div>
            <div>
              <label htmlFor="event-reg-phone" style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                Telephone / WhatsApp Number *
              </label>
              <input
                id="event-reg-phone"
                type="tel"
                required
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                placeholder="e.g. +254 712 345 678"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid var(--church-border)",
                  borderRadius: "var(--church-radius)",
                }}
              />
            </div>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, lineHeight: 1.6 }}>
              <input type="checkbox" required checked={privacyConsent} onChange={(event) => setPrivacyConsent(event.target.checked)} style={{ marginTop: 3, minWidth: 18, minHeight: 18 }} />
              <span>I agree that the ministry may use these details to manage this event registration. Read the <a href="/privacy">privacy notice</a>.</span>
            </label>
            <button
              type="submit"
              disabled={isSubmitting}
              className="ch-btn ch-btn-accent"
              style={{ marginTop: "8px" }}
            >
              {isSubmitting ? "Generating Registration..." : "Submit Registration & Generate Reference"}
            </button>
          </form>
        )}
      </Modal>
    </>
  );
}
