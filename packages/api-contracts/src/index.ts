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
});
export type EventInput = z.infer<typeof eventInputSchema>;

export const eventRegistrationSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254),
  telephone: z.string().trim().min(7).max(30),
});
export type EventRegistrationInput = z.infer<typeof eventRegistrationSchema>;

export const donationInitiateSchema = z.object({
  campaignId: z.string().uuid().optional(),
  amount: z.number().positive().min(10), // in KES or minor units
  currency: currencySchema.default("KES"),
  givingCategory: z.string().trim().min(2).max(80),
  phoneNumber: z.string().trim().min(9).max(20),
  donorName: z.string().trim().max(160).optional(),
  donorEmail: z.string().trim().email().max(254).optional(),
  anonymous: z.boolean().default(false),
});
export type DonationInitiateInput = z.infer<typeof donationInitiateSchema>;

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
});
export type ContactMessageInput = z.infer<typeof contactMessageSchema>;

export const prayerRequestSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254).optional(),
  telephone: z.string().trim().max(30).optional(),
  requestText: z.string().trim().min(10).max(5000),
  privacyPreference: z.enum(["confidential", "pastoral_team_only"]).default("confidential"),
});
export type PrayerRequestInput = z.infer<typeof prayerRequestSchema>;

export const newsletterSubscribeSchema = z.object({
  email: z.string().trim().email().max(254),
});
export type NewsletterSubscribeInput = z.infer<typeof newsletterSubscribeSchema>;
