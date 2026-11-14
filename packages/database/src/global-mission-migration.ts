export type SourceEvent = {
  title?: unknown;
  slug?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  excerpt?: unknown;
  description?: unknown;
  imageUrl?: unknown;
  location?: unknown;
};

export type GlobalMissionEventRow = {
  title: string;
  slug: string;
  description: string | null;
  posterUrl: string | null;
  venue: string | null;
  startsAt: Date;
  endsAt: Date | null;
  status: "upcoming" | "completed";
};

const localPosterBySlug: Record<string, string> = {
  "mega-conference-2026": "/images/events/mega-conference-2026.jpg",
  "mission-impact-breakfast": "/images/events/mission-impact-breakfast.jpg",
  "free-medical-camp": "/images/events/camp.jpg",
};

function safeImageUrl(value: string): string | null {
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try { return new URL(value).protocol === "https:" ? value : null; } catch { return null; }
}

export function mapGlobalMissionEvents(
  sourceEvents: SourceEvent[],
  now = new Date(),
): { events: GlobalMissionEventRow[]; skipped: number } {
  const events = sourceEvents.flatMap((source) => {
    const title = typeof source.title === "string" ? source.title.trim() : "";
    const slug = typeof source.slug === "string" ? source.slug.trim().toLowerCase() : "";
    const startsAt = typeof source.startsAt === "string" ? new Date(source.startsAt) : null;
    if (!title || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !startsAt || Number.isNaN(startsAt.getTime())) return [];
    const endsAt = typeof source.endsAt === "string" && !Number.isNaN(new Date(source.endsAt).getTime())
      ? new Date(source.endsAt)
      : null;
    const localPoster = /mega-conference|medical-camp/.test(slug)
      ? "/images/events/mega-conference-2026.jpg"
      : /mission-impact-breakfast/.test(slug)
        ? "/images/events/mission-impact-breakfast.jpg"
        : /awake-you-who-sleep|mt-kenya-revival/.test(slug)
          ? "/images/events/conference.jpg"
          : undefined;
    const rawImage = typeof source.imageUrl === "string" ? source.imageUrl.trim() : "";
    const localSourceImage = rawImage.startsWith("/") && !rawImage.startsWith("//") ? rawImage : null;
    const posterUrl = localSourceImage ?? localPosterBySlug[slug] ?? localPoster ?? safeImageUrl(rawImage);
    const description = [source.description, source.excerpt]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => value.trim())
      .filter((value, index, values) => values.indexOf(value) === index)
      .join("\n\n") || null;
    const location = typeof source.location === "string" ? source.location.trim().slice(0, 180) : "";
    return [{
      title: title.slice(0, 200),
      slug: slug.slice(0, 140),
      description,
      posterUrl,
      venue: location || null,
      startsAt,
      endsAt,
      status: startsAt > now ? "upcoming" as const : "completed" as const,
    }];
  });
  return { events, skipped: sourceEvents.length - events.length };
}
