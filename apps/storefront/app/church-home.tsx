"use client";

import { useEffect, useState } from "react";
import {
  ChurchNav,
  ChurchFooter,
  PageHero,
  ScriptureQuote,
  SermonCard,
  EventCard,
  Modal,
  StatsCounter,
} from "@bazion/ui";
import { globalMissionConfig } from "../../../templates/global-mission.config";
import { EventCalendarButton } from "./events/event-calendar-button";
import { useMinistrySite } from "../lib/use-ministry-site";

interface PublicSermon {
  id: string; slug: string; title: string; speaker: string; scriptureReference: string | null;
  category: string | null; youtubeVideoId: string | null; thumbnailUrl: string | null;
  publishedAt: string | null; createdAt: string;
}
interface PublicEvent {
  id: string; slug: string; title: string; description: string | null; posterUrl: string | null;
  venue: string | null; address: string | null; startsAt: string; endsAt: string | null; registrationEnabled: boolean;
  registrationCapacity: number | null; status: "upcoming" | "in_progress" | "completed" | "cancelled";
}

function eventCardData(event: PublicEvent) {
  const date = new Date(event.startsAt);
  return {
    dateStr: date.toLocaleDateString("en-KE", { dateStyle: "long", timeZone: "Africa/Nairobi" }),
    dayBadge: date.toLocaleDateString("en-KE", { day: "2-digit", timeZone: "Africa/Nairobi" }),
    monthBadge: date.toLocaleDateString("en-KE", { month: "short", timeZone: "Africa/Nairobi" }).toUpperCase(),
    time: date.toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Nairobi" }),
    registrationOpen: event.registrationEnabled && event.status === "upcoming" && date.getTime() > Date.now(),
  };
}

export default function ChurchHomePage() {
  const site = useMinistrySite();
  const isGlobalMissionSite = site.tenantSlug === globalMissionConfig.tenantSlug
    || site.ministryName.trim().toLowerCase() === globalMissionConfig.ministryName.toLowerCase();
  const [activeVideo, setActiveVideo] = useState<{ title: string; youtubeVideoId?: string } | null>(
    null
  );
  const [selectedEvent, setSelectedEvent] = useState<{ id: string; title: string } | null>(null);
  const [registrationPrivacyConsent, setRegistrationPrivacyConsent] = useState(false);
  const [featuredSermon, setFeaturedSermon] = useState<PublicSermon | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<PublicEvent[]>([]);
  const [contentError, setContentError] = useState("");
  const [registrationError, setRegistrationError] = useState("");
  const [registrationReference, setRegistrationReference] = useState("");
  const [registrationBusy, setRegistrationBusy] = useState(false);
  const [registrationForm, setRegistrationForm] = useState({ fullName: "", email: "", telephone: "" });
  const socialLinks = [
    ...(site.social.youtube ? [{ platform: "youtube" as const, url: site.social.youtube }] : []),
    ...(site.social.facebook ? [{ platform: "facebook" as const, url: site.social.facebook }] : []),
    ...(site.social.instagram ? [{ platform: "instagram" as const, url: site.social.instagram }] : []),
    ...(site.social.whatsapp ? [{ platform: "whatsapp" as const, url: site.social.whatsapp }] : []),
  ];

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/v1/public/church/sermons?limit=1").then(async (response) => {
        if (!response.ok) throw new Error("Sermons could not be loaded.");
        return response.json() as Promise<{ items: PublicSermon[] }>;
      }),
      fetch("/v1/public/church/events?filter=upcoming&limit=3").then(async (response) => {
        if (!response.ok) throw new Error("Events could not be loaded.");
        return response.json() as Promise<{ events: PublicEvent[] }>;
      }),
    ]).then(([sermonData, eventData]) => {
      if (!active) return;
      setFeaturedSermon(sermonData.items[0] ?? null);
      setUpcomingEvents(eventData.events);
    }).catch((reason: unknown) => {
      if (active) setContentError(reason instanceof Error ? reason.message : "Ministry content is temporarily unavailable.");
    });
    return () => { active = false; };
  }, []);

  async function registerForEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedEvent) return;
    setRegistrationBusy(true); setRegistrationError(""); setRegistrationReference("");
    try {
      const response = await fetch(`/v1/public/church/events/${selectedEvent.id}/register`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...registrationForm, privacyConsent: true }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success !== true || typeof data.registrationReference !== "string") {
        throw new Error(typeof data?.message === "string" ? data.message : "Registration could not be confirmed.");
      }
      setRegistrationReference(data.registrationReference);
    } catch (reason) {
      setRegistrationError(reason instanceof Error ? reason.message : "Registration could not be confirmed.");
    } finally { setRegistrationBusy(false); }
  }

  return (
    <>
      {/* 1. Header Navigation */}
      <ChurchNav
        ministryName={site.ministryName}
        logoUrl={site.branding.logoUrl}
        currentPath="/"
        giveHref="/give"
        giveLabel="Give to the Mission"
      />

      <main id="main-content">
        {/* 2. Hero Section */}
        <PageHero
          eyebrow={site.hero.eyebrow || site.ministryName}
          title={site.hero.title}
          highlightedTitle={site.hero.highlightedTitle}
          subtitle={site.hero.subtitle || site.tagline}
          primaryCtaText={isGlobalMissionSite ? "Watch the latest sermon" : "Plan your visit"}
          primaryCtaHref={isGlobalMissionSite ? "/sermons" : "/visit"}
          secondaryCtaText={isGlobalMissionSite ? "Give to the mission" : "Explore messages"}
          secondaryCtaHref={isGlobalMissionSite ? "/give" : "/sermons"}
          bgImageUrl={site.branding.heroBgUrl}
        />

        {site.statistics.length > 0 && <StatsCounter
          stats={site.statistics}
          title="Our mission in action"
          subtitle="Serving communities and carrying the Gospel from Kenya to the nations."
        />}

        {/* 3. Ministry Introduction */}
        <section className="ch-section">
          <div className="ch-container">
            <div className="ch-heading-wrap">
              <span className="ch-eyebrow">Who We Are</span>
              <h2 className="ch-title">Our Ministry</h2>
              <p className="ch-subtitle">
                {site.mission.statement || site.tagline}
              </p>
            </div>

            <div className="ch-grid-3">
              {[
                { ...site.vision, icon: "🌍" },
                { ...site.mission, icon: "⛪" },
                { ...site.outreach, icon: "🌱" },
              ].filter((item) => item.statement.trim()).map((item) => (
                <div className="ch-card" key={item.title}>
                  <div className="ch-card-body">
                    <div style={{ fontSize: "36px", marginBottom: "12px" }}>{item.icon}</div>
                    <h3 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 10px 0", color: "var(--church-primary)" }}>{item.title}</h3>
                    <p style={{ fontSize: "15px", lineHeight: 1.6, color: "var(--church-text-muted)", margin: 0 }}>{item.statement}</p>
                  </div>
                </div>
              ))}
              {!site.vision.statement && !site.mission.statement && !site.outreach.statement && <p>Ministry profile information will appear here when published.</p>}
            </div>

            <div style={{ textAlign: "center", marginTop: "36px" }}>
              <a href="/about" className="ch-btn ch-btn-primary">
                Read More About Our Ministry →
              </a>
            </div>
          </div>
        </section>

        {site.scripture.verse && <div className="ch-container">
          <ScriptureQuote
            verse={site.scripture.verse}
            reference={site.scripture.reference}
            version={site.scripture.version || undefined}
          />
        </div>}

        <section className="ch-section ch-section-alt">
          <div className="ch-container">
            <div className="ch-heading-wrap">
              <span className="ch-eyebrow">Come as you are</span>
              <h2 className="ch-title">Plan a visit</h2>
              <p className="ch-subtitle">Find service times, directions, and helpful details before joining us.</p>
            </div>
            <div className="ch-grid-3">
              {site.serviceTimes.slice(0, 3).map((service, index) => <article className="ch-info-card" key={`${service.label}-${index}`}>
                <span className="ch-eyebrow">{service.day}</span><h3>{service.label}</h3><p><strong>{service.time}</strong></p>
                {service.note && <p style={{ marginTop: 8 }}>{service.note}</p>}
              </article>)}
              {!site.serviceTimes.length && <article className="ch-info-card"><h3>Service details</h3><p>Contact us for the latest gathering time and location.</p></article>}
              {site.locations.slice(0, Math.max(0, 2 - site.serviceTimes.length)).map((location, index) => <article className="ch-info-card" key={`${location.name}-${index}`}>
                <span className="ch-eyebrow">Visit us</span><h3>{location.name}</h3><p>{location.address}</p>
              </article>)}
            </div>
            <div style={{ textAlign: "center", marginTop: 28 }}><a href="/visit" className="ch-btn ch-btn-primary">Plan your visit</a></div>
          </div>
        </section>

        {site.online.liveStreamUrl && <section className="ch-section ch-section-dark">
          <div className="ch-container" style={{ textAlign: "center", maxWidth: 760 }}>
            <span className="ch-eyebrow">Worship online</span>
            <h2 className="ch-title">Join us from wherever you are.</h2>
            <p className="ch-subtitle">{site.online.description || "Use the ministry's live stream link to join an online gathering."}</p>
            <a href={site.online.liveStreamUrl} target="_blank" rel="noopener noreferrer" className="ch-btn ch-btn-accent" style={{ marginTop: 24 }}>Open live stream</a>
          </div>
        </section>}

        {site.ministries.length > 0 && <section className="ch-section">
          <div className="ch-container">
            <div className="ch-heading-wrap"><span className="ch-eyebrow">Find your community</span><h2 className="ch-title">Connect through ministry</h2></div>
            <div className="ch-grid-3">{site.ministries.slice(0, 3).map((ministry) => <article className="ch-info-card" key={ministry.title}><h3>{ministry.title}</h3><p>{ministry.description}</p></article>)}</div>
            <div style={{ textAlign: "center", marginTop: 28 }}><a href="/ministries" className="ch-btn ch-btn-outline">Explore ministries</a></div>
          </div>
        </section>}

        {/* 6. Featured Sermon */}
        <section id="featured-sermon" className="ch-section ch-section-alt">
          <div className="ch-container">
            <div className="ch-heading-wrap">
              <span className="ch-eyebrow">Online Ministry</span>
              <h2 className="ch-title">Latest Message & Teaching</h2>
              <p className="ch-subtitle">
                Be spiritually fed, encouraged, and renewed by the anointed preaching of God&apos;s
                Word.
              </p>
            </div>

            <div style={{ maxWidth: "800px", margin: "0 auto" }}>
              {featuredSermon ? <SermonCard
                id={featuredSermon.id}
                title={featuredSermon.title}
                speaker={featuredSermon.speaker}
                date={new Date(featuredSermon.publishedAt ?? featuredSermon.createdAt).toLocaleDateString("en-KE", { dateStyle: "long", timeZone: "Africa/Nairobi" })}
                scriptureReference={featuredSermon.scriptureReference ?? undefined}
                category={featuredSermon.category ?? undefined}
                thumbnailUrl={featuredSermon.thumbnailUrl ?? undefined}
                youtubeVideoId={featuredSermon.youtubeVideoId ?? undefined}
                slug={featuredSermon.slug}
                onWatch={(sermon: { id: string; title: string; youtubeVideoId?: string }) => setActiveVideo(sermon)}
              /> : <p>{contentError || "No sermons have been published yet."}</p>}
              <div style={{ textAlign: "center", marginTop: "24px" }}>
                <a href="/sermons" className="ch-btn ch-btn-outline">
                  Browse Full Sermon Library →
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Upcoming Events */}
        <section className="ch-section">
          <div className="ch-container">
            <div className="ch-heading-wrap">
              <span className="ch-eyebrow">Calendar</span>
              <h2 className="ch-title">Upcoming events</h2>
              <p className="ch-subtitle">
              Join us in person or online for scheduled ministry gatherings.
              </p>
            </div>

            <div className="ch-grid-3">
              {upcomingEvents.map((evt) => {
                const display = eventCardData(evt);
                return (
                <EventCard
                  key={evt.id}
                  id={evt.id}
                  title={evt.title}
                  dateStr={display.dateStr}
                  dayBadge={display.dayBadge}
                  monthBadge={display.monthBadge}
                  time={display.time}
                  venue={evt.venue ?? undefined}
                  location={evt.address ?? undefined}
                  slug={evt.slug}
                  posterUrl={evt.posterUrl ?? undefined}
                  registrationOpen={display.registrationOpen}
                  calendarAction={<EventCalendarButton event={{
                    id: evt.id,
                    title: evt.title,
                    startsAt: evt.startsAt,
                    endsAt: evt.endsAt,
                    description: evt.description,
                    location: [evt.venue, evt.address].filter(Boolean).join(", "),
                  }} />}
                  onRegister={(e: { id: string; title: string }) => { setRegistrationPrivacyConsent(false); setSelectedEvent(e); }}
                />
              );})}
              {!upcomingEvents.length && <p>{contentError || "There are no upcoming events to show."}</p>}
            </div>

            <div style={{ textAlign: "center", marginTop: "36px" }}>
              <a href="/events" className="ch-btn ch-btn-primary">
                View All Events & Programmes →
              </a>
            </div>
          </div>
        </section>

        {/* 10. Giving Call to Action */}
        <section className="ch-section ch-section-dark">
          <div className="ch-container" style={{ textAlign: "center", maxWidth: "760px" }}>
            <span className="ch-eyebrow">Partner With Us</span>
            <h2 className="ch-title" style={{ color: "#ffffff" }}>
              Partner With Us in the Work of God
            </h2>
            <p className="ch-subtitle" style={{ color: "#cbd5e1", marginBottom: "32px" }}>
              Your gift can support the programs and priorities of {site.ministryName}.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "16px", flexWrap: "wrap" }}>
              <a href="/give" className="ch-btn ch-btn-accent" style={{ padding: "16px 32px", fontSize: "16px" }}>
                Give to the Mission Now
              </a>
              <a href="/contact" className="ch-btn ch-btn-outline-white" style={{ padding: "16px 28px" }}>
                Contact for Partnership
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* 12. Footer */}
      <ChurchFooter
        ministryName={site.ministryName}
        tagline={site.tagline}
        phoneNumbers={site.contact.phones}
        email={site.contact.email}
        address={site.contact.address}
        socialLinks={socialLinks}
      />

      {/* Video Modal Player */}
      <Modal
        isOpen={Boolean(activeVideo)}
        onClose={() => setActiveVideo(null)}
        title={activeVideo?.title}
      >
        {activeVideo?.youtubeVideoId && (
          <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
            <iframe
              src={`https://www.youtube.com/embed/${activeVideo.youtubeVideoId}?autoplay=1`}
              title={activeVideo.title}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                border: 0,
                borderRadius: "var(--church-radius)",
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
      </Modal>

      {/* Quick Event Registration Modal */}
      <Modal
        isOpen={Boolean(selectedEvent)}
        onClose={() => { setSelectedEvent(null); setRegistrationReference(""); setRegistrationError(""); setRegistrationPrivacyConsent(false); }}
        title={`Register for ${selectedEvent?.title}`}
      >
        {registrationReference ? <div role="status"><h3>Registration confirmed</h3><p>Your reference: <strong>{registrationReference}</strong></p></div> : <form onSubmit={registerForEvent} style={{ display: "grid", gap: "16px" }}>
          {registrationError && <p role="alert">{registrationError}</p>}
          <div>
            <label htmlFor="home-event-name" style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
              Full Name *
            </label>
            <input
              id="home-event-name"
              type="text"
              required
              value={registrationForm.fullName}
              onChange={(e) => setRegistrationForm({ ...registrationForm, fullName: e.target.value })}
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
            <label htmlFor="home-event-email" style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
              Email Address *
            </label>
            <input
              id="home-event-email"
              type="email"
              required
              value={registrationForm.email}
              onChange={(e) => setRegistrationForm({ ...registrationForm, email: e.target.value })}
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
            <label htmlFor="home-event-phone" style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
              Telephone / WhatsApp *
            </label>
            <input
              id="home-event-phone"
              type="tel"
              required
              value={registrationForm.telephone}
              onChange={(e) => setRegistrationForm({ ...registrationForm, telephone: e.target.value })}
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
            <input type="checkbox" required checked={registrationPrivacyConsent} onChange={(event) => setRegistrationPrivacyConsent(event.target.checked)} style={{ marginTop: 3, minWidth: 18, minHeight: 18 }} />
            <span>I agree that the ministry may use these details to manage this event registration. Read the <a href="/privacy">privacy notice</a>.</span>
          </label>
          <button type="submit" disabled={registrationBusy} className="ch-btn ch-btn-accent" style={{ marginTop: "8px" }}>
            {registrationBusy ? "Submitting…" : "Complete Free Registration"}
          </button>
        </form>}
      </Modal>
    </>
  );
}
