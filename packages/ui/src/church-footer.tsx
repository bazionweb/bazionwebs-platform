"use client";

import { useState, type FormEvent } from "react";

export interface SocialLink {
  platform: "youtube" | "facebook" | "instagram" | "twitter" | "whatsapp";
  url: string;
}

export interface ChurchFooterProps {
  ministryName: string;
  tagline?: string;
  description?: string;
  phoneNumbers?: string[];
  email?: string;
  address?: string;
  socialLinks?: SocialLink[];
  privacyHref?: string;
  termsHref?: string;
  onSubscribe?: (email: string) => void | Promise<void>;
}

export function ChurchFooter({
  ministryName,
  tagline = "Welcome to our ministry.",
  description = "Information, events and resources from this ministry.",
  phoneNumbers = [],
  email,
  address,
  socialLinks = [],
  privacyHref = "/privacy",
  termsHref = "/terms",
  onSubscribe,
}: ChurchFooterProps) {
  const currentYear = new Date().getFullYear();
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const [newsletterBusy, setNewsletterBusy] = useState(false);
  const [newsletterStatus, setNewsletterStatus] = useState("");
  const [newsletterError, setNewsletterError] = useState("");

  async function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNewsletterBusy(true);
    setNewsletterError("");
    setNewsletterStatus("");
    try {
      let message = "Your email preference has been saved for ministry updates.";
      if (onSubscribe) {
        await onSubscribe(newsletterEmail);
      } else {
        const response = await fetch("/v1/public/church/newsletter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: newsletterEmail, consent: true }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || result?.success !== true) {
          throw new Error(typeof result?.message === "string" ? result.message : "Could not save your email preference. Please try again.");
        }
        if (typeof result.message === "string") message = result.message;
      }
      setNewsletterEmail("");
      setNewsletterConsent(false);
      setNewsletterStatus(message);
    } catch (reason) {
      setNewsletterError(reason instanceof Error ? reason.message : "Could not save your email preference. Please try again.");
    } finally {
      setNewsletterBusy(false);
    }
  }

  return (
    <footer className="ch-footer">
      <div className="ch-container">
        <div className="ch-footer-grid">
          {/* Col 1: Ministry Info */}
          <div className="ch-footer-col" style={{ gridColumn: "span 2" }}>
            <h4>{ministryName}</h4>
            <p style={{ color: "#f0c98f", fontWeight: 600, marginBottom: "12px" }}>
              {tagline}
            </p>
            <p style={{ color: "#94a3b8", lineHeight: 1.6, maxWidth: "420px" }}>
              {description}
            </p>
            {socialLinks.length > 0 && (
              <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
                {socialLinks.map((s) => (
                  <a
                    key={s.platform}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ch-btn ch-btn-outline-white"
                    aria-label={`Visit ${s.platform}`}
                    style={{ padding: "6px 12px", fontSize: "12px", textTransform: "capitalize" }}
                  >
                    {s.platform}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Col 2: Quick Links */}
          <div className="ch-footer-col">
            <h4>Quick Links</h4>
            <ul>
              <li><a href="/">Home</a></li>
              <li><a href="/visit">Plan a Visit</a></li>
              <li><a href="/about">About Our Mission</a></li>
              <li><a href="/ministries">Ministries</a></li>
              <li><a href="/sermons">Sermons & Messages</a></li>
              <li><a href="/events">Upcoming Events</a></li>
              <li><a href="/gallery">Ministry Gallery</a></li>
              <li><a href="/give">Give to the Mission</a></li>
              <li><a href="/contact">Get in Touch</a></li>
            </ul>
          </div>

          {/* Col 3: Contact & Newsletter */}
          <div className="ch-footer-col">
            <h4>Contact Info</h4>
            <ul>
              {email && <li>✉️ <a href={`mailto:${email}`}>{email}</a></li>}
              {phoneNumbers.map((phone) => (
                <li key={phone}>📞 <a href={`tel:${phone}`}>{phone}</a></li>
              ))}
              {address && <li>📍 {address}</li>}
            </ul>

            <h4 style={{ marginTop: "24px" }}>Email updates</h4>
            <p style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "10px" }}>
              This form records your opt-in for ministry email updates; the platform does not send newsletters automatically yet. Contact the ministry to ask about current updates or withdraw your opt-in.
            </p>
            <form onSubmit={subscribe} style={{ display: "grid", gap: 10 }}>
              <input
                type="email"
                name="email"
                aria-label="Email address for ministry updates"
                required
                maxLength={254}
                value={newsletterEmail}
                onChange={(event) => setNewsletterEmail(event.target.value)}
                placeholder="Your email address"
                style={{
                  minHeight: 44,
                  padding: "10px 14px",
                  borderRadius: "var(--church-radius)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  background: "rgba(255, 255, 255, 0.05)",
                  color: "#ffffff",
                  fontSize: "13px",
                  width: "100%",
                }}
              />
              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, lineHeight: 1.5, color: "#b8c4bd" }}>
                <input type="checkbox" required checked={newsletterConsent} onChange={(event) => setNewsletterConsent(event.target.checked)} style={{ marginTop: 2, minWidth: 18, minHeight: 18 }} />
                <span>I agree to receive ministry email updates. Read our <a href={privacyHref}>privacy notice</a>.</span>
              </label>
              {newsletterError && <p role="alert" style={{ margin: 0, color: "#ffd4ca", fontSize: 12 }}>{newsletterError}</p>}
              {newsletterStatus && <p role="status" style={{ margin: 0, color: "#d7efe0", fontSize: 12 }}>{newsletterStatus}</p>}
              <button type="submit" disabled={newsletterBusy} className="ch-btn ch-btn-accent" style={{ padding: "10px 16px", justifySelf: "start" }}>
                {newsletterBusy ? "Saving…" : "Join updates"}
              </button>
            </form>
          </div>
        </div>

        <div className="ch-footer-bottom">
          <div>
            © {currentYear} {ministryName}. All rights reserved.
          </div>
          <div style={{ display: "flex", gap: "16px" }}>
            <a href={privacyHref} style={{ color: "inherit", textDecoration: "none" }}>
              Privacy Policy
            </a>
            <a href={termsHref} style={{ color: "inherit", textDecoration: "none" }}>
              Terms of Use
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
