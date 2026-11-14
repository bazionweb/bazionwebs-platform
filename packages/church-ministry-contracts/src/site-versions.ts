import { z } from "zod";
import { churchPublicSiteSettingsSchema } from "./index.js";

export const siteSettingsVersionSummarySchema = z.object({
  id: z.string().uuid(),
  versionNumber: z.number().int(),
  status: z.enum(["draft", "published", "superseded"]),
  createdBy: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  publishedAt: z.string().datetime().nullable().optional(),
  publishedBy: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});
export type SiteSettingsVersionSummary = z.infer<typeof siteSettingsVersionSummarySchema>;

export const siteSettingsRollbackInputSchema = z.object({
  note: z.string().trim().max(250).optional(),
});
export type SiteSettingsRollbackInput = z.infer<typeof siteSettingsRollbackInputSchema>;

export const siteSettingsPublishInputSchema = z.object({
  note: z.string().trim().max(250).optional(),
});
export type SiteSettingsPublishInput = z.infer<typeof siteSettingsPublishInputSchema>;

