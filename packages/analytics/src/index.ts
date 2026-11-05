export interface AnalyticsEvent {
  tenantId: string;
  name: string;
  occurredAt: string;
  actorId?: string;
  properties: Record<string, string | number | boolean | null>;
}

export interface AnalyticsSink {
  track(event: AnalyticsEvent): Promise<void>;
}

// Do not put passwords, payment secrets, full payment details or unnecessary PII in event properties.
