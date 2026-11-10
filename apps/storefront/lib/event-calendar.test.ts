import { describe, expect, it } from "vitest";
import { buildChurchEventCalendar } from "./event-calendar";

const CREATED_AT = new Date("2026-11-10T08:30:00.000Z");

describe("church event calendar export", () => {
  it("exports event start and end as UTC while preserving their instant", () => {
    const calendar = buildChurchEventCalendar({
      id: "event-123",
      title: "Nations Revival Night",
      startsAt: "2026-12-05T19:00:00+03:00",
      endsAt: "2026-12-05T22:00:00+03:00",
    }, CREATED_AT);

    expect(calendar).toContain("UID:event-123@bazionweb.com\r\n");
    expect(calendar).toContain("DTSTAMP:20261110T083000Z\r\n");
    expect(calendar).toContain("DTSTART:20261205T160000Z\r\n");
    expect(calendar).toContain("DTEND:20261205T190000Z\r\n");
    expect(calendar.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("escapes text fields and normalizes description line breaks", () => {
    const calendar = buildChurchEventCalendar({
      id: "event-124",
      title: "Prayer, Praise; Hope\\Again",
      startsAt: "2026-12-05T16:00:00Z",
      description: "First line\r\nSecond, blessed line",
      location: "Nairobi, Kenya",
    }, CREATED_AT);

    expect(calendar).toContain("SUMMARY:Prayer\\, Praise\\; Hope\\\\Again\r\n");
    expect(calendar).toContain("DESCRIPTION:First line\\nSecond\\, blessed line\r\n");
    expect(calendar).toContain("LOCATION:Nairobi\\, Kenya\r\n");
  });

  it("folds long UTF-8 lines to no more than 75 octets", () => {
    const calendar = buildChurchEventCalendar({
      id: "event-125",
      title: "🌿".repeat(30),
      startsAt: "2026-12-05T16:00:00Z",
    }, CREATED_AT);
    const encoder = new TextEncoder();

    for (const line of calendar.split("\r\n").filter(Boolean)) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it("rejects events without a valid start time", () => {
    expect(() => buildChurchEventCalendar({
      id: "event-126",
      title: "Missing date",
      startsAt: "not-a-date",
    }, CREATED_AT)).toThrow("A valid event start time is required");
  });
});
