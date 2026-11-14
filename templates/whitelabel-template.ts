import {
  churchSiteSettingsInputSchema,
  defaultChurchNavigation,
  defaultChurchPages,
  type ChurchPublicSiteSettings,
  type ChurchSiteSettingsInput,
  type ChurchTheme,
} from "@bazion/church-ministry-contracts";
import {
  ensureAccessibleHexColor,
  generateByowDokployCompose,
  platformWhiteLabelPackageCatalog,
  universalThemePalettes,
  createWhiteLabeledPackageConfig,
  extractWhiteLabelFromRepoSource,
  type ByowFramework,
  type ByowComposeInput,
  type ByowComposeBlueprint,
} from "@bazion/website-contracts";
import type { MinistryConfig } from "./church.types.js";
import {
  churchThemePresets,
  sampleDepartments,
  sampleMinistries,
  sampleSmallGroups,
  sampleTestimonies,
  sampleVolunteerTeams,
} from "./church-sample-data.js";

export {
  ensureAccessibleHexColor,
  generateByowDokployCompose,
  platformWhiteLabelPackageCatalog,
  universalThemePalettes,
  createWhiteLabeledPackageConfig,
  extractWhiteLabelFromRepoSource,
  type ByowFramework,
  type ByowComposeInput,
  type ByowComposeBlueprint,
};

export type WhiteLabelTemplateId =
  | "gmfc-revival-signature"
  | "church-ministry"
  | "royal-cathedral";

export interface WhiteLabelTemplateDescriptor {
  id: WhiteLabelTemplateId;
  name: string;
  tagline: string;
  description: string;
  preset: ChurchTheme["preset"];
  headerStyle: ChurchTheme["headerStyle"];
  heroStyle: ChurchTheme["heroStyle"];
  cardStyle: ChurchTheme["cardStyle"];
  fontPairing: ChurchTheme["fontPairing"];
  features: string[];
}

export const churchTemplateCatalog: WhiteLabelTemplateDescriptor[] = [
  {
    id: "gmfc-revival-signature",
    name: "GMFC Revival & Apostolic Signature",
    tagline: "Editorial church design with portrait leadership cards, M-Pesa giving hub, sermons & outreach",
    description:
      "Flagship white-labeled multi-page church template modeled after the GMFC editorial design: full-width hero, portrait & classic leadership view switcher, M-Pesa Paybill & STK card, sermon player, and WhatsApp/Map hub.",
    preset: "maroon-gold",
    headerStyle: "classic",
    heroStyle: "rotator",
    cardStyle: "rounded",
    fontPairing: "outfit-inter",
    features: [
      "Portrait & Classic Leadership Card Switcher",
      "M-Pesa Paybill & Interactive Giving Hub",
      "Searchable Sermon Video Archive",
      "Events Calendar & RSVP Registration",
      "WhatsApp & Google Maps Contact Hub",
    ],
  },
  {
    id: "church-ministry",
    name: "Modern Sanctuary & Community",
    tagline: "Warm emerald & bronze layout built around small groups, ministries & welcoming guests",
    description:
      "Clean, inviting congregation template highlighting Sunday service times, visitor welcome guide, small groups, and community outreach.",
    preset: "forest-bronze",
    headerStyle: "classic",
    heroStyle: "centered-bold",
    cardStyle: "rounded",
    fontPairing: "jakarta-inter",
    features: [
      "Plan a Visit Onboarding Guide",
      "Small Groups & Departments Directory",
      "Online Giving & Campaigns",
      "Prayer Requests & Contact Inbox",
    ],
  },
  {
    id: "royal-cathedral",
    name: "Royal Cathedral & Heritage",
    tagline: "Dignified navy & amber aesthetic for multi-campus ministries and regional fellowships",
    description:
      "Authoritative institutional church website template designed for regional fellowships, teaching archives, leadership councils, and ministry announcements.",
    preset: "royal-navy",
    headerStyle: "centered",
    heroStyle: "centered-bold",
    cardStyle: "rounded",
    fontPairing: "jakarta-inter",
    features: [
      "Executive Leadership & Vision Showcase",
      "Multi-Campus Locations & Maps",
      "Teaching & Media Library",
      "Stewardship & Benevolence Portal",
    ],
  },
];

export interface WhiteLabelTemplateInput {
  tenantSlug: string;
  ministryName: string;
  templateId?: WhiteLabelTemplateId;
  tagline?: string;
  logoUrl?: string;
  themePreset?: ChurchTheme["preset"];
  themeOverrides?: Partial<{
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    heroBgUrl: string;
  }>;
  contact?: {
    address?: string;
    poBox?: string;
    email?: string;
    phones?: string[];
    whatsappNumber?: string;
    googleMapsUrl?: string;
  };
  giving?: {
    mpesaPaybill?: string;
    accountNo?: string;
    accountName?: string;
    instructions?: string;
    suggestedAmounts?: number[];
  };
  social?: {
    youtube?: string;
    facebook?: string;
    instagram?: string;
    twitter?: string;
    whatsapp?: string;
  };
  visionStatement?: string;
  missionStatement?: string;
  outreachStatement?: string;
  includeStarterContent?: boolean;
}

export interface WhiteLabelGeneratedOutput {
  template: WhiteLabelTemplateDescriptor;
  config: MinistryConfig;
  siteSettingsInput: ChurchSiteSettingsInput;
}

export interface RepoWhiteLabelVariable {
  variable: string;
  category: "identity" | "theme" | "contact" | "giving" | "social";
  detectedLiteral: string;
  replacementPreview: string;
}

export interface RepoWhiteLabelExtractionInput {
  repoUrl: string;
  configTs?: string;
  tokensCss?: string;
  packageJson?: string;
  targetBrand: {
    tenantSlug: string;
    ministryName: string;
    tagline?: string;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    contact?: WhiteLabelTemplateInput["contact"];
    giving?: WhiteLabelTemplateInput["giving"];
    social?: WhiteLabelTemplateInput["social"];
    includeStarterContent?: boolean;
  };
}

export interface RepoWhiteLabelExtractionResult {
  repoUrl: string;
  detectedFramework: ByowFramework;
  detectedSourceBrand: {
    siteName: string | null;
    tagline: string | null;
    emails: string[];
    phones: string[];
    paybill: string | null;
    accountNo: string | null;
    socialLinks: Record<string, string>;
    colors: {
      primary?: string;
      secondary?: string;
      accent?: string;
    };
    fonts: {
      heading?: string;
      body?: string;
    };
  };
  whiteLabelVariables: RepoWhiteLabelVariable[];
  generated: WhiteLabelGeneratedOutput;
}

function normalizeSixDigitHex(hex: string | undefined): string | null {
  if (!hex) return null;
  const cleaned = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `#${cleaned.toUpperCase()}`;
  }
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    const expanded = cleaned
      .split("")
      .map((ch) => `${ch}${ch}`)
      .join("");
    return `#${expanded.toUpperCase()}`;
  }
  return null;
}

function sanitizeHttpsUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function sanitizeExternalHttpsUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function cleanPhones(phones: string[] | undefined): string[] {
  if (!phones) return [];
  return phones
    .map((p) => p.trim())
    .filter((p) => p.length >= 7 && p.length <= 30)
    .slice(0, 10);
}

function buildAboutHeroSplit(ministryName: string): { title: string; highlightedTitle: string } {
  const words = ministryName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { title: "Welcome to", highlightedTitle: "Our Ministry" };
  if (words.length === 1) return { title: "Welcome to", highlightedTitle: words[0]! };
  if (words.length <= 3) {
    return { title: words[0]!, highlightedTitle: words.slice(1).join(" ") };
  }
  return {
    title: words.slice(0, -2).join(" "),
    highlightedTitle: words.slice(-2).join(" "),
  };
}

export function getTemplateDescriptor(templateId?: string): WhiteLabelTemplateDescriptor {
  return (
    churchTemplateCatalog.find((item) => item.id === templateId) ??
    churchTemplateCatalog[0]!
  );
}

/**
 * Generates a 100% white-labeled church website configuration (`MinistryConfig` +
 * validated `ChurchSiteSettingsInput`) with zero source-tenant literals.
 */
export function createWhiteLabeledChurchConfig(
  input: WhiteLabelTemplateInput,
): WhiteLabelGeneratedOutput {
  const template = getTemplateDescriptor(input.templateId);
  const presetId = input.themePreset ?? template.preset;
  const presetDef =
    churchThemePresets.find((preset) => preset.id === presetId) ?? churchThemePresets[0]!;

  const primaryColor = ensureAccessibleHexColor(
    input.themeOverrides?.primaryColor ?? presetDef.primaryColor,
    "#4A1110",
  );
  const secondaryColor = ensureAccessibleHexColor(
    input.themeOverrides?.secondaryColor ?? presetDef.secondaryColor,
    "#6B1A18",
  );
  const accentColor = ensureAccessibleHexColor(
    input.themeOverrides?.accentColor ?? presetDef.accentColor,
    "#B45E14",
  );

  const tenantSlug = input.tenantSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-") || "ministry";
  const ministryName = input.ministryName.trim() || "New Ministry";
  const tagline =
    input.tagline?.trim() ||
    "Grounded in Scripture, prayer, worship, and compassionate community outreach.";
  const phones = cleanPhones(input.contact?.phones);
  const email = input.contact?.email?.trim() || "";
  const address = input.contact?.address?.trim() || "";
  const poBox = input.contact?.poBox?.trim() || undefined;
  const whatsappNumber = input.contact?.whatsappNumber?.trim() || phones[0] || undefined;

  const paybill = input.giving?.mpesaPaybill?.trim() || "";
  const accountNo = input.giving?.accountNo?.trim() || "";
  const accountName = input.giving?.accountName?.trim() || ministryName;
  const instructions =
    input.giving?.instructions?.trim() ||
    (paybill
      ? `M-Pesa -> Lipa na M-Pesa -> Paybill ${paybill}${accountNo ? ` · Account No: ${accountNo}` : ""}`
      : "Configure mobile money or bank transfer giving details in your Ministry Admin workspace.");
  const suggestedAmounts =
    input.giving?.suggestedAmounts && input.giving.suggestedAmounts.length > 0
      ? input.giving.suggestedAmounts
      : [500, 1000, 2500, 5000];

  const youtubeUrl = sanitizeExternalHttpsUrl(input.social?.youtube);
  const facebookUrl = sanitizeExternalHttpsUrl(input.social?.facebook);
  const instagramUrl = sanitizeExternalHttpsUrl(input.social?.instagram);
  const twitterUrl = sanitizeExternalHttpsUrl(input.social?.twitter);
  const whatsappUrl = sanitizeExternalHttpsUrl(input.social?.whatsapp);
  const social: MinistryConfig["social"] = {
    ...(youtubeUrl ? { youtube: youtubeUrl } : {}),
    ...(facebookUrl ? { facebook: facebookUrl } : {}),
    ...(instagramUrl ? { instagram: instagramUrl } : {}),
    ...(twitterUrl ? { twitter: twitterUrl } : {}),
    ...(whatsappUrl ? { whatsapp: whatsappUrl } : {}),
  };

  const heroTitle = buildAboutHeroSplit(ministryName);
  const includeStarter = input.includeStarterContent !== false;
  const theme: ChurchTheme = {
    preset: presetDef.id,
    headerStyle: template.headerStyle,
    heroStyle: template.heroStyle,
    cardStyle: template.cardStyle,
    fontPairing: template.fontPairing,
  };

  const serviceTimes = includeStarter
    ? [
        {
          label: "Sunday Worship Celebration",
          day: "Sunday",
          time: "9:00 AM – 12:00 PM",
          note: "Praise, worship, Word of God, and fellowship for the whole family.",
        },
        {
          label: "Midweek Prayer & Bible Study",
          day: "Wednesday",
          time: "5:30 PM – 7:00 PM",
          note: "Intercession and chapter-by-chapter Scripture study.",
        },
        {
          label: "Youth & Young Adults Fellowship",
          day: "Saturday",
          time: "3:00 PM – 5:00 PM",
          note: "Discipleship, worship rehearsals, and mentorship.",
        },
      ]
    : [];

  const coreValues = includeStarter
    ? [
        {
          title: "Prayer & The Word",
          icon: "📖",
          description: "Rooting every gathering and decision in Scripture and persistent prayer.",
        },
        {
          title: "Authentic Worship",
          icon: "🎵",
          description: "Exalting Christ together in spirit and truth across every generation.",
        },
        {
          title: "Compassionate Outreach",
          icon: "🤝",
          description: "Serving families, youth, and vulnerable neighbors with practical love.",
        },
        {
          title: "Faithful Discipleship",
          icon: "🌱",
          description: "Equipping believers to grow in maturity and serve in their calling.",
        },
      ]
    : [];

  const statementOfFaith = includeStarter
    ? [
        {
          topic: "Holy Scripture",
          belief: "We believe the Bible is the inspired, authoritative Word of God and our final guide for faith and life.",
        },
        {
          topic: "Salvation Through Christ",
          belief: "We believe salvation is a free gift of grace received through faith in Jesus Christ.",
        },
        {
          topic: "The Church & Mission",
          belief: "We believe the Church is called to worship God, disciple believers, and proclaim the Gospel to all nations.",
        },
      ]
    : [];

  const visionStatement =
    input.visionStatement?.trim() ||
    `To see lives transformed and communities renewed through the Gospel of Jesus Christ at ${ministryName}.`;
  const missionStatement =
    input.missionStatement?.trim() ||
    `Proclaiming the Gospel, discipling believers in the Word, and serving our community with compassion.`;
  const outreachStatement =
    input.outreachStatement?.trim() ||
    `Extending practical care, neighborhood fellowships, and missions support beyond the church walls.`;

  const heroBgUrl = sanitizeHttpsUrl(input.themeOverrides?.heroBgUrl);
  const mapUrl = sanitizeExternalHttpsUrl(input.contact?.googleMapsUrl);

  const config: MinistryConfig = {
    tenantSlug,
    ministryName,
    tagline,
    theme,
    branding: {
      logoUrl: sanitizeHttpsUrl(input.logoUrl) || "",
      primaryColor,
      secondaryColor,
      accentColor,
      ...(heroBgUrl ? { heroBgUrl } : {}),
    },
    hero: {
      eyebrow: "WELCOME TO WORSHIP",
      title: heroTitle.title,
      highlightedTitle: heroTitle.highlightedTitle,
      subtitle: tagline,
      rotatorWords: ["Faith", "Fellowship", "Prayer", "Compassion"],
    },
    contact: {
      phones,
      email,
      address,
      ...(poBox ? { poBox } : {}),
      ...(whatsappNumber ? { whatsappNumber } : {}),
    },
    social,
    navigation: defaultChurchNavigation,
    pages: defaultChurchPages,
    statistics: [],
    giving: {
      mpesaPaybill: paybill,
      accountName,
      instructions,
      suggestedAmounts,
    },
    serviceTimes,
    locations: address
      ? [
          {
            name: `${ministryName} Sanctuary`,
            address,
            ...(mapUrl ? { mapUrl } : {}),
          },
        ]
      : [],
    visitorInfo: {
      arrival: "Guests are warmly welcomed 15 minutes before service at the Welcome Desk.",
      children: "Age-appropriate Sunday School classes run concurrently with main worship.",
      accessibility: "Ushers are ready to assist families, seniors, and guests with accessibility needs.",
      parking: "On-site sanctuary parking and hospitality stewards are available each Sunday.",
    },
    online: {
      ...(youtubeUrl ? { liveStreamUrl: youtubeUrl } : {}),
      description: `Join ${ministryName} online for live worship, sermons, and midweek teachings.`,
    },
    scripture: {
      verse:
        "Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver.",
      reference: "2 Corinthians 9:7",
      version: "NIV",
    },
    departments: includeStarter ? sampleDepartments : [],
    ministries: includeStarter ? sampleMinistries : [],
    groups: includeStarter ? sampleSmallGroups : [],
    volunteerTeams: includeStarter ? sampleVolunteerTeams : [],
    testimonies: includeStarter ? sampleTestimonies : [],
    galleryImages: [],
    faqs: includeStarter
      ? [
          {
            question: "What time are Sunday services?",
            answer: "Our main Sunday Celebration gathers from 9:00 AM to 12:00 PM.",
          },
          {
            question: "How can I join a ministry or small group?",
            answer: "Visit the Ministries page or speak with a hospitality leader after service.",
          },
        ]
      : [],
    metadata: {
      title: `${ministryName} | ${template.name}`,
      description: tagline,
    },
    vision: {
      title: "Our Vision",
      statement: visionStatement,
    },
    mission: {
      title: "Our Mission",
      statement: missionStatement,
    },
    outreach: {
      title: "Community Outreach",
      statement: outreachStatement,
    },
    coreValues,
    statementOfFaith,
    leadership: [],
  };

  const settingsPayload: ChurchPublicSiteSettings = churchSiteSettingsInputSchema.shape.settings.parse({
    theme,
    branding: {
      primaryColor,
      secondaryColor,
      accentColor,
      ...(config.branding.logoUrl ? { logoUrl: config.branding.logoUrl } : {}),
      ...(config.branding.heroBgUrl ? { heroImageUrl: config.branding.heroBgUrl } : {}),
    },
    navigation: config.navigation,
    pages: config.pages,
    hero: {
      eyebrow: config.hero.eyebrow,
      title: config.hero.title,
      highlightedTitle: config.hero.highlightedTitle,
      subtitle: config.hero.subtitle,
      rotatorWords: config.hero.rotatorWords ?? [],
    },
    serviceTimes: config.serviceTimes,
    locations: config.locations,
    visitorInfo: config.visitorInfo,
    online: config.online,
    scripture: config.scripture,
    departments: config.departments ?? [],
    ministries: config.ministries,
    groups: config.groups ?? [],
    volunteerTeams: config.volunteerTeams ?? [],
    testimonies: config.testimonies ?? [],
    galleryImages: [],
    faqs: config.faqs,
    giving: {
      mpesaPaybill: config.giving.mpesaPaybill,
      accountName: config.giving.accountName,
      instructions: config.giving.instructions,
      suggestedAmounts: config.giving.suggestedAmounts,
    },
    coreValues: config.coreValues,
    leadership: [],
    statementOfFaith: config.statementOfFaith,
    metadata: {
      title: config.metadata.title.slice(0, 160),
      description: config.metadata.description.slice(0, 320),
    },
  });

  const siteSettingsInput = churchSiteSettingsInputSchema.parse({
    profile: {
      ministryName: config.ministryName,
      tagline: config.tagline,
      logoUrl: config.branding.logoUrl,
      vision: config.vision.statement,
      mission: config.mission.statement,
      outreach: config.outreach.statement,
      contact: {
        address: config.contact.address,
        email: config.contact.email,
        phones: config.contact.phones,
      },
      social: {
        youtube: social.youtube ?? "",
        facebook: social.facebook ?? "",
        instagram: social.instagram ?? "",
        twitter: social.twitter ?? "",
        whatsapp: social.whatsapp ?? "",
      },
    },
    settings: settingsPayload,
  });

  return {
    template,
    config,
    siteSettingsInput,
  };
}

function matchCssToken(css: string, names: string[]): string | undefined {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = css.match(new RegExp(`${escaped}\\s*:\\s*([^;\\n]+)`, "i"));
    if (match?.[1]) {
      return match[1].trim().replace(/^['"]|['"]$/g, "");
    }
  }
  return undefined;
}

function matchConfigString(source: string, keys: string[]): string | undefined {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = source.match(
      new RegExp(`${escaped}\\s*:\\s*(?:"([^"\\n]+)"|'([^'\\n]+)')`, "i"),
    );
    const value = match?.[1] ?? match?.[2];
    if (value?.trim()) return value.trim();
  }
  return undefined;
}

function detectFrameworkFromPackageJson(packageJson?: string): ByowFramework {
  if (!packageJson) return "nextjs";
  try {
    const parsed = JSON.parse(packageJson) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...parsed.dependencies, ...parsed.devDependencies };
    if (deps.next) return "nextjs";
    if (deps.vite || deps.react) return "react-vite";
  } catch {
    // ignore malformed package.json
  }
  return "nextjs";
}

/**
 * Inspects an imported website repository's source files (`config.ts`, `tokens.css`, `package.json`),
 * detects source-brand literals, maps them to white-label variables, and builds a clean,
 * contrast-compliant white-labeled configuration for the target tenant.
 */
export function extractWhiteLabelTemplateFromRepoSource(
  input: RepoWhiteLabelExtractionInput,
): RepoWhiteLabelExtractionResult {
  const configTs = input.configTs ?? "";
  const tokensCss = input.tokensCss ?? "";
  const detectedFramework = detectFrameworkFromPackageJson(input.packageJson);

  const rawPrimary = matchCssToken(tokensCss, ["--color-primary", "--primary", "--brand-primary"]);
  const rawSecondary = matchCssToken(tokensCss, [
    "--color-primary-dark",
    "--color-secondary",
    "--secondary",
  ]);
  const rawAccent = matchCssToken(tokensCss, ["--color-accent", "--color-gold", "--accent"]);
  const headingFont = matchCssToken(tokensCss, ["--font-heading", "--font-display"]);
  const bodyFont = matchCssToken(tokensCss, ["--font-body", "--font-sans"]);

  const siteName =
    matchConfigString(configTs, ["fullName", "ministryName", "siteName", "shortName", "name", "title"]) ??
    null;
  const tagline = matchConfigString(configTs, ["tagline", "subtitle", "description"]) ?? null;
  const paybill = matchConfigString(configTs, ["paybill", "mpesaPaybill", "businessNo"]) ?? null;
  const accountNo = matchConfigString(configTs, ["accountNo", "accountNumber"]) ?? null;

  const emails = Array.from(
    new Set(
      (configTs.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []).map((e) => e.trim()),
    ),
  );
  const phones = Array.from(
    new Set((configTs.match(/\+\d{1,3}[\s-]?\d{3}[\s-]?\d{5,8}/g) ?? []).map((p) => p.trim())),
  );

  const socialLinks: Record<string, string> = {};
  for (const key of ["youtube", "facebook", "instagram", "twitter", "whatsapp"] as const) {
    const found = matchConfigString(configTs, [key]);
    if (found && /^https?:\/\//i.test(found)) {
      socialLinks[key] = found;
    }
  }

  const normalizedPrimary = normalizeSixDigitHex(rawPrimary);
  const normalizedSecondary = normalizeSixDigitHex(rawSecondary);
  const normalizedAccent = normalizeSixDigitHex(rawAccent);

  const resolvedPrimary = input.targetBrand.primaryColor ?? normalizedPrimary;
  const resolvedSecondary = input.targetBrand.secondaryColor ?? normalizedSecondary;
  const resolvedAccent = input.targetBrand.accentColor ?? normalizedAccent;

  const generated = createWhiteLabeledChurchConfig({
    tenantSlug: input.targetBrand.tenantSlug,
    ministryName: input.targetBrand.ministryName,
    templateId: "gmfc-revival-signature",
    ...(input.targetBrand.tagline ? { tagline: input.targetBrand.tagline } : {}),
    themeOverrides: {
      ...(resolvedPrimary ? { primaryColor: resolvedPrimary } : {}),
      ...(resolvedSecondary ? { secondaryColor: resolvedSecondary } : {}),
      ...(resolvedAccent ? { accentColor: resolvedAccent } : {}),
    },
    ...(input.targetBrand.contact ? { contact: input.targetBrand.contact } : {}),
    ...(input.targetBrand.giving ? { giving: input.targetBrand.giving } : {}),
    ...(input.targetBrand.social ? { social: input.targetBrand.social } : {}),
    ...(input.targetBrand.includeStarterContent !== undefined
      ? { includeStarterContent: input.targetBrand.includeStarterContent }
      : {}),
  });

  const whiteLabelVariables: RepoWhiteLabelVariable[] = [];
  if (siteName) {
    whiteLabelVariables.push({
      variable: "site.ministryName",
      category: "identity",
      detectedLiteral: siteName,
      replacementPreview: generated.config.ministryName,
    });
  }
  if (tagline) {
    whiteLabelVariables.push({
      variable: "site.tagline",
      category: "identity",
      detectedLiteral: tagline,
      replacementPreview: generated.config.tagline,
    });
  }
  if (normalizedPrimary) {
    whiteLabelVariables.push({
      variable: "site.branding.primaryColor",
      category: "theme",
      detectedLiteral: normalizedPrimary,
      replacementPreview: generated.config.branding.primaryColor,
    });
  }
  if (normalizedAccent) {
    whiteLabelVariables.push({
      variable: "site.branding.accentColor",
      category: "theme",
      detectedLiteral: normalizedAccent,
      replacementPreview: generated.config.branding.accentColor,
    });
  }
  if (emails[0]) {
    whiteLabelVariables.push({
      variable: "site.contact.email",
      category: "contact",
      detectedLiteral: emails[0],
      replacementPreview: generated.config.contact.email || "(tenant contact email)",
    });
  }
  if (phones[0]) {
    whiteLabelVariables.push({
      variable: "site.contact.phones",
      category: "contact",
      detectedLiteral: phones[0],
      replacementPreview: generated.config.contact.phones[0] || "(tenant phone)",
    });
  }
  if (paybill) {
    whiteLabelVariables.push({
      variable: "site.giving.mpesaPaybill",
      category: "giving",
      detectedLiteral: paybill,
      replacementPreview: generated.config.giving.mpesaPaybill || "(tenant paybill)",
    });
  }
  for (const [network, url] of Object.entries(socialLinks)) {
    whiteLabelVariables.push({
      variable: `site.social.${network}`,
      category: "social",
      detectedLiteral: url,
      replacementPreview:
        generated.config.social[network as keyof MinistryConfig["social"]] || `(tenant ${network})`,
    });
  }

  return {
    repoUrl: input.repoUrl,
    detectedFramework,
    detectedSourceBrand: {
      siteName,
      tagline,
      emails,
      phones,
      paybill,
      accountNo,
      socialLinks,
      colors: {
        ...(normalizedPrimary ? { primary: normalizedPrimary } : {}),
        ...(normalizedSecondary ? { secondary: normalizedSecondary } : {}),
        ...(normalizedAccent ? { accent: normalizedAccent } : {}),
      },
      fonts: {
        ...(headingFont ? { heading: headingFont } : {}),
        ...(bodyFont ? { body: bodyFont } : {}),
      },
    },
    whiteLabelVariables,
    generated,
  };
}
