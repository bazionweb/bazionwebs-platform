"use client";

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
  onSubscribe?: (email: string) => void;
}

export function ChurchFooter({
  ministryName,
  tagline = "Revive the Nations. Preach the Gospel. Win Souls.",
  description = "A global ministry propagating revival, preaching the gospel of Jesus Christ, and reaching communities through evangelism, prayer, and mission outreach.",
  phoneNumbers = [],
  email,
  address,
  socialLinks = [],
  privacyHref = "/privacy",
  termsHref = "/terms",
  onSubscribe,
}: ChurchFooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="ch-footer">
      <div className="ch-container">
        <div className="ch-footer-grid">
          {/* Col 1: Ministry Info */}
          <div className="ch-footer-col" style={{ gridColumn: "span 2" }}>
            <h4>{ministryName}</h4>
            <p style={{ color: "var(--church-accent)", fontWeight: 600, marginBottom: "12px" }}>
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
              <li><a href="/about">About Our Mission</a></li>
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

            <h4 style={{ marginTop: "24px" }}>Newsletter</h4>
            <p style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "10px" }}>
              Subscribe to receive ministry updates and prayer bulletins.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const input = form.elements.namedItem("email") as HTMLInputElement;
                if (input?.value) {
                  onSubscribe?.(input.value);
                  input.value = "";
                  alert("Thank you for subscribing to our ministry updates!");
                }
              }}
              style={{ display: "flex", gap: "8px" }}
            >
              <input
                type="email"
                name="email"
                required
                placeholder="Your email address"
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--church-radius)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  background: "rgba(255, 255, 255, 0.05)",
                  color: "#ffffff",
                  fontSize: "13px",
                  flexGrow: 1,
                }}
              />
              <button type="submit" className="ch-btn ch-btn-accent" style={{ padding: "10px 16px" }}>
                Join
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
