"use client";

import { useEffect, useState } from "react";
import { getPublicWebsiteNavigation, type ChurchPublicSiteSettings } from "@bazion/church-ministry-contracts";
import { globalMissionConfig, type MinistryConfig } from "@bazion/church-ministry-template";
import { getMinistrySiteFallback, neutralMinistrySite } from "./ministry-site-defaults";

interface SiteResponse {
  tenant?: { slug: string; name: string } | null;
  profile?: {
    ministryName?: string | null;
    logoAssetUrl?: string | null;
    description?: string | null;
    vision?: string | null;
    mission?: string | null;
    outreach?: string | null;
    address?: string | null;
    email?: string | null;
    telephoneNumbers?: unknown;
    socialLinks?: unknown;
  } | null;
  leaders?: Array<{ id: string; name: string; position: string; biography?: string | null; photoUrl?: string | null }>;
  siteSettings?: ChurchPublicSiteSettings | null;
}

let siteRequest: Promise<SiteResponse | null> | null = null;

async function loadMinistrySite(): Promise<SiteResponse | null> {
  if (!siteRequest) {
    siteRequest = fetch("/v1/public/church/site", { cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as SiteResponse : null)
      .catch(() => null);
  }
  return siteRequest;
}

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const allowedKeys = new Set(["youtube", "facebook", "instagram", "twitter", "whatsapp"]);
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => {
    if (typeof entry[1] !== "string" || !allowedKeys.has(entry[0])) return false;
    try { return new URL(entry[1]).protocol === "https:"; } catch { return false; }
  }));
}

function safeWhatsAppLink(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["wa.me", "api.whatsapp.com"].includes(url.hostname)
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function phoneToWhatsAppLink(phone: string): string | undefined {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  let internationalNumber = "";

  if (trimmed.startsWith("+")) {
    internationalNumber = digits;
  } else if (digits.startsWith("00")) {
    internationalNumber = digits.slice(2);
  } else if (/^0[17]\d{8}$/.test(digits)) {
    internationalNumber = `254${digits.slice(1)}`;
  } else if (/^[17]\d{8}$/.test(digits)) {
    internationalNumber = `254${digits}`;
  } else if (/^[1-9]\d{10,14}$/.test(digits)) {
    internationalNumber = digits;
  }

  return internationalNumber ? `https://wa.me/${internationalNumber}` : undefined;
}

function safeImageUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try { return new URL(value).protocol === "https:" ? value : undefined; } catch { return undefined; }
}

function safeColor(value: string | undefined, fallback: string): string {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

export function useMinistrySite(): MinistryConfig {
  const [site, setSite] = useState(neutralMinistrySite);
  useEffect(() => {
    let active = true;
    void loadMinistrySite().then((data) => {
      if (!active || !data) return;
      const profile = data.profile;
      const settings = data.siteSettings;
      const isGlobalMission = data.tenant?.slug === globalMissionConfig.tenantSlug;
      const fallback = getMinistrySiteFallback(data.tenant);
      const pages = settings?.pages ?? fallback.pages;
      const phones = Array.isArray(profile?.telephoneNumbers)
        ? profile.telephoneNumbers.filter((phone): phone is string => typeof phone === "string" && phone.trim().length > 0)
        : fallback.contact.phones;
      const social = stringRecord(profile?.socialLinks);
      const whatsapp = safeWhatsAppLink(social.whatsapp)
        ?? safeWhatsAppLink(fallback.social.whatsapp)
        ?? phones.map(phoneToWhatsAppLink).find((link): link is string => Boolean(link));
      const leaders = (data.leaders ?? []).map((leader) => ({
        id: leader.id,
        name: leader.name,
        role: leader.position,
        bio: leader.biography ?? undefined,
        photoUrl: safeImageUrl(leader.photoUrl),
      }));
      setSite({
        ...fallback,
        ministryName: profile?.ministryName?.trim() || fallback.ministryName,
        tagline: profile?.description?.trim() || fallback.tagline,
        branding: {
          ...fallback.branding,
          primaryColor: safeColor(settings?.branding.primaryColor, fallback.branding.primaryColor),
          secondaryColor: safeColor(settings?.branding.secondaryColor, fallback.branding.secondaryColor),
          accentColor: safeColor(settings?.branding.accentColor, fallback.branding.accentColor),
          heroBgUrl: safeImageUrl(settings?.branding.heroImageUrl) || fallback.branding.heroBgUrl,
          logoUrl: safeImageUrl(profile?.logoAssetUrl) || fallback.branding.logoUrl,
        },
        hero: settings?.hero ?? fallback.hero,
        contact: {
          ...fallback.contact,
          phones,
          email: profile?.email?.trim() || fallback.contact.email,
          address: profile?.address?.trim() || fallback.contact.address,
        },
        social: { ...fallback.social, ...social, ...(whatsapp ? { whatsapp } : {}) },
        navigation: getPublicWebsiteNavigation(settings?.navigation ?? fallback.navigation, pages),
        pages,
        giving: settings ? settings.giving : fallback.giving,
        serviceTimes: settings?.serviceTimes ?? fallback.serviceTimes,
        locations: settings?.locations ?? fallback.locations,
        visitorInfo: settings?.visitorInfo ?? fallback.visitorInfo,
        online: settings?.online ?? fallback.online,
        scripture: settings?.scripture ?? fallback.scripture,
        ministries: settings?.ministries ?? fallback.ministries,
        galleryImages: settings?.galleryImages ?? fallback.galleryImages,
        faqs: settings?.faqs ?? fallback.faqs,
        metadata: settings?.metadata ?? fallback.metadata,
        coreValues: settings?.coreValues ?? fallback.coreValues,
        statementOfFaith: settings?.statementOfFaith ?? fallback.statementOfFaith,
        vision: { ...fallback.vision, statement: profile?.vision?.trim() || fallback.vision.statement },
        mission: { ...fallback.mission, statement: profile?.mission?.trim() || fallback.mission.statement },
        outreach: { ...fallback.outreach, statement: profile?.outreach?.trim() || fallback.outreach.statement },
        leadership: settings
          ? settings.leadership.map((leader, index) => ({
              id: `site-${index}-${leader.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
              name: leader.name,
              role: leader.role,
              bio: leader.bio,
              photoUrl: safeImageUrl(leader.photoUrl),
            }))
          : profile || !isGlobalMission ? leaders : fallback.leadership,
      });
    });
    return () => { active = false; };
  }, []);
  return site;
}
