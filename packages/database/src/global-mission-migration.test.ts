import { describe, expect, it } from "vitest";
import { mapGlobalMissionEvents } from "./global-mission-migration.js";

describe("mapGlobalMissionEvents", () => {
  const now = new Date("2026-11-09T00:00:00.000Z");

  it("maps a past GMFC event to a local poster and completed status", () => {
    const result = mapGlobalMissionEvents([{
      title: "Annual Mega Conference",
      slug: "mega-conference-medical-camp-2026",
      startsAt: "2026-08-09T09:00:00.000Z",
      endsAt: "2026-08-16T20:00:00.000Z",
      excerpt: "A public event excerpt.",
      imageUrl: "https://old-site.example/poster.jpg",
      location: "Nairobi",
    }], now);

    expect(result.skipped).toBe(0);
    expect(result.events).toEqual([expect.objectContaining({
      slug: "mega-conference-medical-camp-2026",
      status: "completed",
      posterUrl: "/images/events/mega-conference-2026.jpg",
      venue: "Nairobi",
      description: "A public event excerpt.",
    })]);
  });

  it("marks future events upcoming and combines distinct description fields", () => {
    const result = mapGlobalMissionEvents([{
      title: "Mission Breakfast",
      slug: "mission-impact-breakfast-2027",
      startsAt: "2027-02-10T08:00:00.000Z",
      excerpt: "Short summary.",
      description: "Full details.",
      imageUrl: "http://insecure.example/poster.jpg",
    }], now);

    expect(result.events[0]).toMatchObject({
      status: "upcoming",
      posterUrl: "/images/events/mission-impact-breakfast.jpg",
      description: "Full details.\n\nShort summary.",
      venue: null,
    });
  });

  it("skips events without safe identifiers or usable start dates", () => {
    const result = mapGlobalMissionEvents([
      { title: "No slug", startsAt: "2027-02-10T08:00:00.000Z" },
      { title: "No date", slug: "no-date" },
      { title: "Bad slug", slug: "invalid slug", startsAt: "2027-02-10T08:00:00.000Z" },
    ], now);

    expect(result.events).toEqual([]);
    expect(result.skipped).toBe(3);
  });

  it("does not migrate insecure unknown image URLs", () => {
    const result = mapGlobalMissionEvents([{
      title: "Other outreach",
      slug: "other-outreach",
      startsAt: "2027-02-10T08:00:00.000Z",
      imageUrl: "http://old-site.example/poster.jpg",
    }], now);

    expect(result.events[0]?.posterUrl).toBeNull();
  });
});
