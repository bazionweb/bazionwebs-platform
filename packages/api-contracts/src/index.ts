import { z } from "zod";

export const currencySchema = z.enum(["KES", "USD", "EUR", "GBP"]);
export const createCartSchema = z.object({ currency: currencySchema.default("KES") });
export const addCartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
});
export const updateCartItemSchema = z.object({ quantity: z.number().int().min(1).max(99) });
export const checkoutSchema = z.object({
  cartId: z.string().uuid(),
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().min(7).max(24),
  }),
  shippingAddress: z.object({
    line1: z.string().trim().min(2).max(180),
    line2: z.string().trim().max(180).optional(),
    city: z.string().trim().min(2).max(100),
    countryCode: z.string().length(2).transform((v) => v.toUpperCase()),
    postalCode: z.string().trim().max(20).optional(),
  }),
});

export type CreateCartInput = z.infer<typeof createCartSchema>;
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;

// ─── Church & Ministry Domain Schemas ──────────────────────────────────────────

export const sermonInputSchema = z.object({
  title: z.string().trim().min(3).max(200),
  slug: z.string().trim().min(3).max(140).regex(/^[a-z0-9-]+$/),
  speaker: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000).optional(),
  categoryId: z.string().uuid().optional(),
  youtubeVideoId: z.string().trim().min(5).max(64).optional(),
  thumbnailUrl: z.string().url().optional(),
  scriptureReference: z.string().trim().max(160).optional(),
  publishedAt: z.string().datetime().optional(),
  status: z.enum(["draft", "published", "archived"]).default("published"),
});
export type SermonInput = z.infer<typeof sermonInputSchema>;

export const eventInputSchema = z.object({
  title: z.string().trim().min(3).max(200),
  slug: z.string().trim().min(3).max(140).regex(/^[a-z0-9-]+$/),
  description: z.string().trim().max(5000).optional(),
  posterUrl: z.string().url().optional(),
  venue: z.string().trim().max(180).optional(),
  address: z.string().trim().max(500).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  registrationEnabled: z.boolean().default(true),
  registrationCapacity: z.number().int().positive().optional(),
  status: z.enum(["upcoming", "in_progress", "completed", "cancelled"]).default("upcoming"),
}).superRefine((event, ctx) => {
  if (event.endsAt && new Date(event.endsAt) < new Date(event.startsAt)) {
    ctx.addIssue({ code: "custom", message: "Event end time must be after its start time.", path: ["endsAt"] });
  }
});
export type EventInput = z.infer<typeof eventInputSchema>;

export const eventRegistrationSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254),
  telephone: z.string().trim().min(7).max(30),
  privacyConsent: z.literal(true),
});
export type EventRegistrationInput = z.infer<typeof eventRegistrationSchema>;

export const donationInitiateSchema = z.object({
  campaignId: z.string().uuid().optional(),
  amount: z.number().int().min(10).max(250_000), // whole KES for M-Pesa STK Push
  currency: z.literal("KES").default("KES"),
  givingCategory: z.string().trim().min(2).max(80),
  phoneNumber: z.string().trim().min(9).max(20),
  donorName: z.string().trim().max(160).optional(),
  donorEmail: z.string().trim().email().max(254).optional(),
  anonymous: z.boolean().default(false),
  privacyConsent: z.literal(true),
});
export type DonationInitiateInput = z.infer<typeof donationInitiateSchema>;

export const donationCampaignInputSchema = z.object({
  title: z.string().trim().min(3).max(180),
  slug: z.string().trim().min(3).max(120).regex(/^[a-z0-9-]+$/),
  description: z.string().trim().max(5000).optional(),
  targetAmountKsh: z.number().int().min(1).max(500_000_000),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  status: z.enum(["active", "paused", "completed"]).default("active"),
}).superRefine((campaign, ctx) => {
  if (campaign.startsAt && campaign.endsAt && new Date(campaign.endsAt) < new Date(campaign.startsAt)) {
    ctx.addIssue({ code: "custom", message: "Campaign end time must be after its start time.", path: ["endsAt"] });
  }
});
export type DonationCampaignInput = z.infer<typeof donationCampaignInputSchema>;

export const contactMessageSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254),
  telephone: z.string().trim().max(30).optional(),
  subject: z.string().trim().min(2).max(200),
  message: z.string().trim().min(10).max(5000),
  category: z.enum([
    "General Enquiry",
    "Prayer Request",
    "Partnership",
    "Event Enquiry",
    "Testimony",
    "Other",
  ]).default("General Enquiry"),
  privacyConsent: z.literal(true),
});
export type ContactMessageInput = z.infer<typeof contactMessageSchema>;

export const prayerRequestSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254).optional(),
  telephone: z.string().trim().max(30).optional(),
  requestText: z.string().trim().min(10).max(5000),
  privacyPreference: z.enum(["confidential", "pastoral_team_only"]).default("confidential"),
  privacyConsent: z.literal(true),
});
export type PrayerRequestInput = z.infer<typeof prayerRequestSchema>;

export const newsletterSubscribeSchema = z.object({
  email: z.string().trim().email().max(254),
  consent: z.literal(true),
});
export type NewsletterSubscribeInput = z.infer<typeof newsletterSubscribeSchema>;

const publicHttpsUrlSchema = z.string().trim().max(2048).refine((value) => {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}, "Use an HTTPS link or a site-relative path.");

const publicExternalUrlSchema = z.string().trim().max(2048).url().refine((value) => {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}, "Use an HTTPS link.");

function hasAccessibleContrastOnWhite(color: string): boolean {
  const channels = color.slice(1).match(/.{2}/g)?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) return false;
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
  return 1.05 / (luminance + 0.05) >= 4.5;
}

const accessibleThemeColorSchema = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/)
  .refine(hasAccessibleContrastOnWhite, "Choose a color with at least 4.5:1 contrast against white.");

export const churchPublicSiteSettingsSchema = z.object({
  branding: z.object({
    primaryColor: accessibleThemeColorSchema.default("#193a31"),
    secondaryColor: accessibleThemeColorSchema.default("#315e50"),
    accentColor: accessibleThemeColorSchema.default("#8b5b29"),
    heroImageUrl: publicHttpsUrlSchema.optional(),
  }).default({
    primaryColor: "#193a31",
    secondaryColor: "#315e50",
    accentColor: "#8b5b29",
  }),
  hero: z.object({
    eyebrow: z.string().trim().max(100).default("WELCOME"),
    title: z.string().trim().max(120).default("A place to belong"),
    highlightedTitle: z.string().trim().max(120).default("and grow in faith"),
    subtitle: z.string().trim().max(500).default("Join us for worship, community, and a life of faith."),
  }).default({
    eyebrow: "WELCOME",
    title: "A place to belong",
    highlightedTitle: "and grow in faith",
    subtitle: "Join us for worship, community, and a life of faith.",
  }),
  serviceTimes: z.array(z.object({
    label: z.string().trim().min(2).max(100),
    day: z.string().trim().min(2).max(40),
    time: z.string().trim().min(2).max(60),
    note: z.string().trim().max(240).optional(),
  })).max(20).default([]),
  locations: z.array(z.object({
    name: z.string().trim().min(2).max(120),
    address: z.string().trim().min(2).max(500),
    mapUrl: publicExternalUrlSchema.optional(),
  })).max(10).default([]),
  visitorInfo: z.object({
    arrival: z.string().trim().max(1000).default(""),
    children: z.string().trim().max(1000).default(""),
    accessibility: z.string().trim().max(1000).default(""),
    parking: z.string().trim().max(1000).default(""),
  }).default({ arrival: "", children: "", accessibility: "", parking: "" }),
  online: z.object({
    liveStreamUrl: publicExternalUrlSchema.optional(),
    description: z.string().trim().max(500).default(""),
  }).default({ description: "" }),
  scripture: z.object({
    verse: z.string().trim().max(1200).default(""),
    reference: z.string().trim().max(120).default(""),
    version: z.string().trim().max(40).default(""),
  }).default({ verse: "", reference: "", version: "" }),
  ministries: z.array(z.object({
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().min(2).max(1000),
    audience: z.string().trim().max(120).optional(),
  })).max(30).default([]),
  galleryImages: z.array(z.object({
    imageUrl: publicHttpsUrlSchema,
    alt: z.string().trim().min(3).max(240),
    caption: z.string().trim().max(400).optional(),
  })).max(60).default([]),
  faqs: z.array(z.object({
    question: z.string().trim().min(4).max(240),
    answer: z.string().trim().min(4).max(1200),
  })).max(30).default([]),
  giving: z.object({
    mpesaPaybill: z.string().trim().max(30).default(""),
    accountName: z.string().trim().max(100).default(""),
    instructions: z.string().trim().max(1000).default(""),
    suggestedAmounts: z.array(z.number().int().min(10).max(250000)).max(8).default([]),
  }).default({ mpesaPaybill: "", accountName: "", instructions: "", suggestedAmounts: [] }),
  coreValues: z.array(z.object({
    title: z.string().trim().min(2).max(100),
    description: z.string().trim().min(2).max(500),
    icon: z.string().trim().max(16).optional(),
  })).max(20).default([]),
  leadership: z.array(z.object({
    name: z.string().trim().min(2).max(160),
    role: z.string().trim().min(2).max(120),
    bio: z.string().trim().max(1200).optional(),
    photoUrl: publicHttpsUrlSchema.optional(),
  })).max(30).default([]),
  statementOfFaith: z.array(z.object({
    topic: z.string().trim().min(2).max(120),
    belief: z.string().trim().min(2).max(1200),
  })).max(30).default([]),
  metadata: z.object({
    title: z.string().trim().max(160).default(""),
    description: z.string().trim().max(320).default(""),
  }).default({ title: "", description: "" }),
});
export type ChurchPublicSiteSettings = z.infer<typeof churchPublicSiteSettingsSchema>;

const optionalSocialUrl = publicExternalUrlSchema.optional().or(z.literal(""));

export const churchSiteSettingsInputSchema = z.object({
  profile: z.object({
    ministryName: z.string().trim().min(2).max(180),
    tagline: z.string().trim().max(500).default(""),
    logoUrl: publicHttpsUrlSchema.optional().or(z.literal("")),
    vision: z.string().trim().max(2000).default(""),
    mission: z.string().trim().max(2000).default(""),
    outreach: z.string().trim().max(2000).default(""),
    contact: z.object({
      address: z.string().trim().max(500).default(""),
      email: z.string().trim().email().max(254).or(z.literal("")).default(""),
      phones: z.array(z.string().trim().min(7).max(30)).max(10).default([]),
    }).default({ address: "", email: "", phones: [] }),
    social: z.object({
      youtube: optionalSocialUrl,
      facebook: optionalSocialUrl,
      instagram: optionalSocialUrl,
      twitter: optionalSocialUrl,
      whatsapp: optionalSocialUrl,
    }).default({}),
  }),
  settings: churchPublicSiteSettingsSchema,
});
export type ChurchSiteSettingsInput = z.infer<typeof churchSiteSettingsInputSchema>;
