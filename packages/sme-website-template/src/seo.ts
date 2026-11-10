import { isSmeWebsitePageEnabled, type SmeWebsiteTemplateConfig } from "./config.js";

export interface SmePageMetadata {
  title: string;
  description: string;
  openGraphImageUrl?: string;
  noindex: boolean;
}

/** Resolves page metadata from the tenant's current website and business configuration. */
export function getSmePageMetadata(config: SmeWebsiteTemplateConfig, pageId: string): SmePageMetadata {
  const page = config.website.pages.find((candidate) => candidate.id === pageId);
  const privacyNoticeIsMissing = pageId === "privacy" && !config.business.privacyNotice.trim();
  if (!page || !isSmeWebsitePageEnabled(config, pageId) || privacyNoticeIsMissing) {
    return { title: "Page not available", description: "", noindex: true };
  }

  const siteTitle = config.website.seo.title || config.business.name;
  return {
    title: page.id === "home" ? siteTitle : `${page.title} | ${siteTitle}`,
    description: config.website.seo.description || config.business.introduction,
    ...(config.website.seo.openGraphImageUrl ? { openGraphImageUrl: config.website.seo.openGraphImageUrl } : {}),
    noindex: false,
  };
}
