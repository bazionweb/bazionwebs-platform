import type { MinistryConfig } from "../../../templates/church.types";
import { globalMissionConfig } from "../../../templates/global-mission.config";

/** Neutral defaults for a ministry tenant that has not configured its public site yet. */
export const neutralMinistrySite: MinistryConfig = {
  tenantSlug: "unknown",
  ministryName: "Ministry",
  tagline: "Welcome to our ministry.",
  branding: {
    logoUrl: "",
    primaryColor: "#1f2937",
    secondaryColor: "#475569",
    accentColor: "#c99a43",
  },
  hero: {
    eyebrow: "WELCOME",
    title: "A place to",
    highlightedTitle: "belong",
    subtitle: "Discover a community grounded in worship, faith, and service.",
  },
  contact: { phones: [], email: "", address: "" },
  social: {},
  statistics: [],
  giving: { mpesaPaybill: "", accountName: "", instructions: "", suggestedAmounts: [] },
  serviceTimes: [],
  locations: [],
  visitorInfo: { arrival: "", children: "", accessibility: "", parking: "" },
  online: { description: "" },
  scripture: { verse: "", reference: "", version: "" },
  ministries: [],
  galleryImages: [],
  faqs: [],
  metadata: { title: "Ministry", description: "Welcome to the ministry." },
  vision: { title: "Our Vision", statement: "" },
  mission: { title: "Our Mission", statement: "" },
  outreach: { title: "Community Outreach", statement: "" },
  coreValues: [],
  statementOfFaith: [],
  leadership: [],
};

export function createNeutralMinistrySite(
  tenant?: { slug?: string | null; name?: string | null } | null,
): MinistryConfig {
  return {
    ...neutralMinistrySite,
    tenantSlug: tenant?.slug || "tenant",
    ministryName: tenant?.name?.trim() || "Ministry",
  };
}

/** A tenant slug is the stable identity for choosing tenant-specific defaults. */
export function getMinistrySiteFallback(
  tenant?: { slug?: string | null; name?: string | null } | null,
): MinistryConfig {
  return tenant?.slug === globalMissionConfig.tenantSlug
    ? globalMissionConfig
    : createNeutralMinistrySite(tenant);
}
