import { describe, expect, it } from "vitest";
import { isEventUpcoming, pickBannerEvent, pickHighlightEvents, type PublicChurchEvent } from "./gmfc-events";

describe("gmfc-events auto-hide and date-awareness", () => {
  const pastEvent: PublicChurchEvent = {
    id: "evt-1",
    title: "Past Conference 2026",
    slug: "past-conf-2026",
    description: "Concluded event",
    posterUrl: "/images/events/past.jpg",
    venue: "Main Hall",
    startsAt: "2026-08-09T06:00:00Z",
    endsAt: "2026-08-16T18:00:00Z",
    status: "upcoming", // Even if database has upcoming, endsAt is in the past!
  };

  const futureEvent: PublicChurchEvent = {
    id: "evt-2",
    title: "Upcoming Revival 2026",
    slug: "upcoming-revival-2026",
    description: "Future event",
    posterUrl: "/images/events/future.jpg",
    venue: "Camp Ground",
    startsAt: "2026-12-01T09:00:00Z",
    endsAt: "2026-12-05T18:00:00Z",
    status: "upcoming",
  };

  const referenceNowMs = new Date("2026-11-19T00:00:00Z").getTime();

  it("identifies past events based on endsAt and marks them not upcoming", () => {
    expect(isEventUpcoming(pastEvent, referenceNowMs)).toBe(false);
    expect(isEventUpcoming(futureEvent, referenceNowMs)).toBe(true);
  });

  it("auto-hides banner (returns null) when all events are past", () => {
    const banner = pickBannerEvent([pastEvent], referenceNowMs);
    expect(banner).toBeNull();
  });

  it("displays banner when an upcoming event exists", () => {
    const banner = pickBannerEvent([pastEvent, futureEvent], referenceNowMs);
    expect(banner).not.toBeNull();
    expect(banner?.id).toBe("evt-2");
  });

  it("returns empty highlights when all events are past", () => {
    const highlights = pickHighlightEvents([pastEvent], 2, referenceNowMs);
    expect(highlights).toEqual([]);
  });
});
