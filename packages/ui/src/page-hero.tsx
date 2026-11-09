import type { ReactNode } from "react";

export interface PageHeroProps {
  eyebrow?: string;
  title: string;
  highlightedTitle?: string;
  subtitle?: string;
  primaryCtaText?: string;
  primaryCtaHref?: string;
  secondaryCtaText?: string;
  secondaryCtaHref?: string;
  children?: ReactNode;
  bgImageUrl?: string;
}

export function PageHero({
  eyebrow,
  title,
  highlightedTitle,
  subtitle,
  primaryCtaText,
  primaryCtaHref = "#",
  secondaryCtaText,
  secondaryCtaHref = "#",
  children,
  bgImageUrl,
}: PageHeroProps) {
  return (
    <section
      className="ch-hero-wrap"
      style={
        bgImageUrl
          ? {
              backgroundImage: `linear-gradient(rgba(10, 25, 47, 0.85), rgba(10, 25, 47, 0.95)), url(${bgImageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      <div className="ch-hero-particles" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="ch-container">
        <div className="ch-hero-content">
          {eyebrow && <span className="ch-eyebrow">{eyebrow}</span>}
          <h1 className="ch-hero-title">
            {title} {highlightedTitle && <span>{highlightedTitle}</span>}
          </h1>
          {subtitle && <p className="ch-hero-subtitle">{subtitle}</p>}
          {(primaryCtaText || secondaryCtaText) && (
            <div className="ch-hero-actions">
              {primaryCtaText && (
                <a href={primaryCtaHref} className="ch-btn ch-btn-accent">
                  {primaryCtaText}
                </a>
              )}
              {secondaryCtaText && (
                <a href={secondaryCtaHref} className="ch-btn ch-btn-outline-white">
                  {secondaryCtaText}
                </a>
              )}
            </div>
          )}
          {children}
        </div>
      </div>
    </section>
  );
}
