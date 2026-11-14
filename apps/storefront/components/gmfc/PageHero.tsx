"use client";

import Link from "next/link";
import { ParticlesCanvas } from "./ParticlesCanvas";

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  titleHighlight?: string;
  subtitle?: string;
  subtitleSecondLine?: string;
  btn1Text?: string;
  btn1Url?: string;
  btn2Text?: string;
  btn2Url?: string;
}

function HeroButton({
  href,
  label,
  variant,
}: {
  href: string;
  label: string;
  variant: "primary" | "ghost";
}) {
  const className = `gmfci-hero-btn gmfci-hero-btn-${variant}`;
  if (/^https?:\/\//i.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {label}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

export function PageHero({
  eyebrow,
  title,
  titleHighlight,
  subtitle,
  subtitleSecondLine,
  btn1Text,
  btn1Url,
  btn2Text,
  btn2Url,
}: PageHeroProps) {
  return (
    <section className="gmfci-page-hero">
      <ParticlesCanvas />
      <div className="shell">
        {eyebrow && <div className="gmfci-page-eyebrow">{eyebrow}</div>}
        <h1>
          {title}
          {titleHighlight && (
            <>
              <br />
              <span>{titleHighlight}</span>
            </>
          )}
        </h1>
        {subtitle && (
          <p className="gmfci-page-lead">
            {subtitle}
            {subtitleSecondLine && (
              <>
                <br />
                {subtitleSecondLine}
              </>
            )}
          </p>
        )}

        {(btn1Text || btn2Text) && (
          <div className="gmfci-hero-btn-row">
            {btn1Text && btn1Url && <HeroButton href={btn1Url} label={btn1Text} variant="primary" />}
            {btn2Text && btn2Url && <HeroButton href={btn2Url} label={btn2Text} variant="ghost" />}
          </div>
        )}
      </div>
    </section>
  );
}

export default PageHero;

