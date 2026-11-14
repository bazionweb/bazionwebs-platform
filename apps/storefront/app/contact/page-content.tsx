"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { PageHero } from "../../components/gmfc/PageHero";
import { SiteChrome } from "../../components/gmfc/SiteChrome";
import { getClientTenantHeaders } from "../../lib/client-tenant";
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
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState("");

  const isPrayerRequest = category === "Prayer Request";
  const ministryLabel = site.ministryName || "Global Mission Fellowship Church";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmissionError("");

    if (!privacyConsent) {
      setSubmissionError(
        isPrayerRequest
          ? "Please confirm that you agree to share this prayer request with authorized prayer staff."
          : "Please confirm that you agree to the privacy notice before sending your message.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const endpoint = isPrayerRequest ? "/v1/public/church/prayer-requests" : "/v1/public/church/contact";
      const bodyPayload = isPrayerRequest
        ? {
            fullName: name.trim(),
            email: email.trim() || undefined,
            telephone: phone.trim() || undefined,
            requestText: message.trim(),
            privacyPreference: "confidential" as const,
            privacyConsent: true,
          }
        : {
            fullName: name.trim(),
            email: email.trim(),
            telephone: phone.trim(),
            subject: subject.trim(),
            message: message.trim(),
            category,
            privacyConsent: true,
          };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getClientTenantHeaders() },
        body: JSON.stringify(bodyPayload),
      });

      const payload = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
      if (!res.ok) {
        throw new Error(payload?.error ?? payload?.message ?? "Something went wrong. Please try again.");
      }

      setSubmitted(true);
      setName("");
      setEmail("");
      setPhone("");
      setSubject("");
      setMessage("");
      setPrivacyConsent(false);
    } catch (err) {
      setSubmissionError(err instanceof Error ? err.message : "Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SiteChrome currentPath="/contact">
      <main id="main-content">
        <PageHero
          eyebrow="Connect With Us"
          title="Get in Touch"
          subtitle="We would love to hear from you. Send us a message, a prayer request, or an inquiry."
        />

        <section className="gmfci-contact-wrap">
          <div className="gmfci-contact-inner">
            <div>
              <h2 className="gmfci-contact-heading">Reach Out Anytime</h2>
              <p className="gmfci-contact-intro">
                Whether you have a prayer request, want to learn more about our ministries, or feel called to partner
                with {ministryLabel} in evangelism and church planting, our team is ready to connect with you.
              </p>

              <div className="gmfci-contact-cards">
                {site.contact.phones.length > 0 && (
                  <div className="gmfci-contact-card">
                    <div className="gmfci-contact-card-icon phone">📞</div>
                    <div>
                      <h4>Call Us</h4>
                      <p>
                        {site.contact.phones.map((phoneNumber, idx) => (
                          <span key={phoneNumber}>
                            {idx > 0 && <br />}
                            <a href={`tel:${phoneNumber.replace(/\s+/g, "")}`}>{phoneNumber}</a>
                          </span>
                        ))}
                      </p>
                    </div>
                  </div>
                )}

                {site.contact.email && (
                  <div className="gmfci-contact-card">
                    <div className="gmfci-contact-card-icon email">✉️</div>
                    <div>
                      <h4>Email Us</h4>
                      <p>
                        <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>
                      </p>
                    </div>
                  </div>
                )}

                {site.contact.address && (
                  <div className="gmfci-contact-card">
                    <div className="gmfci-contact-card-icon address">📍</div>
                    <div>
                      <h4>Postal Address</h4>
                      <p>{site.contact.address}</p>
                    </div>
                  </div>
                )}

                {(site.social.facebook || site.social.youtube || site.social.instagram || site.social.whatsapp) && (
                  <div className="gmfci-contact-card">
                    <div className="gmfci-contact-card-icon social">🌐</div>
                    <div>
                      <h4>Follow Us</h4>
                      <div className="gmfci-contact-social">
                        {site.social.facebook && (
                          <a href={site.social.facebook} target="_blank" rel="noopener noreferrer" className="fb" title="Facebook" aria-label="Facebook">
                            f
                          </a>
                        )}
                        {site.social.youtube && (
                          <a href={site.social.youtube} target="_blank" rel="noopener noreferrer" className="yt" title="YouTube" aria-label="YouTube">
                            ▶
                          </a>
                        )}
                        {site.social.instagram && (
                          <a href={site.social.instagram} target="_blank" rel="noopener noreferrer" className="ig" title="Instagram" aria-label="Instagram">
                            📷
                          </a>
                        )}
                        {site.social.whatsapp && (
                          <a href={site.social.whatsapp} target="_blank" rel="noopener noreferrer" className="wa" title="WhatsApp" aria-label="WhatsApp">
                            💬
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {!site.contact.phones.length && !site.contact.email && !site.contact.address && (
                  <p className="gmfci-contact-intro" style={{ marginBottom: 0 }}>
                    Direct contact details have not been published yet. Use the message form and the ministry team will receive your enquiry.
                  </p>
                )}
              </div>
            </div>

            <div className="gmfci-form-wrap">
              <h3>{isPrayerRequest ? "Share a Prayer Request" : "Send Us a Message"}</h3>
              <p className="form-subtitle">
                {isPrayerRequest
                  ? "Your prayer request will be received confidentially by authorized ministry prayer staff."
                  : "Fill out the form below and we will respond as soon as possible."}
              </p>

              {submitted && (
                <div className="gmfci-form-message success" role="status">
                  {isPrayerRequest
                    ? "Thank you! Your confidential prayer request has been received by our ministry prayer team."
                    : "Thank you for reaching out! Your message has been received and our team will respond shortly."}
                </div>
              )}

              {submissionError && (
                <div className="gmfci-form-message error" role="alert">
                  {submissionError}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="gmfci-form-group">
                  <label htmlFor="gmfci-category">Message Type *</label>
                  <select
                    id="gmfci-category"
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      setSubmitted(false);
                      setPrivacyConsent(false);
                      setSubmissionError("");
                    }}
                  >
                    <option value="General Enquiry">General Enquiry</option>
                    <option value="Prayer Request">Prayer Request (Confidential)</option>
                    <option value="Partnership">Ministry Partnership</option>
                    <option value="Event Enquiry">Event / Conference Enquiry</option>
                    <option value="Testimony">Share a Testimony</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="gmfci-form-row">
                  <div className="gmfci-form-group">
                    <label htmlFor="gmfci-name">Full Name *</label>
                    <input
                      type="text"
                      id="gmfci-name"
                      required
                      minLength={2}
                      maxLength={160}
                      placeholder="Your full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="gmfci-form-group">
                    <label htmlFor="gmfci-email">
                      {isPrayerRequest ? "Email Address (optional)" : "Email Address *"}
                    </label>
                    <input
                      type="email"
                      id="gmfci-email"
                      required={!isPrayerRequest}
                      maxLength={254}
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className={isPrayerRequest ? undefined : "gmfci-form-row"}>
                  <div className="gmfci-form-group">
                    <label htmlFor="gmfci-phone">Phone Number</label>
                    <input
                      type="tel"
                      id="gmfci-phone"
                      placeholder="+254 700 000 000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  {!isPrayerRequest && (
                    <div className="gmfci-form-group">
                      <label htmlFor="gmfci-subject">Subject *</label>
                      <input
                        type="text"
                        id="gmfci-subject"
                        required
                        minLength={2}
                        maxLength={200}
                        placeholder="How can we help?"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                <div className="gmfci-form-group">
                  <label htmlFor="gmfci-message">{isPrayerRequest ? "Your Prayer Request *" : "Your Message *"}</label>
                  <textarea
                    id="gmfci-message"
                    required
                    minLength={10}
                    maxLength={5000}
                    placeholder={
                      isPrayerRequest
                        ? "Share your prayer need here. Our prayer team will stand with you..."
                        : "Write your message or prayer request here..."
                    }
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    fontSize: "0.875rem",
                    lineHeight: 1.55,
                    color: "#4B5563",
                    marginBottom: 20,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    required
                    checked={privacyConsent}
                    onChange={(e) => setPrivacyConsent(e.target.checked)}
                    style={{ marginTop: 3, width: 18, minWidth: 18, height: 18 }}
                  />
                  <span>
                    {isPrayerRequest
                      ? "I agree to share this prayer request confidentially with authorized ministry prayer staff. "
                      : "I agree that the ministry may use these details to respond to my enquiry. "}
                    <Link href="/privacy" style={{ color: "#6B1A18", fontWeight: 600 }}>
                      Read the privacy notice
                    </Link>
                    .
                  </span>
                </label>

                <button type="submit" className="gmfci-form-submit" disabled={isSubmitting}>
                  {isSubmitting ? "Sending..." : isPrayerRequest ? "Send Prayer Request" : "Send Message →"}
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>
    </SiteChrome>
  );
}
