"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteChrome } from "../../components/gmfc/SiteChrome";
import { PageHero } from "../../components/gmfc/PageHero";
import { getClientTenantHeaders } from "../../lib/client-tenant";
import {
  isEventUpcoming,
  stripHtmlToExcerpt,
  type PublicChurchEvent,
} from "../../lib/gmfc-events";

function SkeletonCard() {
  return (
    <div className="gmfci-el-skeleton">
      <div className="gmfci-el-skeleton-img" />
      <div className="gmfci-el-skeleton-body">
        <div className="gmfci-el-skeleton-line" />
        <div className="gmfci-el-skeleton-line" />
        <div className="gmfci-el-skeleton-line" />
        <div className="gmfci-el-skeleton-line" />
      </div>
    </div>
  );
}

function ImagePlaceholder({ title }: { title: string }) {
  return (
    <div className="gmfci-el-placeholder">
      <svg className="gmfci-el-placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path
          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 18.75h16.5M3.75 4.5h16.5a1.5 1.5 0 011.5 1.5v12a1.5 1.5 0 01-1.5 1.5H3.75a1.5 1.5 0 01-1.5-1.5V6a1.5 1.5 0 011.5-1.5z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="gmfci-el-placeholder-label">{title}</span>
    </div>
  );
}

function EventGridSection({
  events,
  loading,
  type,
}: {
  events: PublicChurchEvent[];
  loading: boolean;
  type: "upcoming" | "past";
}) {
  if (loading) {
    return (
      <div className="gmfci-el-skeleton-grid">
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="gmfci-el-empty">
        <svg className="gmfci-el-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path
            d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p className="gmfci-el-empty-title">
          {type === "upcoming" ? "No upcoming events scheduled" : "No past events found"}
        </p>
        <p className="gmfci-el-empty-sub">
          {type === "upcoming"
            ? "Check back soon — new events are added regularly."
            : "Past events will appear here once they have concluded."}
        </p>
      </div>
    );
  }

  return (
    <div className="gmfci-el-grid">
      {events.map((event) => {
        const date = new Date(event.startsAt);
        const month = date.toLocaleString("en-US", { month: "short" });
        const day = date.getDate();
        const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const excerpt = stripHtmlToExcerpt(event.description, 155);

        return (
          <article
            key={event.id}
            className={`gmfci-el-card${type === "past" ? " gmfci-el-card--past" : ""}`}
          >
            <div className="gmfci-el-img-wrap">
              {event.posterUrl ? (
                <>
                  <img
                    src={event.posterUrl}
                    alt={event.title}
                    className="gmfci-el-img"
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                  />
                  <div className="gmfci-el-img-overlay" />
                </>
              ) : (
                <ImagePlaceholder title={event.title} />
              )}

              <div className="gmfci-el-date-badge">
                <span className="gmfci-el-date-day">{day}</span>
                <span className="gmfci-el-date-month">{month}</span>
              </div>
            </div>

            <div className="gmfci-el-content">
              <div className="gmfci-el-meta">
                <svg className="gmfci-el-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {time}
                {event.venue ? ` · ${event.venue}` : ""}
              </div>

              <h3 className="gmfci-el-title">
                <Link href={`/events/${event.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                  {event.title}
                </Link>
              </h3>

              {excerpt && <p className="gmfci-el-excerpt">{excerpt}</p>}

              <Link href={`/events/${event.slug}`} className="gmfci-el-link">
                {type === "upcoming" ? "Register / Learn More" : "View Recap"}
                <svg className="gmfci-el-link-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default function EventsPage() {
  const [events, setEvents] = useState<PublicChurchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/v1/public/church/events?filter=all&limit=50", {
      cache: "no-store",
      headers: getClientTenantHeaders(),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load ministry events.");
        return (await response.json()) as { events?: PublicChurchEvent[] };
      })
      .then((data) => {
        if (active) setEvents(data.events ?? []);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load ministry events.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const upcomingEvents = events
    .filter((e) => isEventUpcoming(e))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const pastEvents = events
    .filter((e) => !isEventUpcoming(e))
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

  return (
    <SiteChrome currentPath="/events">
      <main id="main-content" className="gmfci-events-page">
        <PageHero
          eyebrow="What's happening"
          title="Ministry Events"
          subtitle="Join us as we gather for worship, prayer, medical outreaches, and Spirit-filled revival meetings across the nations."
          btn1Text="Contact Us"
          btn1Url="/contact"
        />

        <div className="gmfci-events-shell">
          {error && (
            <p role="alert" style={{ color: "#b91c1c", marginBottom: 24 }}>
              {error}
            </p>
          )}

          <section className="gmfci-events-section-block">
            <header className="gmfci-events-section-header">
              <div>
                <p className="gmfci-events-section-eyebrow">Coming Up</p>
                <h2 className="gmfci-events-section-title">Upcoming Events</h2>
              </div>
            </header>
            <EventGridSection events={upcomingEvents} loading={loading} type="upcoming" />
          </section>

          <section className="gmfci-events-section-block">
            <header className="gmfci-events-section-header">
              <div>
                <p className="gmfci-events-section-eyebrow">Look Back</p>
                <h2 className="gmfci-events-section-title">Past Events &amp; Highlights</h2>
              </div>
            </header>
            <EventGridSection events={pastEvents} loading={loading} type="past" />
          </section>
        </div>
      </main>
    </SiteChrome>
  );
}
