"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ChurchWhatsAppButton } from "@bazion/ui";
import { getWebsitePageForRoute } from "./site-page-availability";
import { useMinistrySite, useMinistrySiteLoaded } from "./use-ministry-site";

const PUBLIC_MINISTRY_PATHS = new Set([
  "/",
  "/about",
  "/visit",
  "/ministries",
  "/sermons",
  "/events",
  "/gallery",
  "/give",
  "/contact",
  "/privacy",
  "/terms",
]);

export function SiteThemeProvider({ children }: { children: ReactNode }) {
  const site = useMinistrySite();
  const siteLoaded = useMinistrySiteLoaded();
  const pathname = usePathname();
  const isPublicMinistryPage = PUBLIC_MINISTRY_PATHS.has(pathname) || pathname.startsWith("/events/") || pathname.startsWith("/sermons/");
  const routePage = getWebsitePageForRoute(site.pages, pathname);
  const pageIsUnavailable = isPublicMinistryPage && siteLoaded && routePage !== undefined && !routePage.enabled;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--church-primary", site.branding.primaryColor);
    root.style.setProperty("--church-secondary", site.branding.secondaryColor);
    root.style.setProperty("--church-accent", site.branding.accentColor);

    const theme = site.theme ?? {
      preset: "maroon-gold" as const,
      headerStyle: "classic" as const,
      heroStyle: "rotator" as const,
      cardStyle: "rounded" as const,
      fontPairing: "outfit-inter" as const,
    };

    const resolvedGold =
      theme.preset === "maroon-gold" && site.branding.accentColor.toUpperCase() === "#B45E14"
        ? "#D9A857"
        : site.branding.accentColor;

    // Bridge active church branding tokens into .gmfci-* custom properties
    root.style.setProperty("--color-maroon", site.branding.primaryColor);
    root.style.setProperty("--color-maroon-dark", site.branding.primaryColor);
    root.style.setProperty("--color-maroon-light", site.branding.secondaryColor);
    root.style.setProperty("--gmfci-maroon", site.branding.secondaryColor);
    root.style.setProperty("--gmfci-maroon-deep", site.branding.primaryColor);
    root.style.setProperty("--color-gold", resolvedGold);

    root.dataset.churchTheme = theme.preset;
    root.dataset.fontPairing = theme.fontPairing;
    root.dataset.cardStyle = theme.cardStyle;
    root.dataset.headerStyle = theme.headerStyle;
    root.dataset.heroStyle = theme.heroStyle;

    const themeClasses = ["theme-maroon-gold", "theme-forest-bronze", "theme-royal-navy", "theme-living-waters", "theme-sanctuary-charcoal"];
    const fontClasses = ["font-pairing-outfit-inter", "font-pairing-jakarta-inter", "font-pairing-serif-classic"];
    root.classList.remove(...themeClasses, ...fontClasses);
    root.classList.add(`theme-${theme.preset}`, `font-pairing-${theme.fontPairing}`);

    if (theme.preset === "maroon-gold") {
      root.style.setProperty("--church-gold", "#D9A857");
      root.style.setProperty("--church-bg", "#FAF6F0");
    }

    const titles: Record<string, string> = {
      "/": "Home",
      "/about": "About",
      "/visit": "Plan a Visit",
      "/ministries": "Ministries",
      "/sermons": "Sermons",
      "/events": "Events",
      "/gallery": "Gallery",
      "/give": "Giving",
      "/contact": "Contact",
      "/privacy": "Privacy",
      "/terms": "Terms",
    };
    const pageTitle = titles[pathname] ?? (pathname.startsWith("/events/") ? "Event" : pathname.startsWith("/sermons/") ? "Sermon" : "Church & Ministry");
    const siteTitle = site.metadata.title || site.ministryName;
    document.title = pathname === "/" ? siteTitle : `${pageTitle} | ${siteTitle}`;
    const description = site.metadata.description || site.tagline;
    let descriptionTag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!descriptionTag) {
      descriptionTag = document.createElement("meta");
      descriptionTag.name = "description";
      document.head.appendChild(descriptionTag);
    }
    descriptionTag.content = description;
  }, [
    pathname,
    site.branding.primaryColor,
    site.branding.secondaryColor,
    site.branding.accentColor,
    site.metadata.title,
    site.metadata.description,
    site.ministryName,
    site.tagline,
    site.theme,
  ]);

  useEffect(() => {
    if (!pageIsUnavailable) return;
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const created = !robots;
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    const previous = robots.content;
    robots.content = "noindex, nofollow";
    return () => {
      if (created) robots?.remove();
      else if (robots) robots.content = previous;
    };
  }, [pageIsUnavailable]);

  useEffect(() => {
    if (!isPublicMinistryPage || !("IntersectionObserver" in window)) return;
    if (pageIsUnavailable) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const main = document.getElementById("main-content");
    if (!main) return;

    const selector = ".ch-card, .ch-info-card";
    const revealObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("ch-reveal-visible");
          revealObserver.unobserve(entry.target);
        }
      }
    }, { threshold: 0.06, rootMargin: "0px 0px -40px 0px" });

    function observeCard(element: HTMLElement) {
      if (element.classList.contains("ch-reveal")) return;
      element.classList.add("ch-reveal");
      revealObserver.observe(element);
    }

    function scanAddedNode(node: Node) {
      if (!(node instanceof HTMLElement)) return;
      if (node.matches(selector)) observeCard(node);
      node.querySelectorAll<HTMLElement>(selector).forEach(observeCard);
    }

    scanAddedNode(main);
    const contentObserver = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach(scanAddedNode);
      }
    });
    contentObserver.observe(main, { childList: true, subtree: true });

    return () => {
      contentObserver.disconnect();
      revealObserver.disconnect();
      main.querySelectorAll(".ch-reveal").forEach((element) => {
        element.classList.remove("ch-reveal", "ch-reveal-visible");
      });
    };
  }, [pathname, isPublicMinistryPage, pageIsUnavailable]);

  return isPublicMinistryPage
    ? <>{pageIsUnavailable ? <main id="main-content" className="ch-section ch-container" role="status">
      <h1>This page is not available</h1>
      <p>This ministry has not published this page.</p>
      <a href="/" className="ch-btn ch-btn-primary">Return to the home page</a>
    </main> : children}
      {!pageIsUnavailable && <ChurchWhatsAppButton href={site.social.whatsapp} ministryName={site.ministryName} />}
    </>
    : children;
}
