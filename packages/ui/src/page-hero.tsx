import type { CSSProperties, ReactNode } from "react";

const PARTICLE_SHAPES = ["circle", "diamond", "triangle", "sparkle", "ring", "square"] as const;
const PARTICLE_SIZES = [5, 7, 4, 9, 6, 8, 5, 7, 4, 8, 6, 9];
const PARTICLE_DURATIONS = [7.5, 6.5, 9.5, 7, 10.5, 8, 9, 7, 10, 7.5, 11, 8.5];
const PARTICLE_DELAYS = [3, 5.5, 4.5, 1.5, 7.5, 4, 6, 2.5, 6.5, 1, 8.5, 5];

function particlePosition(index: number, seed: number, range: number): number {
  let value = Math.imul(index + seed, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value ^= value >>> 16;
  return (value >>> 0) % range;
}

const HERO_PARTICLES = Array.from({ length: 48 }, (_, index) => ({
  shape: PARTICLE_SHAPES[index % PARTICLE_SHAPES.length],
  size: PARTICLE_SIZES[index % PARTICLE_SIZES.length],
  duration: PARTICLE_DURATIONS[index % PARTICLE_DURATIONS.length],
  delay: PARTICLE_DELAYS[index % PARTICLE_DELAYS.length],
  left: 3 + particlePosition(index, 23, 94),
  top: 6 + particlePosition(index, 71, 88),
}));

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
        {HERO_PARTICLES.map((particle, index) => (
          <span
            key={index}
            className={`ch-hero-particle ch-hero-particle--${particle.shape}`}
            style={{
              "--particle-x": `${particle.left}%`,
              "--particle-y": `${particle.top}%`,
              "--particle-size": `${particle.size}px`,
              "--particle-duration": `${particle.duration}s`,
              "--particle-delay": `-${particle.delay}s`,
            } as CSSProperties}
          />
        ))}
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
