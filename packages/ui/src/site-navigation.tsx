"use client";

import { useId, useRef, useState } from "react";

export interface SiteNavigationLink {
  id?: string;
  label: string;
  href: string;
}

export interface SiteNavigationAction {
  label: string;
  href: string;
}

export interface SiteNavigationProps {
  brandName: string;
  logoUrl?: string;
  brandHref?: string;
  currentPath?: string;
  links: readonly SiteNavigationLink[];
  primaryAction?: SiteNavigationAction | null;
  navigationLabel?: string;
  skipLinkLabel?: string;
  mainContentId?: string;
}

/** Limits navigation destinations to same-site paths and credential-free HTTPS URLs. */
export function isSafeSiteNavigationHref(href: string): boolean {
  if (!href || href.trim() !== href || /[\\\u0000-\u001f\u007f]/.test(href)) return false;
  if (href.startsWith("/")) return !href.startsWith("//");
  try {
    const url = new URL(href);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Marks direct and nested internal routes active without matching similar path prefixes. */
export function isSiteNavigationLinkActive(href: string, currentPath: string): boolean {
  if (!isSafeSiteNavigationHref(href) || !href.startsWith("/")) return false;
  const linkPath = normalizePath(href);
  const activePath = normalizePath(currentPath);
  return activePath === linkPath || (linkPath !== "/" && activePath.startsWith(`${linkPath}/`));
}

export function isSiteNavigationLinkCurrent(href: string, currentPath: string): boolean {
  return isSafeSiteNavigationHref(href) && href.startsWith("/") && normalizePath(href) === normalizePath(currentPath);
}

function normalizePath(value: string): string {
  return value.split(/[?#]/, 1)[0]?.replace(/\/+$/, "") || "/";
}

export function SiteNavigation({
  brandName,
  logoUrl,
  brandHref = "/",
  currentPath = "/",
  links,
  primaryAction,
  navigationLabel = "Main navigation",
  skipLinkLabel = "Skip to main content",
  mainContentId = "main-content",
}: SiteNavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const reactId = useId();
  const mobileNavigationId = `bw-mobile-navigation-${reactId.replace(/:/g, "")}`;
  const safeLinks = links.filter((link) => link.label.trim().length > 0 && isSafeSiteNavigationHref(link.href));
  const safeBrandHref = isSafeSiteNavigationHref(brandHref) ? brandHref : "/";
  const safeAction = primaryAction && primaryAction.label.trim() && isSafeSiteNavigationHref(primaryAction.href) ? primaryAction : null;
  const safeLogoUrl = logoUrl && isSafeSiteNavigationHref(logoUrl) ? logoUrl : undefined;

  return (
    <header
      className="bw-site-nav"
      onKeyDown={(event) => {
        if (event.key === "Escape" && mobileMenuOpen) {
          setMobileMenuOpen(false);
          mobileToggleRef.current?.focus();
        }
      }}
    >
      <a href={`#${mainContentId}`} className="bw-site-nav-skip">{skipLinkLabel}</a>
      <div className="bw-container">
        <div className="bw-site-nav-inner">
          <a href={safeBrandHref} className="bw-site-nav-brand">
            {safeLogoUrl && <img src={safeLogoUrl} alt="" aria-hidden="true" className="bw-site-nav-logo" />}
            <span className="bw-site-nav-title">{brandName}</span>
          </a>

          <nav aria-label={navigationLabel}>
            <ul className="bw-site-nav-links">
              {safeLinks.map((link, index) => {
                const isActive = isSiteNavigationLinkActive(link.href, currentPath);
                return (
                  <li key={`${link.id ?? link.href}-${index}`}>
                    <a
                      href={link.href}
                      className={`bw-site-nav-link ${isActive ? "active" : ""}`}
                      aria-current={isSiteNavigationLinkCurrent(link.href, currentPath) ? "page" : undefined}
                    >
                      {link.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="bw-site-nav-actions">
            {safeAction && <a href={safeAction.href} className="bw-site-nav-action bw-site-nav-action--desktop">{safeAction.label}</a>}
            <button
              ref={mobileToggleRef}
              type="button"
              className="bw-site-nav-toggle"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls={mobileNavigationId}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>
      </div>

      <nav
        className="bw-site-nav-mobile"
        id={mobileNavigationId}
        aria-label={`${navigationLabel} mobile`}
        hidden={!mobileMenuOpen}
      >
        {safeLinks.map((link, index) => {
          const isActive = isSiteNavigationLinkActive(link.href, currentPath);
          return (
            <a
              key={`${link.id ?? link.href}-${index}`}
              href={link.href}
              className={`bw-site-nav-link ${isActive ? "active" : ""}`}
              aria-current={isSiteNavigationLinkCurrent(link.href, currentPath) ? "page" : undefined}
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </a>
          );
        })}
        {safeAction && <a
          href={safeAction.href}
          className="bw-site-nav-action bw-site-nav-action--mobile"
          onClick={() => setMobileMenuOpen(false)}
        >{safeAction.label}</a>}
      </nav>
    </header>
  );
}
