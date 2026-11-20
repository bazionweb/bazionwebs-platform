import { describe, expect, it } from "vitest";
import {
  DEFAULT_ANALYTICS_RETENTION_DAYS,
  prepareAnalyticsEvent,
  sanitizeAnalyticsProperties,
  summarizeAnalyticsEvents,
  validateAnalyticsPolicyInput,
} from "./index.js";

describe("analytics domain rules", () => {
  it("sanitizes properties and rejects sensitive PII or secret keys", () => {
    expect(sanitizeAnalyticsProperties({ category: "sermons", featured: true, count: 2 })).toEqual({
      category: "sermons",
      featured: true,
      count: 2,
    });
    expect(() => sanitizeAnalyticsProperties({ email: "user@example.test" })).toThrow(/not permitted/);
    expect(() => sanitizeAnalyticsProperties({ sessionToken: "secret" })).toThrow(/not permitted/);
  });

  it("prepares analytics events with server-computed retention deadlines", () => {
    const occurredAt = new Date("2026-11-18T10:00:00.000Z");
    const prepared = prepareAnalyticsEvent(
      { name: "order_paid", path: "shop/item-1", actorId: "guest-1", properties: { currency: "KES" } },
      { occurredAt, retentionDays: 30 },
    );
    expect(DEFAULT_ANALYTICS_RETENTION_DAYS).toBe(90);
    expect(prepared.path).toBe("/shop/item-1");
    expect(prepared.retentionExpiresAt.toISOString()).toBe("2026-12-18T10:00:00.000Z");
  });

  it("validates policy bounds and summarizes traffic & conversion funnels", () => {
    expect(validateAnalyticsPolicyInput({ enabled: true, retentionDays: 60 })).toEqual({
      enabled: true,
      retentionDays: 60,
    });
    expect(() => validateAnalyticsPolicyInput({ enabled: true, retentionDays: 5000 })).toThrow(/3650/);

    const summary = summarizeAnalyticsEvents([
      { eventName: "page_view", path: "/" },
      { eventName: "page_view", path: "/shop" },
      { eventName: "order_paid", path: "/checkout" },
      { eventName: "page_view", path: "/" },
      { eventName: "page_view", path: "/about" },
    ]);
    expect(summary.totalEvents).toBe(5);
    expect(summary.pageViews).toBe(4);
    expect(summary.conversions).toBe(1);
    expect(summary.conversionRatePercent).toBe(25);
    expect(summary.topPaths[0]).toEqual({ path: "/", count: 2 });
  });
});
