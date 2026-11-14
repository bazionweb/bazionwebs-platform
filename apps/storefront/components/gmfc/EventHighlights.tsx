"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getClientTenantHeaders } from "../../lib/client-tenant";
import {
  pickHighlightEvents,
  stripHtmlToExcerpt,
  type PublicChurchEvent,
} from "../../lib/gmfc-events";

export function EventHighlights() {
  const [events, setEvents] = useState<PublicChurchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/v1/public/church/events?filter=all&limit=10", {
      cache: "no-store",
      headers: getClientTenantHeaders(),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json()) as { events?: PublicChurchEvent[] };
      })
      .then((data) => {
        if (!active) return;
        setEvents(pickHighlightEvents(data.events ?? [], 2));
      })
      .catch((error: unknown) => {
        if (active) setFetchError(error instanceof Error ? error.message : "Could not load events.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="gmfci-event-highlights">
      <div className="gmfci-eh-container">
        <div className="gmfci-eh-header">
          <div>
            <h2 className="gmfci-eh-title">Upcoming Events</h2>
            <p className="gmfci-eh-subtitle">Join us in our upcoming meetings and outreaches.</p>
          </div>
          <Link href="/events" className="gmfci-eh-cta-btn">
            View All Events
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
        </div>

        {loading ? (
          <div className="gmfci-eh-grid">
            {[1, 2].map((i) => (
              <div
                key={i}
                style={{
                  background: "#e5e7eb",
                  borderRadius: "16px",
                  height: "350px",
                  width: "100%",
                }}
              />
            ))}
          </div>
        ) : events.length > 0 ? (
          <div className="gmfci-eh-grid">
            {events.map((event) => {
              const date = new Date(event.startsAt);
              const day = date.getDate();
              const month = date.toLocaleString("en-US", { month: "short" });
              const excerpt = stripHtmlToExcerpt(event.description, 155);

              return (
                <div key={event.id} className="gmfci-eh-card">
                  <div className="gmfci-eh-img-wrap">
                    {event.posterUrl ? (
                      <img
                        src={event.posterUrl}
                        alt={event.title}
                        className="gmfci-eh-img"
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                      />
                    ) : (
                      <div className="gmfci-eh-no-img">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}

                    <div className="gmfci-eh-date-badge">
                      <span className="gmfci-eh-date-day">{day}</span>
                      <span className="gmfci-eh-date-month">{month}</span>
                    </div>
                  </div>

                  <div className="gmfci-eh-content">
                    <h3 className="gmfci-eh-event-title">{event.title}</h3>
                    {excerpt && <p className="gmfci-eh-event-excerpt">{excerpt}</p>}
                    <Link href={`/events/${event.slug}`} className="gmfci-eh-read-more">
                      More details
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : fetchError ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              background: "#fff5f5",
              borderRadius: "16px",
              border: "1px solid #fecaca",
            }}
          >
            <p style={{ color: "#dc2626", margin: 0, fontSize: "15px", fontWeight: 600 }}>
              Could not load events
            </p>
          </div>
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              background: "white",
              borderRadius: "16px",
              border: "1px solid #f3f4f6",
            }}
          >
            <p style={{ color: "#6b7280", margin: 0, fontSize: "16px" }}>
              No upcoming events right now. Check back later!
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export default EventHighlights;

