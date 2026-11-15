"use client";

import type { ReactNode } from "react";
import { ResponsiveImage } from "./responsive-image.js";

export interface EventCardProps {
  id: string;
  title: string;
  dateStr: string; // e.g. "2026-11-20" or "Nov 20, 2026"
  dayBadge?: string; // e.g. "20"
  monthBadge?: string; // e.g. "NOV"
  time?: string;
  venue?: string;
  location?: string;
  posterUrl?: string;
  slug?: string;
  registrationOpen?: boolean;
  onRegister?: (event: { id: string; title: string }) => void;
  calendarAction?: ReactNode;
}

export function EventCard({
  id,
  title,
  dateStr,
  dayBadge,
  monthBadge,
  time,
  venue,
  location,
  posterUrl,
  slug,
  registrationOpen = true,
  onRegister,
  calendarAction,
}: EventCardProps) {
  const detailUrl = slug ? `/events/${slug}` : undefined;

  return (
    <article className="ch-card">
      <div className="ch-card-media">
        {posterUrl ? <ResponsiveImage src={posterUrl} alt={title} sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 33vw" /> : <div className="ch-event-placeholder" aria-hidden="true"><span>{title}</span></div>}
        {(dayBadge || monthBadge) && (
          <div className="ch-event-date-badge">
            {dayBadge && <div className="ch-event-date-day">{dayBadge}</div>}
            {monthBadge && <div className="ch-event-date-month">{monthBadge}</div>}
          </div>
        )}
      </div>
      <div className="ch-card-body">
        <h3 className="ch-event-title">
          {detailUrl ? (
            <a href={detailUrl} style={{ color: "inherit", textDecoration: "none" }}>
              {title}
            </a>
          ) : (
            title
          )}
        </h3>
        <div className="ch-event-details">
          <div>📅 {dateStr}</div>
          {time && <div>⏰ {time}</div>}
          {(venue || location) && (
            <div>📍 {[venue, location].filter(Boolean).join(", ")}</div>
          )}
        </div>
        <div style={{ marginTop: "auto", display: "flex", gap: "10px" }}>
          {registrationOpen ? (
            <button
              type="button"
              className="ch-btn ch-btn-accent"
              style={{ flexGrow: 1 }}
              onClick={() => onRegister?.({ id, title })}
            >
              Register Now
            </button>
          ) : (
            <span
              className="ch-btn ch-btn-outline"
              style={{ flexGrow: 1, cursor: "default", opacity: 0.7 }}
            >
              Registration Closed
            </span>
          )}
          {detailUrl && (
            <a href={detailUrl} className="ch-btn ch-btn-outline" style={{ flexGrow: 1 }}>
              Details
            </a>
          )}
        </div>
        {calendarAction && <div className="ch-event-calendar-action">{calendarAction}</div>}
      </div>
    </article>
  );
}
