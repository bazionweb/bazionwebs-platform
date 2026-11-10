import { z } from "zod";
import { currencySchema } from "./currency.js";

const safeImageUrl = z.string().trim().max(2048).nullable().optional().refine((value) => {
  if (!value) return true;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}, "Use an HTTPS image URL or a site-relative path.");

const productObjectSchema = z.object({
  sku: z.string().trim().min(1).max(80),
  slug: z.string().trim().min(2).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  name: z.string().trim().min(2).max(180),
  description: z.string().trim().max(5000).nullable().optional(),
  category: z.string().trim().min(1).max(80).default("General"),
  imageUrl: safeImageUrl,
  imageAlt: z.string().trim().max(180).nullable().optional(),
  currency: currencySchema.default("KES"),
  priceMinor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  compareAtPriceMinor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  featured: z.boolean().default(false),
  stockTracked: z.boolean().default(true),
  stockOnHand: z.number().int().min(0).max(2_000_000_000).default(0),
  active: z.boolean().default(true),
}).strict();

export const productInputSchema = productObjectSchema.superRefine((value, context) => {
  if (value.compareAtPriceMinor !== undefined && value.compareAtPriceMinor !== null && value.compareAtPriceMinor < value.priceMinor) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["compareAtPriceMinor"], message: "Compare price must be at least the current price." });
  }
  if (value.stockTracked === false && value.stockOnHand !== 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["stockOnHand"], message: "Untracked inventory must use zero stock." });
  }
});

export const productPatchSchema = productObjectSchema.partial().strict().superRefine((value, context) => {
  if (Object.keys(value).length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "At least one product field is required." });
  }
  if (value.priceMinor !== undefined && value.compareAtPriceMinor !== undefined &&
      value.compareAtPriceMinor !== null && value.compareAtPriceMinor < value.priceMinor) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["compareAtPriceMinor"], message: "Compare price must be at least the current price." });
  }
  if (value.stockTracked === false && value.stockOnHand !== undefined && value.stockOnHand !== 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["stockOnHand"], message: "Untracked inventory must use zero stock." });
  }
});

export const productListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(80).optional(),
  currency: currencySchema.optional(),
  sort: z.enum(["featured", "newest", "price_asc", "price_desc"]).default("featured"),
}).strict();

export const storeSettingsInputSchema = z.object({
  storeName: z.string().trim().min(2).max(160),
  tagline: z.string().trim().max(240),
  supportEmail: z.union([z.string().trim().email().max(254), z.literal("")]),
  isHomePage: z.boolean(),
  locale: z.string().trim().min(2).max(16).refine((value) => {
    try { return Intl.getCanonicalLocales(value).length === 1; } catch { return false; }
  }, "Enter a valid BCP 47 locale such as en-KE or en-US."),
  timeZone: z.string().trim().min(1).max(64).refine((value) => {
    try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
  }, "Enter a valid IANA time zone such as Africa/Nairobi or Europe/London."),
  defaultCountryCode: z.string().regex(/^[A-Z]{2}$/),
  defaultCurrency: currencySchema,
  supportedCurrencies: z.array(currencySchema).min(1).max(25),
  shippingRates: z.partialRecord(currencySchema, z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)),
  shippingCountries: z.array(z.string().regex(/^[A-Z]{2}$/)).max(250),
}).strict().superRefine((value, context) => {
  if (!value.supportedCurrencies.includes(value.defaultCurrency)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["defaultCurrency"], message: "Default currency must be enabled for this store." });
  }
  if (new Set(value.supportedCurrencies).size !== value.supportedCurrencies.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["supportedCurrencies"], message: "Choose each currency only once." });
  }
  if (new Set(value.shippingCountries).size !== value.shippingCountries.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["shippingCountries"], message: "Choose each shipping country only once." });
  }
  if (value.shippingCountries.length > 0 && !value.shippingCountries.includes(value.defaultCountryCode)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["defaultCountryCode"], message: "The default delivery country must be enabled for shipping." });
  }
});

export const orderListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  status: z.enum(["pending_payment", "paid", "cancelled", "fulfilled", "refunded"]).optional(),
}).strict();

export const orderStatusInputSchema = z.object({ status: z.literal("fulfilled") }).strict();
