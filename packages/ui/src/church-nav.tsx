"use client";

import { useState } from "react";

export interface NavLinkItem {
  label: string;
  href: string;
}

export interface ChurchNavProps {
  ministryName: string;
  logoUrl?: string;
  currentPath?: string;
  links?: NavLinkItem[];
  giveHref?: string;
  giveLabel?: string;
}

const DEFAULT_LINKS: NavLinkItem[] = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Gallery", href: "/gallery" },
  { label: "Sermons", href: "/sermons" },
  { label: "Events", href: "/events" },
  { label: "Contact", href: "/contact" },
];

export function ChurchNav({
  ministryName,
  logoUrl,
  currentPath = "/",
  links = DEFAULT_LINKS,
  giveHref = "/give",
  giveLabel = "Give to the Mission",
}: ChurchNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="ch-nav-header">
      <div className="ch-container">
        <div className="ch-nav-inner">
          <a href="/" className="ch-nav-brand">
            {logoUrl && <img src={logoUrl} alt={ministryName} className="ch-nav-logo" />}
            <span className="ch-nav-title">{ministryName}</span>
          </a>

          <nav aria-label="Main Navigation">
            <ul className="ch-nav-links">
              {links.map((link) => {
                const isActive =
                  currentPath === link.href ||
                  (link.href !== "/" && currentPath.startsWith(link.href));
                return (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className={`ch-nav-link ${isActive ? "active" : ""}`}
                    >
                      {link.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <a href={giveHref} className="ch-btn ch-btn-accent">
              {giveLabel}
            </a>
            <button
              type="button"
              className="ch-nav-mobile-toggle"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="ch-nav-mobile-menu">
          {links.map((link) => {
            const isActive =
              currentPath === link.href ||
              (link.href !== "/" && currentPath.startsWith(link.href));
            return (
              <a
                key={link.href}
                href={link.href}
                className={`ch-nav-link ${isActive ? "active" : ""}`}
                style={{ fontSize: "16px", padding: "10px 0" }}
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            );
          })}
          <a
            href={giveHref}
            className="ch-btn ch-btn-accent"
            style={{ width: "100%", marginTop: "12px" }}
            onClick={() => setMobileMenuOpen(false)}
          >
            {giveLabel}
          </a>
        </div>
      )}
    </header>
  );
}
