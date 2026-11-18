import { z } from "zod";
import {
  WEBSITE_ENQUIRY_PRIVACY_NOTICE_VERSION,
  websiteEnquirySchema,
  type WebsiteEnquiry,
} from "@bazion/website-contracts";

export const DEFAULT_SITE_ENQUIRY_RETENTION_DAYS = 180;
export { WEBSITE_ENQUIRY_PRIVACY_NOTICE_VERSION, websiteEnquirySchema };
export type { WebsiteEnquiry };

export const siteEnquiryStatusSchema = z.enum(["new", "in_progress", "responded", "archived"]);
export type SiteEnquiryStatus = z.infer<typeof siteEnquiryStatusSchema>;

export const siteEnquiryUpdateSchema = z.object({
  status: siteEnquiryStatusSchema.optional(),
  assignedTo: z.string().trim().max(128).nullable().optional(),
}).strict().refine((value) => value.status !== undefined || value.assignedTo !== undefined, {
  message: "Provide a status or assignee update.",
});
export type SiteEnquiryUpdateInput = z.infer<typeof siteEnquiryUpdateSchema>;

export const siteEnquiryPolicyInputSchema = z.object({
  enabled: z.boolean(),
  privacyNotice: z.string().trim().max(10000).default(""),
  privacyNoticeVersion: z.string().max(40).regex(/^\d+\.\d+\.\d+$/),
  retentionDays: z.number().int().min(1).max(3650),
  routingEmail: z.union([z.string().trim().email().max(254), z.literal(""), z.null()]).optional(),
}).strict().superRefine((policy, context) => {
  if (policy.enabled && policy.privacyNotice.length < 40) {
    context.addIssue({ code: "custom", message: "Publish a privacy notice of at least 40 characters before enabling enquiries.", path: ["privacyNotice"] });
  }
});
export type SiteEnquiryPolicyInput = z.infer<typeof siteEnquiryPolicyInputSchema>;

export interface PreparedSiteEnquiry {
  formId: string;
  fullName: string;
  email: string | null;
  telephone: string | null;
  subject: string | null;
  message: string;
  privacyConsentAt: Date;
  privacyNoticeVersion: string;
  retentionExpiresAt: Date;
}

export type PreparedSiteEnquiryResult =
  | { kind: "honeypot" }
  | { kind: "stale-policy" }
  | { kind: "accepted"; enquiry: PreparedSiteEnquiry };

export function siteEnquiryRetentionDeadline(
  submittedAt: Date,
  retentionDays = DEFAULT_SITE_ENQUIRY_RETENTION_DAYS,
): Date {
  if (!Number.isFinite(submittedAt.getTime())) throw new RangeError("A valid enquiry submission time is required.");
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) {
    throw new RangeError("Enquiry retention must be between 1 and 3650 whole days.");
  }
  const deadline = new Date(submittedAt);
  deadline.setUTCDate(deadline.getUTCDate() + retentionDays);
  return deadline;
}

/** Validate and prepare only server-owned consent and retention metadata. */
export function prepareSiteEnquiry(
  payload: unknown,
  submittedAt = new Date(),
  retentionDays = DEFAULT_SITE_ENQUIRY_RETENTION_DAYS,
  privacyNoticeVersion: string = WEBSITE_ENQUIRY_PRIVACY_NOTICE_VERSION,
): PreparedSiteEnquiryResult {
  const parsed = websiteEnquirySchema.parse(payload);
  if (parsed.companyWebsite.trim()) return { kind: "honeypot" };
  if (parsed.privacyNoticeVersion !== privacyNoticeVersion) return { kind: "stale-policy" };

  return {
    kind: "accepted",
    enquiry: {
      formId: parsed.formId,
      fullName: parsed.fullName,
      email: parsed.email?.toLowerCase() || null,
      telephone: parsed.telephone.trim() || null,
      subject: parsed.subject || null,
      message: parsed.message,
      privacyConsentAt: submittedAt,
      privacyNoticeVersion,
      retentionExpiresAt: siteEnquiryRetentionDeadline(submittedAt, retentionDays),
    },
  };
}
