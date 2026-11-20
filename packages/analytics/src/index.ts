export const DEFAULT_ANALYTICS_RETENTION_DAYS = 90;

export interface AnalyticsEvent {
  tenantId: string;
  name: string;
  occurredAt: string;
  actorId?: string | undefined;
  properties: Record<string, string | number | boolean | null>;
}

export interface AnalyticsSink {
  track(event: AnalyticsEvent): Promise<void>;
}

export interface PreparedAnalyticsEvent {
  eventName: string;
  path: string;
  actorId: string | null;
  properties: Record<string, string | number | boolean | null>;
  occurredAt: Date;
  retentionExpiresAt: Date;
}

export interface AnalyticsPolicyInput {
  enabled: boolean;
  retentionDays: number;
}

export interface AnalyticsSummary {
  totalEvents: number;
  pageViews: number;
  conversions: number;
  conversionRatePercent: number;
  topPaths: Array<{ path: string; count: number }>;
  breakdownByEvent: Record<string, number>;
}

const SENSITIVE_PROPERTY_KEY = /(password|secret|token|cookie|authorization|credential|card|cvv|ssn|email|phone)/i;
const VALID_EVENT_NAME = /^[a-z][a-z0-9_.:-]{1,79}$/i;
const CONVERSION_EVENT_NAMES = new Set([
  "enquiry_submitted",
  "checkout_started",
  "order_paid",
  "donation_completed",
  "registration_completed",
  "conversion",
]);

export function sanitizeAnalyticsProperties(
  raw: Record<string, unknown> | undefined | null,
): Record<string, string | number | boolean | null> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: Record<string, string | number | boolean | null> = {};
  const entries = Object.entries(raw).slice(0, 32);
  for (const [key, value] of entries) {
    const cleanKey = key.trim().slice(0, 64);
    if (!cleanKey) continue;
    if (SENSITIVE_PROPERTY_KEY.test(cleanKey)) {
      throw new Error(`Analytics property key is not permitted for privacy compliance: ${cleanKey}`);
    }
    if (value === null || typeof value === "boolean") {
      result[cleanKey] = value;
    } else if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new Error(`Analytics property ${cleanKey} must be a finite number.`);
      result[cleanKey] = value;
    } else if (typeof value === "string") {
      result[cleanKey] = value.slice(0, 256);
    } else {
      throw new Error(`Analytics property ${cleanKey} must be scalar.`);
    }
  }
  return result;
}

export function analyticsRetentionDeadline(
  occurredAt: Date,
  retentionDays = DEFAULT_ANALYTICS_RETENTION_DAYS,
): Date {
  if (!Number.isFinite(occurredAt.getTime())) {
    throw new RangeError("A valid analytics event timestamp is required.");
  }
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) {
    throw new RangeError("Analytics retentionDays must be an integer between 1 and 3650.");
  }
  const expiresAt = new Date(occurredAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + retentionDays);
  return expiresAt;
}

export function prepareAnalyticsEvent(
  input: {
    name?: string;
    path?: string;
    actorId?: string | null;
    properties?: Record<string, unknown>;
  },
  options: { occurredAt?: Date; retentionDays?: number } = {},
): PreparedAnalyticsEvent {
  const eventName = typeof input.name === "string" ? input.name.trim() : "";
  if (!VALID_EVENT_NAME.test(eventName)) {
    throw new Error("Analytics event name must be 2–80 characters (letters, digits, _, ., :, -).");
  }
  const rawPath = typeof input.path === "string" ? input.path.trim() : "/";
  const path = rawPath.startsWith("/") ? rawPath.slice(0, 512) : `/${rawPath}`.slice(0, 512);
  const actorId = typeof input.actorId === "string" && input.actorId.trim()
    ? input.actorId.trim().slice(0, 128)
    : null;
  const occurredAt = options.occurredAt ?? new Date();
  const retentionDays = options.retentionDays ?? DEFAULT_ANALYTICS_RETENTION_DAYS;
  const properties = sanitizeAnalyticsProperties(input.properties);

  return {
    eventName,
    path,
    actorId,
    properties,
    occurredAt,
    retentionExpiresAt: analyticsRetentionDeadline(occurredAt, retentionDays),
  };
}

export function validateAnalyticsPolicyInput(input: unknown): AnalyticsPolicyInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Invalid analytics policy payload.");
  }
  const candidate = input as Partial<AnalyticsPolicyInput>;
  if (typeof candidate.enabled !== "boolean") {
    throw new Error("enabled must be a boolean.");
  }
  if (
    typeof candidate.retentionDays !== "number"
    || !Number.isInteger(candidate.retentionDays)
    || candidate.retentionDays < 1
    || candidate.retentionDays > 3650
  ) {
    throw new Error("retentionDays must be an integer between 1 and 3650.");
  }
  return { enabled: candidate.enabled, retentionDays: candidate.retentionDays };
}

export function summarizeAnalyticsEvents(
  events: ReadonlyArray<{ eventName: string; path: string }>,
): AnalyticsSummary {
  let pageViews = 0;
  let conversions = 0;
  const pathCounts = new Map<string, number>();
  const breakdownByEvent: Record<string, number> = {};

  for (const event of events) {
    breakdownByEvent[event.eventName] = (breakdownByEvent[event.eventName] ?? 0) + 1;
    if (event.eventName === "page_view") pageViews += 1;
    if (CONVERSION_EVENT_NAMES.has(event.eventName)) conversions += 1;
    pathCounts.set(event.path, (pathCounts.get(event.path) ?? 0) + 1);
  }

  const topPaths = [...pathCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  const conversionRatePercent = pageViews > 0
    ? Math.round((conversions / pageViews) * 10000) / 100
    : 0;

  return {
    totalEvents: events.length,
    pageViews,
    conversions,
    conversionRatePercent,
    topPaths,
    breakdownByEvent,
  };
}
