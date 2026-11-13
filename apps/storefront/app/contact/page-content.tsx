"use client";

import { useState } from "react";
import {
  ChurchNav,
  ChurchFooter,
  PageHero,
  Container,
  Section,
  Grid,
  SelectField,
  TextAreaField,
  TextField,
} from "@bazion/ui";
import { useMinistrySite } from "../../lib/use-ministry-site";

export default function ContactPage() {
  const site = useMinistrySite();
  const [submitted, setSubmitted] = useState(false);
  const [category, setCategory] = useState("General Enquiry");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [submissionError, setSubmissionError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionError("");
    setIsSubmitting(true);
    try {
      const isPrayer = category === "Prayer Request";
      const endpoint = isPrayer ? "/v1/public/church/prayer-requests" : "/v1/public/church/contact";
      const payload = isPrayer
        ? { fullName: name, email: email.trim() || undefined, telephone: phone.trim() || undefined, requestText: message, privacyPreference: "confidential", privacyConsent: true }
        : { fullName: name, email, telephone: phone, subject, message, category, privacyConsent: true };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true) {
        throw new Error(typeof result?.message === "string" ? result.message : "Your message could not be submitted. Please try again.");
      }
      setSubmitted(true);
    } catch (reason) {
      setSubmissionError(reason instanceof Error ? reason.message : "Your message could not be submitted. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <ChurchNav
        ministryName={site.ministryName}
        logoUrl={site.branding.logoUrl}
        links={site.navigation}
        currentPath="/contact"
        giveHref={site.pages.some((page) => page.id === "giving" && page.enabled) ? "/give" : null}
      />

      <main id="main-content">
        {/* 1. Page Hero */}
        <PageHero
          eyebrow="COMMUNICATION & PRAYER"
          title="Get in Touch with"
          highlightedTitle="Our Ministry"
          subtitle="Have a question, prayer request, testimony, or want to invite us for a mission? We would love to hear from you."
          bgImageUrl={site.branding.heroBgUrl}
        />

        {/* 2. Contact Details & Form */}
        <Section>
          <Container>
            <Grid columns="two" style={{ alignItems: "start", gap: "32px" }}>
              {/* Left Column: Verified Information */}
              <div>
                <span className="ch-eyebrow">Direct Contacts</span>
                <h2 className="ch-title">We Are Here to Serve You</h2>
                <p className="ch-subtitle" style={{ marginBottom: "32px" }}>
                  Reach out to our leadership, administrative secretariat, or pastoral team through
                  the verified channels below.
                </p>

                <div style={{ display: "grid", gap: "20px" }}>
                  {site.contact.phones.length > 0 && <div
                    style={{
                      background: "var(--church-bg-alt)",
                      padding: "20px",
                      borderRadius: "var(--church-radius)",
                      border: "1px solid var(--church-border)",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--church-accent)", textTransform: "uppercase" }}>
                      Telephone & Hotlines
                    </div>
                    {site.contact.phones.map((phone) => (
                      <div key={phone} style={{ fontSize: "16px", fontWeight: 600, marginTop: "6px" }}>
                        📞 <a href={`tel:${phone}`} style={{ color: "var(--church-primary)", textDecoration: "none" }}>{phone}</a>
                      </div>
                    ))}
                  </div>}

                  {site.contact.email && <div
                    style={{
                      background: "var(--church-bg-alt)",
                      padding: "20px",
                      borderRadius: "var(--church-radius)",
                      border: "1px solid var(--church-border)",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--church-accent)", textTransform: "uppercase" }}>
                      Email Address
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: 600, marginTop: "6px" }}>
                      ✉️ <a href={`mailto:${site.contact.email}`} style={{ color: "var(--church-primary)", textDecoration: "none" }}>
                        {site.contact.email}
                      </a>
                    </div>
                  </div>}

                  {site.contact.address && <div
                    style={{
                      background: "var(--church-bg-alt)",
                      padding: "20px",
                      borderRadius: "var(--church-radius)",
                      border: "1px solid var(--church-border)",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--church-accent)", textTransform: "uppercase" }}>
                      Postal & Physical Address
                    </div>
                    <div style={{ fontSize: "15px", color: "var(--church-text)", marginTop: "6px" }}>
                      📍 {site.contact.address}
                    </div>
                  </div>}

                  {/* Direct WhatsApp Action */}
                  {site.social.whatsapp && <a
                    href={site.social.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ch-btn ch-btn-accent"
                    style={{ padding: "16px", fontSize: "16px", justifyContent: "center" }}
                  >
                    Chat With Us on WhatsApp 💬
                  </a>}
                  {!site.contact.phones.length && !site.contact.email && !site.contact.address && !site.social.whatsapp && <p>Direct contact details have not been published yet. Use the message form and the ministry team will receive your enquiry.</p>}
                </div>
              </div>

              {/* Right Column: Contact & Prayer Request Form */}
              <div
                style={{
                  background: "#ffffff",
                  padding: "36px",
                  borderRadius: "var(--church-radius-lg)",
                  border: "1px solid var(--church-border)",
                  boxShadow: "var(--church-shadow)",
                }}
              >
                {submitted ? (
                  <div style={{ textAlign: "center", padding: "40px 0" }}>
                    <div style={{ fontSize: "52px", marginBottom: "16px" }}>🕊️</div>
                    <h3 style={{ fontSize: "22px", color: "var(--church-primary)", marginBottom: "8px" }}>
                      Thank You!
                    </h3>
                    <p style={{ fontSize: "15px", color: "var(--church-text-muted)", lineHeight: 1.6 }}>
                      {category === "Prayer Request"
                        ? "Your request has been received and will be available to authorized ministry prayer staff."
                        : "Your message has been received by the ministry team."}
                    </p>
                    <button
                      type="button"
                      className="ch-btn ch-btn-outline"
                      style={{ marginTop: "20px" }}
                      onClick={() => { setSubmitted(false); setPrivacyConsent(false); }}
                    >
                      Send Another Message
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={handleSubmit}
                    style={{ display: "grid", gap: "16px" }}
                  >
                    <span className="ch-eyebrow">Send a Message</span>
                    <h3 style={{ fontSize: "22px", margin: "4px 0 12px 0", color: "var(--church-primary)" }}>
                      How Can We Help or Pray With You?
                    </h3>

                    <SelectField
                      id="contact-category"
                      label="Category"
                      required
                      value={category}
                      onChange={(e) => { setCategory(e.target.value); setPrivacyConsent(false); setSubmissionError(""); }}
                    >
                        <option value="General Enquiry">General Enquiry</option>
                        <option value="Prayer Request">Prayer Request (Confidential)</option>
                        <option value="Partnership">Ministry Partnership</option>
                        <option value="Event Enquiry">Event / Conference Enquiry</option>
                        <option value="Testimony">Share a Testimony</option>
                        <option value="Other">Other</option>
                    </SelectField>

                    {submissionError && <p className="ch-form-error" role="alert">{submissionError}</p>}

                    <TextField
                      id="contact-name"
                      label="Full Name"
                      type="text"
                      required
                      minLength={2}
                      maxLength={160}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. John Doe"
                    />

                    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, lineHeight: 1.6 }}>
                      <input type="checkbox" required checked={privacyConsent} onChange={(event) => setPrivacyConsent(event.target.checked)} style={{ marginTop: 3, minWidth: 18, minHeight: 18 }} />
                      <span>{category === "Prayer Request"
                        ? "I agree to share this prayer request with authorized ministry prayer staff."
                        : "I agree that the ministry may use these details to respond to my enquiry."} Read the <a href="/privacy">privacy notice</a>.</span>
                    </label>

                    <Grid columns="two" style={{ gap: "12px" }}>
                      <TextField
                        id="contact-email"
                        label={category === "Prayer Request" ? "Email Address (optional)" : "Email Address"}
                        type="email"
                        required={category !== "Prayer Request"}
                        maxLength={254}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. john@example.com"
                      />
                      <TextField
                        id="contact-phone"
                        label="Telephone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. +254 712 345 678"
                      />
                    </Grid>

                    {category !== "Prayer Request" && <TextField
                      id="contact-subject"
                      label="Subject"
                      type="text"
                      required
                      minLength={2}
                      maxLength={200}
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Brief summary of your message..."
                    />}

                    <TextAreaField
                      id="contact-message"
                      label={category === "Prayer Request" ? "Your Prayer Request" : "Message"}
                      required
                      minLength={10}
                      maxLength={5000}
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={category === "Prayer Request"
                        ? "Please write your prayer need here. Our prayer team will lift you up before God..."
                        : "Write your message here..."}
                    />

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="ch-btn ch-btn-primary"
                      style={{ marginTop: "6px" }}
                    >
                      {isSubmitting ? "Sending..." : "Send Message"}
                    </button>
                  </form>
                )}
              </div>
            </Grid>
          </Container>
        </Section>
      </main>

      <ChurchFooter
        ministryName={site.ministryName}
        tagline={site.tagline}
        phoneNumbers={site.contact.phones}
        email={site.contact.email}
        address={site.contact.address}
      />
    </>
  );
}
