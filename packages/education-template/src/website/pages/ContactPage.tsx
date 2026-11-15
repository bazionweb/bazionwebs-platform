"use client";

import { useState } from "react";
import PageHero from "../components/PageHero";
import { API_WORKER_URL } from "../lib/contracts-bridge";

const API_URL = process.env.NEXT_PUBLIC_API_URL || API_WORKER_URL;

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const update = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/public/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Something went wrong. Please try again.");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactInfo = [
    {
      icon: "✉️",
      label: "General Inquiries",
      value: "admin@bmiuniversities.org",
      href: "mailto:admin@bmiuniversities.org",
    },
    {
      icon: "🎓",
      label: "Admissions Office",
      value: "admissions@bmiuniversities.org",
      href: "mailto:admissions@bmiuniversities.org",
    },
    {
      icon: "🛡️",
      label: "Registrar & Records",
      value: "registrar@bmiuniversities.org",
      href: "mailto:registrar@bmiuniversities.org",
    },
    {
      icon: "🕐",
      label: "Office Hours",
      value: "Monday – Friday, 9:00 AM – 5:00 PM",
      href: null,
    },
  ];

  return (
    <main id="main-content">
      <PageHero
        image="/images/contact-hero/contact-hero-1-office.jpg"
        eyebrow="Connect With Us"
        title="Contact Us"
        subtitle="We'd love to hear from you. Reach out and our admissions & registrar teams will respond promptly."
      />

      {/* Contact Info + Form */}
      <section style={{ background: "#f8fafc", padding: "6rem 2rem" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "4rem", alignItems: "start" }} className="split-section">

          {/* Left — Contact Details */}
          <div>
            <div className="gold-bar" />
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "clamp(1.8rem, 2.5vw, 2.4rem)", color: "#0f172a", marginBottom: "1rem" }}>
              Get in Touch
            </h2>
            <p style={{ color: "#64748b", fontSize: "1rem", lineHeight: 1.8, marginBottom: "2.5rem" }}>
              Bethel Ministries International University serves a worldwide body of students. Contact our central admissions office or send us a message below.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginBottom: "2.5rem" }}>
              {contactInfo.map((c, i) => (
                <div
                  key={i}
                  style={{
                    background: "#fff",
                    borderRadius: "12px",
                    padding: "1.25rem 1.5rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    border: "1px solid rgba(0,0,0,0.05)",
                  }}
                >
                  <span style={{ fontSize: "1.5rem" }}>{c.icon}</span>
                  <div>
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {c.label}
                    </div>
                    {c.href ? (
                      <a href={c.href} style={{ color: "#0f172a", fontWeight: 600, fontSize: "0.95rem", textDecoration: "none" }}>
                        {c.value}
                      </a>
                    ) : (
                      <div style={{ color: "#0f172a", fontWeight: 600, fontSize: "0.95rem" }}>{c.value}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Contact Form */}
          <div
            style={{
              background: "#fff",
              borderRadius: "20px",
              padding: "3rem",
              boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
              border: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            {submitted ? (
              <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
                <span style={{ fontSize: "3rem", display: "block", marginBottom: "1rem" }}>✓</span>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.6rem", color: "#0f172a", marginBottom: "0.75rem" }}>
                  Message Sent!
                </h3>
                <p style={{ color: "#64748b", fontSize: "1rem", lineHeight: 1.7, maxWidth: "400px", margin: "0 auto" }}>
                  Thank you for reaching out. We will get back to you within 1–2 business days.
                </p>
                <button
                  type="button"
                  onClick={() => { setSubmitted(false); setForm({ name: "", email: "", subject: "", message: "" }); }}
                  className="btn btn-gold"
                  style={{ marginTop: "2rem", fontSize: "0.9rem" }}
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.4rem", color: "#0f172a", marginBottom: "0.5rem" }}>
                  Send a Message
                </h3>
                <p style={{ color: "#64748b", fontSize: "0.92rem", marginBottom: "2rem" }}>
                  Fill out the form below and we will get back to you within 1–2 business days.
                </p>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }} className="form-row">
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      <label htmlFor="name" style={{ fontSize: "0.88rem", fontWeight: 600, color: "#334155" }}>Full Name *</label>
                      <input
                        id="name"
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => update("name", e.target.value)}
                        placeholder="John Doe"
                        style={{ padding: "0.8rem 1rem", borderRadius: "10px", border: "1px solid #cbd5e1", outline: "none", fontSize: "0.95rem" }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      <label htmlFor="email" style={{ fontSize: "0.88rem", fontWeight: 600, color: "#334155" }}>Email Address *</label>
                      <input
                        id="email"
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => update("email", e.target.value)}
                        placeholder="john@example.com"
                        style={{ padding: "0.8rem 1rem", borderRadius: "10px", border: "1px solid #cbd5e1", outline: "none", fontSize: "0.95rem" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    <label htmlFor="subject" style={{ fontSize: "0.88rem", fontWeight: 600, color: "#334155" }}>Subject</label>
                    <input
                      id="subject"
                      type="text"
                      value={form.subject}
                      onChange={(e) => update("subject", e.target.value)}
                      placeholder="e.g. Program Inquiry, Admissions Question"
                      style={{ padding: "0.8rem 1rem", borderRadius: "10px", border: "1px solid #cbd5e1", outline: "none", fontSize: "0.95rem" }}
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    <label htmlFor="message" style={{ fontSize: "0.88rem", fontWeight: 600, color: "#334155" }}>Message *</label>
                    <textarea
                      id="message"
                      required
                      rows={5}
                      value={form.message}
                      onChange={(e) => update("message", e.target.value)}
                      placeholder="How can we help you?"
                      style={{ padding: "0.8rem 1rem", borderRadius: "10px", border: "1px solid #cbd5e1", outline: "none", fontSize: "0.95rem", resize: "vertical" }}
                    />
                  </div>

                  {error && (
                    <div style={{ padding: "0.75rem 1rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", color: "#dc2626", fontSize: "0.88rem" }}>
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn btn-gold"
                    style={{ marginTop: "0.5rem", padding: "0.9rem 2rem", fontSize: "1rem", alignSelf: "flex-start", opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? "not-allowed" : "pointer" }}
                  >
                    {isSubmitting ? "Sending…" : "Send Message →"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 900px) { .split-section { grid-template-columns: 1fr !important; } }
        @media (max-width: 600px) { .form-row { grid-template-columns: 1fr !important; } }
      `}</style>
    </main>
  );
}
