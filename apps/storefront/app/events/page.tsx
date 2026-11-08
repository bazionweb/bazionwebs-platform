"use client";

import { useState } from "react";
import {
  ChurchNav,
  ChurchFooter,
  PageHero,
  EventCard,
  CategoryFilter,
  Modal,
} from "@bazion/ui";
import { globalMissionConfig } from "../../../../templates/global-mission.config";
import { sampleEvents, type EventItem } from "../../../../templates/church-sample-data";

const CATEGORIES = ["All", "Upcoming", "Past Events"];

export default function EventsPage() {
  const [filter, setFilter] = useState("All");
  const [registeringEvent, setRegisteringEvent] = useState<EventItem | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

  const filteredEvents = sampleEvents.filter((evt) => {
    if (filter === "Upcoming") return evt.registrationOpen;
    if (filter === "Past Events") return !evt.registrationOpen;
    return true;
  });

  const featuredEvent = sampleEvents[0];

  return (
    <>
      <ChurchNav
        ministryName={globalMissionConfig.ministryName}
        logoUrl={globalMissionConfig.branding.logoUrl}
        currentPath="/events"
        giveHref="/give"
      />

      <main>
        {/* 1. Page Hero */}
        <PageHero
          eyebrow="MINISTRY CALENDAR & PROGRAMMES"
          title="Events, Crusades &"
          highlightedTitle="Conferences"
          subtitle="Be part of life-changing encounters. Register for upcoming revivals, leadership summits, and free community medical outreaches."
          bgImageUrl={globalMissionConfig.branding.heroBgUrl}
        />

        {/* 2. Featured Event Spotlight */}
        {featuredEvent && (
          <section className="ch-section ch-section-alt">
            <div className="ch-container">
              <div className="ch-heading-wrap">
                <span className="ch-eyebrow">Major Upcoming Event</span>
                <h2 className="ch-title">{featuredEvent.title}</h2>
                <p className="ch-subtitle">
                  📅 {featuredEvent.dateStr} • ⏰ {featuredEvent.time} • 📍 {featuredEvent.venue},{" "}
                  {featuredEvent.location}
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
                  <img
                    src={featuredEvent.posterUrl}
                    alt={featuredEvent.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
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
                    <button
                      type="button"
                      className="ch-btn ch-btn-accent"
                      onClick={() => setRegisteringEvent(featuredEvent)}
                    >
                      Register Online (Free)
                    </button>
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
            <CategoryFilter
              categories={CATEGORIES}
              activeCategory={filter}
              onSelectCategory={(cat: string) => setFilter(cat)}
            />

            <div className="ch-grid-3">
              {filteredEvents.map((evt) => (
                <EventCard
                  key={evt.id}
                  id={evt.id}
                  title={evt.title}
                  dateStr={evt.dateStr}
                  dayBadge={evt.dayBadge}
                  monthBadge={evt.monthBadge}
                  time={evt.time}
                  venue={evt.venue}
                  location={evt.location}
                  slug={evt.slug}
                  posterUrl={evt.posterUrl}
                  registrationOpen={evt.registrationOpen}
                  onRegister={() => setRegisteringEvent(evt)}
                />
              ))}
            </div>
          </div>
        </section>
      </main>

      <ChurchFooter
        ministryName={globalMissionConfig.ministryName}
        phoneNumbers={globalMissionConfig.contact.phones}
        email={globalMissionConfig.contact.email}
        address={globalMissionConfig.contact.address}
      />

      {/* Registration Modal */}
      <Modal
        isOpen={Boolean(registeringEvent)}
        onClose={() => {
          setRegisteringEvent(null);
          setRegSuccess(null);
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
            onSubmit={(e) => {
              e.preventDefault();
              const refCode = `GMFC-REG-${Math.floor(100000 + Math.random() * 900000)}`;
              setRegSuccess(refCode);
            }}
            style={{ display: "grid", gap: "16px" }}
          >
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                Full Name *
              </label>
              <input
                type="text"
                required
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
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                Email Address *
              </label>
              <input
                type="email"
                required
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
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                Telephone / WhatsApp Number *
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. +254 712 345 678"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid var(--church-border)",
                  borderRadius: "var(--church-radius)",
                }}
              />
            </div>
            <button type="submit" className="ch-btn ch-btn-accent" style={{ marginTop: "8px" }}>
              Submit Registration & Generate Reference
            </button>
          </form>
        )}
      </Modal>
    </>
  );
}
