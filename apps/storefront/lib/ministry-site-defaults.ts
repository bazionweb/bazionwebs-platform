import { defaultChurchNavigation, defaultChurchPages } from "@bazion/church-ministry-contracts";
import { globalMissionConfig, type MinistryConfig } from "@bazion/church-ministry-template";

/** Neutral defaults for a ministry tenant that has not configured its public site yet. */
export const neutralMinistrySite: MinistryConfig = {
  tenantSlug: "unknown",
  ministryName: "Ministry",
  tagline: "Welcome to our ministry.",
  theme: {
    preset: "forest-bronze",
    headerStyle: "classic",
    heroStyle: "rotator",
    cardStyle: "rounded",
    fontPairing: "outfit-inter",
  },
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
    rotatorWords: [],
  },
  contact: { phones: [], email: "", address: "" },
  social: {},
  navigation: defaultChurchNavigation,
  pages: defaultChurchPages,
  statistics: [],
  giving: { mpesaPaybill: "", accountName: "", instructions: "", suggestedAmounts: [] },
  serviceTimes: [],
  locations: [],
  visitorInfo: { arrival: "", children: "", accessibility: "", parking: "" },
  online: { description: "" },
  scripture: { verse: "", reference: "", version: "" },
  departments: [],
  ministries: [],
  groups: [],
  volunteerTeams: [],
  testimonies: [],
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
