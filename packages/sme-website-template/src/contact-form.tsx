"use client";

import { useId, useState, type FormEvent } from "react";
import { TextAreaField, TextField } from "@bazion/ui";
import { websiteEnquirySchema, websitePathSchema } from "@bazion/website-contracts";

export interface SmeContactFormProps {
  endpoint?: string;
  privacyNoticeHref?: string;
}

const initialFields = { fullName: "", email: "", telephone: "", subject: "", message: "" };
const DEFAULT_ENQUIRY_ENDPOINT = "/v1/public/site/enquiries";

export function getSmeEnquiryEndpoint(endpoint?: string): string {
  if (!endpoint) return DEFAULT_ENQUIRY_ENDPOINT;
  const parsed = websitePathSchema.safeParse(endpoint);
  return parsed.success ? parsed.data : DEFAULT_ENQUIRY_ENDPOINT;
}

export function SmeContactForm({ endpoint, privacyNoticeHref = "/privacy" }: SmeContactFormProps) {
  const id = useId().replace(/:/g, "");
  const [fields, setFields] = useState(initialFields);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const parsedPrivacyHref = websitePathSchema.safeParse(privacyNoticeHref);
  const safePrivacyHref = parsedPrivacyHref.success ? parsedPrivacyHref.data : "/privacy";
  const safeEnquiryEndpoint = getSmeEnquiryEndpoint(endpoint);

  function updateField(field: keyof typeof initialFields, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
    setSubmissionError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmissionError("");
    const parsed = websiteEnquirySchema.safeParse({ ...fields, privacyConsent, companyWebsite });
    if (!parsed.success) {
      setSubmissionError(parsed.error.issues[0]?.message ?? "Check the details and try again.");
      return;
    }
    if (companyWebsite.trim()) {
      setSubmitted(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(safeEnquiryEndpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = await response.json().catch(() => null) as { success?: unknown; message?: unknown } | null;
      if (!response.ok || result?.success !== true) {
        throw new Error(typeof result?.message === "string" ? result.message : "Your message could not be sent. Please try again.");
      }
      setFields(initialFields);
      setPrivacyConsent(false);
      setSubmitted(true);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "Your message could not be sent. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) return <p className="sme-form-success" role="status" aria-live="polite">Thank you. Your enquiry has been received.</p>;

  return (
    <form className="sme-contact-form" onSubmit={handleSubmit} aria-busy={isSubmitting}>
      <div className="sme-contact-honeypot" aria-hidden="true">
        <label htmlFor={`${id}-company`}>Company website</label>
        <input
          id={`${id}-company`}
          name="companyWebsite"
          autoComplete="off"
          tabIndex={-1}
          value={companyWebsite}
          onChange={(event) => setCompanyWebsite(event.target.value)}
        />
      </div>
      <TextField id={`${id}-name`} label="Your name" name="fullName" required minLength={2} maxLength={160} autoComplete="name" value={fields.fullName} onChange={(event) => updateField("fullName", event.target.value)} />
      <TextField id={`${id}-email`} label="Email address" name="email" type="email" required={!fields.telephone.trim()} maxLength={254} autoComplete="email" value={fields.email} onChange={(event) => updateField("email", event.target.value)} />
      <TextField id={`${id}-telephone`} label="Telephone" name="telephone" type="tel" required={!fields.email.trim()} maxLength={30} autoComplete="tel" value={fields.telephone} onChange={(event) => updateField("telephone", event.target.value)} />
      <TextField id={`${id}-subject`} label="Subject" name="subject" maxLength={200} value={fields.subject} onChange={(event) => updateField("subject", event.target.value)} />
      <TextAreaField id={`${id}-message`} label="How can we help?" name="message" required minLength={10} maxLength={5000} rows={5} value={fields.message} onChange={(event) => updateField("message", event.target.value)} />
      <label className="sme-contact-consent">
        <input type="checkbox" name="privacyConsent" required checked={privacyConsent} onChange={(event) => setPrivacyConsent(event.target.checked)} />
        <span>I agree that the business may use my details to respond to this enquiry. Read the <a href={safePrivacyHref}>privacy notice</a>.</span>
      </label>
      {submissionError && <p className="sme-form-error" role="alert">{submissionError}</p>}
      <button className="sme-action" type="submit" disabled={isSubmitting}>{isSubmitting ? "Sending…" : "Send enquiry"}</button>
    </form>
  );
}
