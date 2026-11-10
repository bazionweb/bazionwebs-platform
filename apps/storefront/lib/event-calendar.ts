export interface ChurchCalendarEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  description?: string | null;
  location?: string | null;
}

function escapeCalendarText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function toCalendarDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function foldCalendarLine(line: string): string {
  const encoder = new TextEncoder();
  const folded: string[] = [];
  let current = "";
  let octets = 0;

  for (const character of line) {
    const characterOctets = encoder.encode(character).length;
    if (octets + characterOctets > 75 && current) {
      folded.push(current);
      current = " " + character;
      octets = 1 + characterOctets;
    } else {
      current += character;
      octets += characterOctets;
    }
  }

  folded.push(current);
  return folded.join("\r\n");
}

export function buildChurchEventCalendar(event: ChurchCalendarEvent, createdAt = new Date()): string {
  const startsAt = new Date(event.startsAt);
  if (!Number.isFinite(startsAt.getTime())) {
    throw new RangeError("A valid event start time is required to create a calendar file.");
  }

  const endsAt = event.endsAt ? new Date(event.endsAt) : null;
  const validEnd = endsAt && Number.isFinite(endsAt.getTime()) && endsAt > startsAt ? endsAt : null;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bazion Web//Church Events//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    "UID:" + escapeCalendarText(event.id) + "@bazionweb.com",
    "DTSTAMP:" + toCalendarDateTime(createdAt),
    "DTSTART:" + toCalendarDateTime(startsAt),
    ...(validEnd ? ["DTEND:" + toCalendarDateTime(validEnd)] : []),
    "SUMMARY:" + escapeCalendarText(event.title),
    ...(event.description?.trim() ? ["DESCRIPTION:" + escapeCalendarText(event.description.trim())] : []),
    ...(event.location?.trim() ? ["LOCATION:" + escapeCalendarText(event.location.trim())] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.map(foldCalendarLine).join("\r\n") + "\r\n";
}

export function downloadChurchEventCalendar(event: ChurchCalendarEvent): void {
  const calendar = buildChurchEventCalendar(event);
  const file = new Blob([calendar], { type: "text/calendar;charset=utf-8" });
  const fileName = event.title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "church-event";
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName + ".ics";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
