"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PROGRAMS as FALLBACK_PROGRAMS, PORTAL_URL, API_WORKER_URL } from "../lib/contracts-bridge";

export default function ApplyPage() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    program: "",
  });

  // ── Load institution-specific programs from the tenant-scoped education API.
  //    Fallback to the bundled list so first paint + unit tests work without a network call.
  const [programs, setPrograms] = useState(FALLBACK_PROGRAMS);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_WORKER_URL}/api/public/education/programs`, { cache: 'no-store' });
        if (!res.ok) return;
        const body = await res.json();
        if (!body?.success || !Array.isArray(body.data) || body.data.length === 0) return;
        if (cancelled) return;
        setPrograms(body.data.map(p => ({
          label: p.label ?? p.name,
          level: p.level,
          description: p.description,
          icon: p.icon ?? undefined,
        })));
      } catch { /* silently keep fallback */ }
    })();
    return () => { cancelled = true; };
  }, []);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Client-side validation
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!form.email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!form.program) {
      setError("Please select a program of interest.");
      return;
    }

    setLoading(true);

    // G-1 fix: Do NOT create the account here with a random password.
    // Instead, deep-link the user into the portal's own registration flow
    // with their details pre-filled as query params. The portal's Register
    // page will read these params, pre-populate the form, and prompt for a
    // real password the user chooses themselves.
    const params = new URLSearchParams({
      email: form.email.trim(),
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
      program: form.program,
    });

    window.location.href = `${PORTAL_URL}/register?${params.toString()}`;
  };

  return (
    <main id="main-content" style={{ background: "#f8fafc", minHeight: "100vh", padding: "clamp(6.5rem, 10vw, 9.5rem) clamp(1rem, 4vw, 2rem) 4rem" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "clamp(1.85rem, 5vw, 3rem)", color: "#0f172a", marginBottom: "0.75rem" }}>
            Begin Your Application
          </h1>
          <p style={{ color: "#64748b", fontSize: "clamp(0.95rem, 2vw, 1.1rem)", lineHeight: 1.6 }}>
            We&apos;re thrilled you&apos;re taking this step toward Christ-centered leadership. Complete the form below to get started — you&apos;ll set your password in the next step.
          </p>
        </div>

        <div style={{ background: "#fff", borderRadius: "16px", padding: "clamp(1.5rem, 4vw, 3rem)", boxShadow: "0 10px 40px rgba(0,0,0,0.08)", border: "1px solid rgba(0,0,0,0.05)" }}>
          {error && (
            <div style={{ background: "#fee2e2", color: "#991b1b", padding: "0.75rem 1rem", borderRadius: "8px", marginBottom: "1.5rem", fontSize: "0.9rem", border: "1px solid #fecaca" }} role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }} noValidate>
            <div className="apply-name-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label htmlFor="firstName" style={{ fontSize: "0.9rem", fontWeight: 600, color: "#334155" }}>First Name *</label>
                <input
                  id="firstName"
                  type="text"
                  required
                  value={form.firstName}
                  onChange={(e) => update("firstName", e.target.value)}
                  style={{ padding: "0.8rem 1rem", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none", fontSize: "1rem" }}
                  aria-describedby={error ? "form-error" : undefined}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label htmlFor="lastName" style={{ fontSize: "0.9rem", fontWeight: 600, color: "#334155" }}>Last Name *</label>
                <input
                  id="lastName"
                  type="text"
                  required
                  value={form.lastName}
                  onChange={(e) => update("lastName", e.target.value)}
                  style={{ padding: "0.8rem 1rem", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none", fontSize: "1rem" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label htmlFor="email" style={{ fontSize: "0.9rem", fontWeight: 600, color: "#334155" }}>Email Address *</label>
              <input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                style={{ padding: "0.8rem 1rem", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none", fontSize: "1rem" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label htmlFor="program" style={{ fontSize: "0.9rem", fontWeight: 600, color: "#334155" }}>Program of Interest *</label>
              <select
                id="program"
                required
                value={form.program}
                onChange={(e) => update("program", e.target.value)}
                style={{ padding: "0.8rem 1rem", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none", fontSize: "1rem", background: "#fff" }}
              >
                <option value="">Select a Program</option>
                {[
                  { label: "Diplomas", level: "diploma" },
                  { label: "Bachelor's Degrees", level: "undergraduate" },
                  { label: "Master's Degrees", level: "graduate" },
                  { label: "Doctorate Degrees", level: "doctorate" },
                  { label: "Graduate Certificates", level: "certificate" },
                ].map((group) => {
                  const groupPrograms = programs.filter((p) => (p.level || "").toLowerCase() === group.level.toLowerCase());
                  if (groupPrograms.length === 0) return null;
                  return (
                    <optgroup key={group.level} label={group.label}>
                      {groupPrograms.map((p) => (
                        <option key={p.label} value={p.label}>{p.label}</option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>

            <div id="form-error" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem" }}>
              <button type="submit" className="btn btn-gold" disabled={loading} style={{ padding: "1rem", fontSize: "1.1rem", width: "100%", justifyContent: "center" }}>
                {loading ? "Continuing to portal..." : "Continue to Portal →"}
              </button>
            </div>

            <p style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.85rem", marginTop: "1rem" }}>
              By clicking &quot;Continue to Portal&quot;, you agree to our <Link href="/privacy" style={{ color: "#d4af37", textDecoration: "underline" }}>Privacy Policy</Link>. You will set your password and receive a verification email in the next step.
            </p>
          </form>

          <div style={{ marginTop: "2rem", paddingTop: "1.5rem", borderTop: "1px solid #e2e8f0", textAlign: "center" }}>
            <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
              Already have an account?{" "}
              <a href={`${PORTAL_URL}/login`} style={{ color: "#d4af37", fontWeight: 600 }}>Sign In</a>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
