import { z } from "zod";
import {
  WEBSITE_CONFIGURATION_VERSION,
  websiteConfigurationSchema,
} from "@bazion/website-contracts";

export const SME_WEBSITE_TEMPLATE_VERSION = "1.0.0" as const;

export const smeBusinessServiceSchema = z.object({
  id: z.string().trim().min(1).max(80).regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(10).max(600),
}).strict();

export const smeBusinessContentSchema = z.object({
  name: z.string().trim().min(2).max(160),
  tagline: z.string().trim().max(180).default(""),
  introduction: z.string().trim().min(10).max(1200),
  about: z.string().trim().min(20).max(6000),
  services: z.array(smeBusinessServiceSchema).min(1).max(12),
  contact: z.object({
    email: z.string().trim().email().max(254).optional(),
    telephone: z.string().trim().max(30).optional(),
    address: z.string().trim().max(500).optional(),
  }).strict(),
  privacyNotice: z.string().trim().max(10000).default(""),
}).strict();

export const smeWebsiteTemplateConfigSchema = z.object({
  schemaVersion: z.literal(SME_WEBSITE_TEMPLATE_VERSION).default(SME_WEBSITE_TEMPLATE_VERSION),
  website: websiteConfigurationSchema.default(websiteConfigurationSchema.parse({})),
  business: smeBusinessContentSchema,
}).strict();

export type SmeBusinessService = z.infer<typeof smeBusinessServiceSchema>;
export type SmeBusinessContent = z.infer<typeof smeBusinessContentSchema>;
export type SmeWebsiteTemplateConfig = z.infer<typeof smeWebsiteTemplateConfigSchema>;

export function isSmeWebsitePageEnabled(config: SmeWebsiteTemplateConfig, pageId: string): boolean {
  return config.website.pages.some((page) => page.id === pageId && page.enabled);
}

/** Demo-safe defaults only. Customer identity and contact data are provided per site. */
export const defaultSmeWebsiteTemplateConfig = smeWebsiteTemplateConfigSchema.parse({
  schemaVersion: WEBSITE_CONFIGURATION_VERSION,
  website: {},
  business: {
    name: "Your Business",
    tagline: "Trusted services for your community",
    introduction: "Tell visitors what your business does, who you help, and what makes your service dependable.",
    about: "Share your business story, experience, values, and the people who make your service possible.",
    services: [
      { id: "service-one", name: "Service One", description: "Describe the practical value this service gives to your customers." },
      { id: "service-two", name: "Service Two", description: "Explain what customers can expect and how you deliver it." },
      { id: "service-three", name: "Service Three", description: "Add another service or remove this example when configuring the site." },
    ],
    contact: {},
    privacyNotice: "",
  },
});
