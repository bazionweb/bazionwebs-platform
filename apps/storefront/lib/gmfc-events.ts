export interface PublicChurchEvent {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  posterUrl: string | null;
  venue: string | null;
  address?: string | null;
  startsAt: string;
  endsAt: string | null;
  registrationEnabled?: boolean;
  registrationCapacity?: number | null;
  status: "upcoming" | "in_progress" | "completed" | "cancelled";
}

export function stripHtmlToExcerpt(raw: string | null | undefined, maxLength = 155): string {
  if (!raw) return "";
  const plain = raw
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength - 1).trimEnd()}…`;
}

export function isEventUpcoming(event: PublicChurchEvent, nowMs = Date.now()): boolean {
  if (event.status === "cancelled" || event.status === "completed") return false;
  const startMs = new Date(event.startsAt).getTime();
  if (Number.isNaN(startMs)) return false;
  const endMs = event.endsAt ? new Date(event.endsAt).getTime() : startMs + 24 * 60 * 60 * 1000;
  return endMs >= nowMs;
}

export function pickBannerEvent(events: PublicChurchEvent[], nowMs = Date.now()): PublicChurchEvent | null {
  if (!events || events.length === 0) return null;
  const upcoming = events
    .filter((e) => isEventUpcoming(e, nowMs))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  return upcoming[0] ?? null;
}

export function pickHighlightEvents(
  events: PublicChurchEvent[],
  limit = 2,
  nowMs = Date.now(),
): PublicChurchEvent[] {
  if (!events || events.length === 0) return [];
  const upcoming = events
    .filter((e) => isEventUpcoming(e, nowMs))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  return upcoming.slice(0, limit);
}

export function sanitizeRichEventHtml(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}
