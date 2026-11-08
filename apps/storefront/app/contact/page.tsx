"use client";

import { useState } from "react";
import {
  ChurchNav,
  ChurchFooter,
  PageHero,
} from "@bazion/ui";
import { globalMissionConfig } from "../../../../templates/global-mission.config";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [category, setCategory] = useState("General Enquiry");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const isPrayer = category === "Prayer Request";
      const endpoint = isPrayer ? "/v1/public/church/prayer-requests" : "/v1/public/church/contact";
      const payload = isPrayer
        ? { fullName: name, email, telephone: phone, requestText: message, privacyPreference: "confidential" }
        : { fullName: name, email, telephone: phone, subject, message, category };

      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // Graceful offline fallback
    } finally {
      setIsSubmitting(false);
      setSubmitted(true);
    }
  };

  return (
    <>
      <ChurchNav
        ministryName={globalMissionConfig.ministryName}
        logoUrl={globalMissionConfig.branding.logoUrl}
        currentPath="/contact"
        giveHref="/give"
      />

      <main>
        {/* 1. Page Hero */}
        <PageHero
          eyebrow="COMMUNICATION & PRAYER"
          title="Get in Touch with"
          highlightedTitle="Our Ministry"
          subtitle="Have a question, prayer request, testimony, or want to invite us for a mission? We would love to hear from you."
          bgImageUrl={globalMissionConfig.branding.heroBgUrl}
        />

        {/* 2. Contact Details & Form */}
        <section className="ch-section">
          <div className="ch-container">
            <div className="ch-grid-2" style={{ alignItems: "start" }}>
              {/* Left Column: Verified Information */}
              <div>
                <span className="ch-eyebrow">Direct Contacts</span>
                <h2 className="ch-title">We Are Here to Serve You</h2>
                <p className="ch-subtitle" style={{ marginBottom: "32px" }}>
                  Reach out to our leadership, administrative secretariat, or pastoral team through
                  the verified channels below.
                </p>

                <div style={{ display: "grid", gap: "20px" }}>
                  <div
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
                    {globalMissionConfig.contact.phones.map((phone) => (
                      <div key={phone} style={{ fontSize: "16px", fontWeight: 600, marginTop: "6px" }}>
                        📞 <a href={`tel:${phone}`} style={{ color: "var(--church-primary)", textDecoration: "none" }}>{phone}</a>
                      </div>
                    ))}
                  </div>

                  <div
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
                      ✉️ <a href={`mailto:${globalMissionConfig.contact.email}`} style={{ color: "var(--church-primary)", textDecoration: "none" }}>
                        {globalMissionConfig.contact.email}
                      </a>
                    </div>
                  </div>

                  <div
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
                      📍 {globalMissionConfig.contact.address}
                    </div>
                  </div>

                  {/* Direct WhatsApp Action */}
                  <a
                    href={globalMissionConfig.social.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ch-btn ch-btn-accent"
                    style={{ padding: "16px", fontSize: "16px", justifyContent: "center" }}
                  >
                    Chat With Us on WhatsApp 💬
                  </a>
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
                      Your message / prayer request has been received. Our intercessors and ministry
                      team will pray over it and respond promptly if requested.
                    </p>
                    <button
                      type="button"
                      className="ch-btn ch-btn-outline"
                      style={{ marginTop: "20px" }}
                      onClick={() => setSubmitted(false)}
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

                    <div>
                      <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                        Category *
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: "var(--church-radius)",
                          border: "1px solid var(--church-border)",
                          backgroundColor: "#ffffff",
                          fontSize: "14px",
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

                    <div>
                      <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. John Doe"
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: "var(--church-radius)",
                          border: "1px solid var(--church-border)",
                          fontSize: "14px",
                        }}
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                          Email Address *
                        </label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="e.g. john@example.com"
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: "var(--church-radius)",
                            border: "1px solid var(--church-border)",
                            fontSize: "14px",
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                          Telephone
                        </label>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="e.g. +254 712 345 678"
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: "var(--church-radius)",
                            border: "1px solid var(--church-border)",
                            fontSize: "14px",
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                        Subject *
                      </label>
                      <input
                        type="text"
                        required
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Brief summary of your message..."
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: "var(--church-radius)",
                          border: "1px solid var(--church-border)",
                          fontSize: "14px",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                        {category === "Prayer Request" ? "Your Prayer Request *" : "Message *"}
                      </label>
                      <textarea
                        required
                        rows={5}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={
                          category === "Prayer Request"
                            ? "Please write your prayer need here. Our prayer team will lift you up before God..."
                            : "Write your message here..."
                        }
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: "var(--church-radius)",
                          border: "1px solid var(--church-border)",
                          fontSize: "14px",
                          fontFamily: "inherit",
                        }}
                      />
                    </div>

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
            </div>
          </div>
        </section>
      </main>

      <ChurchFooter
        ministryName={globalMissionConfig.ministryName}
        phoneNumbers={globalMissionConfig.contact.phones}
        email={globalMissionConfig.contact.email}
        address={globalMissionConfig.contact.address}
      />
    </>
  );
}
