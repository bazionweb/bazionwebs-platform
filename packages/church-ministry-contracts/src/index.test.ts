import { describe, expect, it } from "vitest";
import {
  churchPublicSiteSettingsSchema,
  churchSiteSettingsInputSchema,
  contactMessageSchema,
  donationCampaignInputSchema,
  donationInitiateSchema,
  eventInputSchema,
  eventRegistrationSchema,
  newsletterSubscribeSchema,
  prayerRequestSchema,
} from "./index.js";

describe("church public site settings contracts", () => {
  it("provides complete defaults for a new ministry site", () => {
    const settings = churchPublicSiteSettingsSchema.parse({});

    expect(settings.branding).toEqual({
      primaryColor: "#193a31",
      secondaryColor: "#315e50",
      accentColor: "#8b5b29",
    });
    expect(settings.hero.title).toBe("A place to belong");
    expect(settings.visitorInfo).toEqual({ arrival: "", children: "", accessibility: "", parking: "" });
    expect(settings.serviceTimes).toEqual([]);
    expect(settings.giving.suggestedAmounts).toEqual([]);
  });

  it("accepts site-relative media and HTTPS external links", () => {
    const result = churchPublicSiteSettingsSchema.safeParse({
      branding: { heroImageUrl: "/images/hero.jpg" },
      locations: [{ name: "Main campus", address: "Town centre", mapUrl: "https://maps.example.org/place" }],
      galleryImages: [{ imageUrl: "/images/community.jpg", alt: "Volunteers serving lunch" }],
    });

    expect(result.success).toBe(true);
  });

  it("rejects inaccessible theme colors and insecure public links", () => {
    const lowContrast = churchPublicSiteSettingsSchema.safeParse({ branding: { primaryColor: "#ffffff" } });
    const insecureLink = churchPublicSiteSettingsSchema.safeParse({
      locations: [{ name: "Main campus", address: "Town centre", mapUrl: "http://maps.example.org/place" }],
    });

    expect(lowContrast.success).toBe(false);
    expect(insecureLink.success).toBe(false);
  });

  it("fills optional ministry profile fields and allows a local logo asset", () => {
    const result = churchSiteSettingsInputSchema.parse({
      profile: { ministryName: "Harbour Church", logoUrl: "/images/logo.svg" },
      settings: {},
    });

    expect(result.profile.contact.phones).toEqual([]);
    expect(result.profile.contact.email).toBe("");
    expect(result.profile.logoUrl).toBe("/images/logo.svg");
  });
});

describe("church submission consent contracts", () => {
  const consentCases = [
    [eventRegistrationSchema, { fullName: "Miriam Wanjiku", email: "miriam@example.org", telephone: "+254712345678" }],
    [donationInitiateSchema, { amount: 100, phoneNumber: "+254712345678", givingCategory: "General Ministry" }],
    [contactMessageSchema, { fullName: "Miriam Wanjiku", email: "miriam@example.org", subject: "A question", message: "I would like to learn more about the ministry." }],
    [prayerRequestSchema, { fullName: "Miriam Wanjiku", requestText: "Please pray for my family this week." }],
    [newsletterSubscribeSchema, { email: "miriam@example.org" }],
  ] as const;

  it.each(consentCases)("requires affirmative consent for %s", (schema, input) => {
    expect(schema.safeParse(input).success).toBe(false);
    const consentKey = schema === newsletterSubscribeSchema ? "consent" : "privacyConsent";
    expect(schema.safeParse({ ...input, [consentKey]: true }).success).toBe(true);
  });
});

describe("event and giving campaign date contracts", () => {
  it("rejects an event that ends before it starts", () => {
    const result = eventInputSchema.safeParse({
      title: "Community gathering",
      slug: "community-gathering",
      startsAt: "2026-12-10T12:00:00.000Z",
      endsAt: "2026-12-10T11:00:00.000Z",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a giving campaign that ends before it starts", () => {
    const result = donationCampaignInputSchema.safeParse({
      title: "Community hall",
      slug: "community-hall",
      targetAmountKsh: 100_000,
      startsAt: "2026-12-10T12:00:00.000Z",
      endsAt: "2026-12-10T11:00:00.000Z",
    });

    expect(result.success).toBe(false);
  });
});
