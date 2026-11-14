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
  const startMs = new Date(event.startsAt).getTime();
  return event.status === "upcoming" || event.status === "in_progress" || startMs >= nowMs;
}

export function pickBannerEvent(events: PublicChurchEvent[], nowMs = Date.now()): PublicChurchEvent | null {
  if (events.length === 0) return null;
  const strictFuture = events
    .filter((e) => new Date(e.startsAt).getTime() >= nowMs && e.status !== "cancelled")
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  if (strictFuture[0]) return strictFuture[0];

  const featured2026 = [...events]
    .filter((e) => e.status !== "cancelled")
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  return featured2026[0] ?? null;
}

export function pickHighlightEvents(
  events: PublicChurchEvent[],
  limit = 2,
  nowMs = Date.now(),
): PublicChurchEvent[] {
  const valid = events.filter((e) => e.status !== "cancelled");
  const strictFuture = valid
    .filter((e) => new Date(e.startsAt).getTime() >= nowMs)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  if (strictFuture.length > 0) return strictFuture.slice(0, limit);

  return [...valid]
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
    .slice(0, limit);
}

export function sanitizeRichEventHtml(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

