import { describe, expect, it } from "vitest";
import {
  DEFAULT_SITE_ENQUIRY_RETENTION_DAYS,
  prepareSiteEnquiry,
  siteEnquiryPolicyInputSchema,
  siteEnquiryRetentionDeadline,
  WEBSITE_ENQUIRY_PRIVACY_NOTICE_VERSION,
} from "./index.js";

const validSubmission = {
  fullName: "  Taylor Njeri  ",
  email: "Taylor@Example.com",
  telephone: "",
  subject: " Website question ",
  message: "Please tell me about your services.",
  privacyConsent: true,
};

describe("site enquiry domain policy", () => {
  it("sets a UTC retention deadline using the bounded tenant policy", () => {
    const submittedAt = new Date("2026-11-11T10:30:00.000Z");

    expect(DEFAULT_SITE_ENQUIRY_RETENTION_DAYS).toBe(180);
    expect(siteEnquiryRetentionDeadline(submittedAt).toISOString()).toBe("2027-05-10T10:30:00.000Z");
    expect(siteEnquiryRetentionDeadline(submittedAt, 30).toISOString()).toBe("2026-12-11T10:30:00.000Z");
    expect(() => siteEnquiryRetentionDeadline(submittedAt, 0)).toThrow(RangeError);
    expect(() => siteEnquiryRetentionDeadline(submittedAt, 3651)).toThrow(RangeError);
    expect(() => siteEnquiryRetentionDeadline(new Date("invalid"))).toThrow(RangeError);
  });

  it("normalizes contact data and assigns consent and retention metadata on the server", () => {
    const submittedAt = new Date("2026-11-11T10:30:00.000Z");
    const result = prepareSiteEnquiry(validSubmission, submittedAt);

    expect(result).toMatchObject({
      kind: "accepted",
      enquiry: {
        formId: "contact",
        fullName: "Taylor Njeri",
        email: "taylor@example.com",
        telephone: null,
        subject: "Website question",
        privacyConsentAt: submittedAt,
        privacyNoticeVersion: WEBSITE_ENQUIRY_PRIVACY_NOTICE_VERSION,
        retentionExpiresAt: new Date("2027-05-10T10:30:00.000Z"),
      },
    });
    if (result.kind === "accepted") expect(result.enquiry).not.toHaveProperty("tenantId");
  });

  it("silently classifies honeypot submissions for success-without-storage handling", () => {
    expect(prepareSiteEnquiry({ ...validSubmission, companyWebsite: "https://bot.example" }).kind).toBe("honeypot");
  });

  it("requires a useful published policy before enabling collection and rejects stale form versions", () => {
    const policy = {
      enabled: true,
      privacyNotice: "We use your contact details only to respond to this request and remove them after the published retention period.",
      privacyNoticeVersion: "2.1.0",
      retentionDays: 120,
    };
    expect(siteEnquiryPolicyInputSchema.safeParse(policy).success).toBe(true);
    expect(siteEnquiryPolicyInputSchema.safeParse({ ...policy, privacyNotice: "Short" }).success).toBe(false);
    expect(siteEnquiryPolicyInputSchema.safeParse({ ...policy, retentionDays: 0 }).success).toBe(false);
    expect(siteEnquiryPolicyInputSchema.safeParse({ ...policy, privacyNoticeVersion: "1".repeat(41) }).success).toBe(false);
    expect(prepareSiteEnquiry(validSubmission, new Date("2026-11-11T10:30:00.000Z"), policy.retentionDays, policy.privacyNoticeVersion).kind)
      .toBe("stale-policy");
    expect(prepareSiteEnquiry({ ...validSubmission, privacyNoticeVersion: "2.1.0" }, new Date("2026-11-11T10:30:00.000Z"), policy.retentionDays, policy.privacyNoticeVersion))
      .toMatchObject({ kind: "accepted", enquiry: { privacyNoticeVersion: "2.1.0", retentionExpiresAt: new Date("2027-03-11T10:30:00.000Z") } });
  });

  it("rejects missing consent and submissions without a reply contact", () => {
    expect(() => prepareSiteEnquiry({ ...validSubmission, privacyConsent: false })).toThrow();
    expect(() => prepareSiteEnquiry({ ...validSubmission, email: "", telephone: "" })).toThrow();
  });
});
