"use client";

import { pulse } from "@bazion/ui";
import { downloadChurchEventCalendar, type ChurchCalendarEvent } from "../../lib/event-calendar";

export function EventCalendarButton({ event }: { event: ChurchCalendarEvent }) {
  if (!Number.isFinite(new Date(event.startsAt).getTime())) return null;

  return (
    <button
      type="button"
      className="ch-event-calendar-button"
      onClick={() => {
        downloadChurchEventCalendar(event);
        pulse.success("Calendar invite downloaded", {
          detail: `${event.title} (.ics) is ready in your downloads.`,
          duration: 3500,
        });
      }}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path d="M7 2v4m10-4v4M4 9h16M5 4h14a1 1 0 0 1 1 1v14H4V5a1 1 0 0 1 1-1Z" />
      </svg>
      Add to calendar
    </button>
  );
}
