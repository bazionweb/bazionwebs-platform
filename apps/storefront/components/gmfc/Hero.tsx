"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { ParticlesCanvas } from "./ParticlesCanvas";
import { useMinistrySite } from "../../lib/use-ministry-site";

export function Hero() {
  const site = useMinistrySite();
  const rotatorWords =
    site.hero.rotatorWords && site.hero.rotatorWords.length > 0
      ? site.hero.rotatorWords
      : [site.hero.highlightedTitle || "TO THE NATIONS"];

  const [wordIndex, setWordIndex] = useState(0);
  const [prevWordIndex, setPrevWordIndex] = useState<number | null>(null);

  useEffect(() => {
    if (rotatorWords.length <= 1) return;
    const timer = setInterval(() => {
      setWordIndex((current) => {
        setPrevWordIndex(current);
        return (current + 1) % rotatorWords.length;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [rotatorWords.length]);

  useEffect(() => {
    const statNums = document.querySelectorAll(".gmfci-stat-num");
    if (statNums.length === 0) return;
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const target = entry.target as HTMLElement;
          const finalValue = parseInt(target.getAttribute("data-target") || "0", 10);
          const suffix = target.getAttribute("data-suffix") || "";
          if (Number.isNaN(finalValue)) return;
          let startTimestamp: number | null = null;
          const animate = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / 2000, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 4);
            const currentVal = Math.floor(easeProgress * finalValue);
            target.textContent = currentVal.toLocaleString() + suffix;
            if (progress < 1) requestAnimationFrame(animate);
            else target.textContent = finalValue.toLocaleString() + suffix;
          };
          requestAnimationFrame(animate);
          obs.unobserve(target);
        });
      },
      { threshold: 0.4 },
    );
    statNums.forEach((num) => observer.observe(num));
    return () => observer.disconnect();
  }, [site.statistics.length]);

  useEffect(() => {
    const scrollArrow = document.querySelector(".gmfci-scroll-indicator");
    const handleClick = () => window.scrollTo({ top: window.innerHeight, behavior: "smooth" });
    scrollArrow?.addEventListener("click", handleClick);
    return () => scrollArrow?.removeEventListener("click", handleClick);
  }, []);

  const heroBg = site.branding.heroBgUrl || "/images/hero-bg-optimized.jpg";
  const subtitleParts = site.hero.subtitle.split("—");

  return (
    <div id="gmfci-hero-wrap">
      <div id="gmfci-hero" style={{ marginLeft: 0 }}>
        <img
          src={heroBg}
          alt={`${site.ministryName} — Hero background`}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: 0,
          }}
        />
        <ParticlesCanvas />
        <div className="gmfci-hero-overlay" />
        <div className="gmfci-hero-content">
          <div className="gmfci-hero-tag">{site.hero.eyebrow}</div>
          <h1 className="gmfci-hero-title">
            {site.hero.title}
            <br />
            <span className="gmfci-word-rotator gmfci-highlight">
              {rotatorWords.map((word, idx) => {
                const className =
                  idx === wordIndex
                    ? "gmfci-word active"
                    : idx === prevWordIndex
                      ? "gmfci-word exit"
                      : "gmfci-word";
                return (
                  <span key={`${word}-${idx}`} className={className}>
                    {word}
                  </span>
                );
              })}
            </span>
          </h1>
          <p className="gmfci-hero-sub">
            {subtitleParts.length > 1 ? (
              <>
                {subtitleParts[0].trim()} —<br />
                {subtitleParts.slice(1).join("—").trim()}
              </>
            ) : (
              site.hero.subtitle
            )}
          </p>
          <div className="gmfci-hero-ctas">
            <Link href="/sermons" className="gmfci-btn gmfci-btn-secondary">
              <span className="gmfci-btn-icon">▶</span> Watch Latest Sermon
            </Link>
            <Link href="/give" className="gmfci-btn gmfci-btn-primary">
              <span className="gmfci-btn-icon">♥</span> Give to the Mission
            </Link>
          </div>
        </div>

        <div className="gmfci-scroll-indicator" role="button" tabIndex={0} aria-label="Scroll down">
          <span>Scroll</span>
          <div className="gmfci-scroll-arrow" />
        </div>

        {site.statistics.length > 0 && (
          <div className="gmfci-stats-bar">
            {site.statistics.map((stat, idx) => {
              const numericTarget = typeof stat.value === "number" ? stat.value : parseInt(String(stat.value), 10) || 0;
              return (
                <Fragment key={stat.label}>
                  {idx > 0 && <div className="gmfci-stat-divider" />}
                  <div className="gmfci-stat">
                    <span
                      className="gmfci-stat-num"
                      data-target={numericTarget}
                      data-suffix={stat.suffix ?? ""}
                    >
                      {numericTarget.toLocaleString()}
                      {stat.suffix ?? ""}
                    </span>
                    <span className="gmfci-stat-label">{stat.label}</span>
                  </div>
                </Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Hero;

