"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ChurchWhatsAppButton } from "@bazion/ui";
import { useMinistrySite } from "./use-ministry-site";

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

export function SiteThemeProvider() {
  const site = useMinistrySite();
  const pathname = usePathname();
  const isPublicMinistryPage = PUBLIC_MINISTRY_PATHS.has(pathname) || pathname.startsWith("/events/") || pathname.startsWith("/sermons/");

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--church-primary", site.branding.primaryColor);
    root.style.setProperty("--church-secondary", site.branding.secondaryColor);
    root.style.setProperty("--church-accent", site.branding.accentColor);
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
  }, [pathname, site.branding.primaryColor, site.branding.secondaryColor, site.branding.accentColor, site.metadata.title, site.metadata.description, site.ministryName, site.tagline]);

  useEffect(() => {
    if (!isPublicMinistryPage || !("IntersectionObserver" in window)) return;
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
  }, [pathname, isPublicMinistryPage]);

  return isPublicMinistryPage
    ? <ChurchWhatsAppButton href={site.social.whatsapp} ministryName={site.ministryName} />
    : null;
}
