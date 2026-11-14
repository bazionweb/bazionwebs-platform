"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getClientTenantHeaders } from "../../lib/client-tenant";
import { pickBannerEvent, type PublicChurchEvent } from "../../lib/gmfc-events";

export function EventBanner() {
  const [event, setEvent] = useState<PublicChurchEvent | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/v1/public/church/events?filter=all&limit=10", {
      cache: "no-store",
      headers: getClientTenantHeaders(),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { events?: PublicChurchEvent[] } | null) => {
        if (!active || !data?.events) return;
        setEvent(pickBannerEvent(data.events));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (!event) return null;

  const startDate = new Date(event.startsAt);
  const endDate = event.endsAt ? new Date(event.endsAt) : null;
  const day = startDate.getDate();
  const month = startDate.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const year = startDate.getFullYear();

  const msLeft = startDate.getTime() - Date.now();
  const isFuture = msLeft > 0;
  const daysLeft = Math.max(0, Math.floor(msLeft / (1000 * 60 * 60 * 24)));

  const dateRange = endDate
    ? `${day}–${endDate.getDate()} ${month} ${year}`
    : `${day} ${month} ${year}`;

  return (
    <section className="gmfci-eb-section" aria-label="Upcoming Event">
      <div className="gmfci-eb-inner">
        <div className="gmfci-eb-accent" aria-hidden="true" />

        <div className="gmfci-eb-date-block">
          <span className="gmfci-eb-date-day">{day}</span>
          <span className="gmfci-eb-date-month">{month}</span>
          <span className="gmfci-eb-date-year">{year}</span>
        </div>

        <div className="gmfci-eb-divider" aria-hidden="true" />

        <div className="gmfci-eb-text">
          <div className="gmfci-eb-eyebrow">
            <span className="gmfci-eb-live-dot" aria-hidden="true" />
            {isFuture ? "Upcoming Event" : "Featured Event"}
          </div>
          <h2 className="gmfci-eb-title">{event.title}</h2>
          <div className="gmfci-eb-meta">
            {event.venue && (
              <span className="gmfci-eb-meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {event.venue}
              </span>
            )}
            <span className="gmfci-eb-meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              {dateRange}
            </span>
          </div>
        </div>

        {isFuture ? (
          <div className="gmfci-eb-countdown">
            <span className="gmfci-eb-countdown-num">{daysLeft}</span>
            <span className="gmfci-eb-countdown-label">days away</span>
          </div>
        ) : (
          <div className="gmfci-eb-countdown">
            <span className="gmfci-eb-countdown-num">{year}</span>
            <span className="gmfci-eb-countdown-label">highlight</span>
          </div>
        )}

        {event.posterUrl && (
          <div className="gmfci-eb-thumbnail" aria-hidden="true">
            <img
              src={event.posterUrl}
              alt={event.title}
              className="gmfci-eb-thumbnail-img"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            />
          </div>
        )}

        <Link href={`/events/${event.slug}`} className="gmfci-eb-cta">
          View Details
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </section>
  );
}

export default EventBanner;

