import { z } from "zod";

export const WEBSITE_CONFIGURATION_VERSION = "1.0.0" as const;
export const websiteConfigurationVersionSchema = z.literal(WEBSITE_CONFIGURATION_VERSION);

function hasAccessibleContrastOnWhite(color: string): boolean {
  const channels = color.slice(1).match(/.{2}/g)?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) return false;
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
  return 1.05 / (luminance + 0.05) >= 4.5;
}

export const websiteColorSchema = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/)
  .refine(hasAccessibleContrastOnWhite, "Choose a color with at least 4.5:1 contrast against white.");

function isSafeSitePath(value: string): boolean {
  return value.startsWith("/")
    && !value.startsWith("//")
    && !value.includes("\\")
    && !/[\u0000-\u001f\u007f]/.test(value);
}

export const websitePathSchema = z.string().trim().min(1).max(2048)
  .regex(/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/,
    "Use a lowercase site path made from letters, numbers and hyphens.");

export const websiteResourceUrlSchema = z.string().trim().min(1).max(2048).refine((value) => {
  if (isSafeSitePath(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}, "Use an HTTPS URL or a site-relative path.");

export const websiteBrandingSchema = z.object({
  primaryColor: websiteColorSchema.default("#1f2937"),
  secondaryColor: websiteColorSchema.default("#334155"),
  accentColor: websiteColorSchema.default("#854d0e"),
  logoUrl: websiteResourceUrlSchema.optional(),
  heroImageUrl: websiteResourceUrlSchema.optional(),
}).strict();
export type WebsiteBranding = z.infer<typeof websiteBrandingSchema>;

export const websiteSeoSchema = z.object({
  title: z.string().trim().max(160).default(""),
  description: z.string().trim().max(320).default(""),
  openGraphImageUrl: websiteResourceUrlSchema.optional(),
}).strict();
export type WebsiteSeo = z.infer<typeof websiteSeoSchema>;

export const websiteNavigationItemSchema = z.object({
  id: z.string().trim().min(1).max(80).regex(/^[a-z][a-z0-9-]*$/),
  label: z.string().trim().min(1).max(50),
  href: websiteResourceUrlSchema,
}).strict();
export type WebsiteNavigationItem = z.infer<typeof websiteNavigationItemSchema>;

export const websiteNavigationSchema = z.array(websiteNavigationItemSchema).max(12)
  .superRefine((items, context) => {
    const ids = new Set<string>();
    const hrefs = new Set<string>();
    items.forEach((item, index) => {
      if (ids.has(item.id)) context.addIssue({ code: "custom", message: "Navigation item IDs must be unique.", path: [index, "id"] });
      if (hrefs.has(item.href)) context.addIssue({ code: "custom", message: "Navigation destinations must be unique.", path: [index, "href"] });
      ids.add(item.id);
      hrefs.add(item.href);
    });
  });
export type WebsiteNavigation = z.infer<typeof websiteNavigationSchema>;

export const websitePageSectionSchema = z.enum([
  "hero",
  "text",
  "feature-list",
  "card-grid",
  "testimonials",
  "gallery",
  "events",
  "media",
  "contact-form",
  "call-to-action",
  "faq",
]);
export type WebsitePageSection = z.infer<typeof websitePageSectionSchema>;

export const websitePageSchema = z.object({
  id: z.string().trim().min(1).max(80).regex(/^[a-z][a-z0-9-]*$/),
  path: websitePathSchema,
  title: z.string().trim().min(1).max(120),
  enabled: z.boolean().default(true),
  sections: z.array(websitePageSectionSchema).max(12).superRefine((sections, context) => {
    if (new Set(sections).size !== sections.length) {
      context.addIssue({ code: "custom", message: "Page section IDs must be unique." });
    }
  }),
}).strict();
export type WebsitePage = z.infer<typeof websitePageSchema>;

export const websitePagesSchema = z.array(websitePageSchema).max(24)
  .superRefine((pages, context) => {
    const ids = new Set<string>();
    const paths = new Set<string>();
    pages.forEach((page, index) => {
      if (ids.has(page.id)) context.addIssue({ code: "custom", message: "Page IDs must be unique.", path: [index, "id"] });
      if (paths.has(page.path)) context.addIssue({ code: "custom", message: "Page paths must be unique.", path: [index, "path"] });
      if (page.id === "home" && !page.enabled) context.addIssue({ code: "custom", message: "The home page must remain enabled.", path: [index, "enabled"] });
      ids.add(page.id);
      paths.add(page.path);
    });
    if (!pages.some((page) => page.id === "home" && page.path === "/")) {
      context.addIssue({ code: "custom", message: "A website must include its home page at '/'.", path: [] });
    }
  });
export type WebsitePages = z.infer<typeof websitePagesSchema>;

function getNavigationTarget(href: string): { kind: "internal"; path: string } | { kind: "external" } | undefined {
  if (isSafeSitePath(href)) {
    return { kind: "internal", path: new URL(href, "https://website.invalid").pathname };
  }
  try {
    const url = new URL(href);
    if (url.protocol === "https:" && !url.username && !url.password) return { kind: "external" };
  } catch {
    return undefined;
  }
  return undefined;
}

export interface WebsiteNavigationPageIssue {
  index: number;
  message: string;
}

/** Checks that internal navigation points at a page included in the same site configuration. */
export function getWebsiteNavigationPageIssues(
  navigation: readonly WebsiteNavigationItem[],
  pages: readonly WebsitePage[],
): WebsiteNavigationPageIssue[] {
  const configuredPaths = new Set(pages.map((page) => page.path));
  const issues: WebsiteNavigationPageIssue[] = [];
  navigation.forEach((item, index) => {
    const target = getNavigationTarget(item.href);
    if (target?.kind === "internal" && !configuredPaths.has(target.path)) {
      issues.push({ index, message: "Navigation must target a configured page." });
    }
  });
  return issues;
}

/** Removes internal navigation entries whose page is not published for this site. */
export function getPublicWebsiteNavigation(
  navigation: readonly WebsiteNavigationItem[],
  pages: readonly WebsitePage[],
): WebsiteNavigationItem[] {
  const publishedPaths = new Set(pages.filter((page) => page.enabled).map((page) => page.path));
  return navigation.filter((item) => {
    const target = getNavigationTarget(item.href);
    if (!target) return false;
    return target.kind === "external" || publishedPaths.has(target.path);
  });
}

export const defaultWebsiteNavigation: WebsiteNavigation = [
  { id: "home", label: "Home", href: "/" },
  { id: "about", label: "About", href: "/about" },
  { id: "services", label: "Services", href: "/services" },
  { id: "contact", label: "Contact", href: "/contact" },
];

export const defaultWebsitePages: WebsitePages = [
  { id: "home", path: "/", title: "Home", enabled: true, sections: ["hero", "text", "feature-list", "call-to-action"] },
  { id: "about", path: "/about", title: "About", enabled: true, sections: ["hero", "text", "feature-list"] },
  { id: "services", path: "/services", title: "Services", enabled: true, sections: ["hero", "card-grid", "call-to-action"] },
  { id: "contact", path: "/contact", title: "Contact", enabled: true, sections: ["hero", "text", "contact-form"] },
  { id: "privacy", path: "/privacy", title: "Privacy notice", enabled: true, sections: ["text"] },
];

export const websiteConfigurationSchema = z.object({
  schemaVersion: websiteConfigurationVersionSchema.default(WEBSITE_CONFIGURATION_VERSION),
  branding: websiteBrandingSchema.default({
    primaryColor: "#1f2937",
    secondaryColor: "#334155",
    accentColor: "#854d0e",
  }),
  navigation: websiteNavigationSchema.default(defaultWebsiteNavigation),
  seo: websiteSeoSchema.default({ title: "", description: "" }),
  pages: websitePagesSchema.default(defaultWebsitePages),
}).strict().superRefine((configuration, context) => {
  for (const issue of getWebsiteNavigationPageIssues(configuration.navigation, configuration.pages)) {
    context.addIssue({ code: "custom", message: issue.message, path: ["navigation", issue.index, "href"] });
  }
});
export type WebsiteConfiguration = z.infer<typeof websiteConfigurationSchema>;

export const WEBSITE_ENQUIRY_PRIVACY_NOTICE_VERSION = "1.0.0" as const;

/** Public website enquiry payload. Tenant identity and retention policy are assigned by the API. */
export const websiteEnquirySchema = z.object({
  formId: z.string().trim().min(1).max(80).default("contact"),
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254).or(z.literal("")).optional(),
  telephone: z.string().trim().max(30).regex(/^\+?[()\d\s.-]*$/)
    .refine((value) => value.length === 0 || (value.match(/\d/g)?.length ?? 0) >= 7, "Enter a valid telephone number.")
    .optional().default(""),
  subject: z.string().trim().max(200).default(""),
  message: z.string().trim().min(10).max(5000),
  privacyConsent: z.literal(true),
  /** Honeypot. A non-empty value should receive a quiet success response without persistence. */
  companyWebsite: z.string().max(200).optional().default(""),
}).strict().superRefine((enquiry, context) => {
  if (!enquiry.email && !enquiry.telephone) {
    context.addIssue({ code: "custom", message: "Provide an email address or telephone number.", path: ["email"] });
  }
});
export type WebsiteEnquiry = z.infer<typeof websiteEnquirySchema>;
