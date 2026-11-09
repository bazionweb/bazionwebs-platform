"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useMinistrySite } from "./use-ministry-site";

export function SiteThemeProvider() {
  const site = useMinistrySite();
  const pathname = usePathname();

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

  return null;
}
