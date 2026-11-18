import { z } from "zod";
import {
  buildTenantTemplateOverlay,
  deepMergeCascade,
  isTenantTemplateOverlay,
  websiteConfigurationSchema,
  resolveTenantTemplateOverlay,
  ensureAccessibleHexColor,
  createWhiteLabeledPackageConfig,
  websiteResourceUrlSchema,
} from "@bazion/website-contracts";
import { PROGRAMS, type Program } from "./programs.js";
import { INSTITUTION_ACADEMIC_FULL, INSTITUTION_LEGAL_NAME } from "./institution.js";
import {
  ADMISSIONS_EMAIL,
  REGISTRAR_EMAIL,
  FINANCE_EMAIL,
  ADMIN_EMAIL,
  BMI_UNIVERSITY_TENANT_ID,
  BEMI_INSTITUTE_TENANT_ID,
  BMI_LEGACY_TENANT_ID,
  BEMI_LEGACY_TENANT_ID,
} from "./domains.js";

export const EDUCATION_CONFIGURATION_VERSION = "1.0.0" as const;
export const SCHOOL_PORTAL_TEMPLATE_VERSION = "1.0.0" as const;

export {
  BMI_UNIVERSITY_TENANT_ID,
  BEMI_INSTITUTE_TENANT_ID,
  BMI_LEGACY_TENANT_ID,
  BEMI_LEGACY_TENANT_ID,
};

export const schoolLeadershipMemberSchema = z.object({
  name: z.string().trim().min(1).max(160),
  role: z.string().trim().min(1).max(160),
  img: z.string().optional(),
});

export type SchoolLeadershipMember = z.infer<typeof schoolLeadershipMemberSchema>;

export const schoolPortalConfigSchema = z.object({
  schemaVersion: z.literal(EDUCATION_CONFIGURATION_VERSION).default(EDUCATION_CONFIGURATION_VERSION),
  institutionName: z.string().trim().min(2).max(180),
  shortName: z.string().trim().min(2).max(60),
  legalEntityName: z.string().trim().max(180).optional(),
  tagline: z.string().trim().max(400).default(""),
  description: z.string().trim().max(4000).default(""),
  portalPath: z.string().default("/portal"),
  umsPath: z.string().default("/ums"),
  founderName: z.string().trim().max(180).optional(),
  missionStatement: z.string().trim().max(2000).optional(),
  visionStatement: z.string().trim().max(2000).optional(),
  valuesStatement: z.string().trim().max(2000).optional(),
  accreditationLabel: z.string().trim().max(240).optional(),
  legalDisclaimer: z.string().trim().max(1000).optional(),
  regionalHubNote: z.string().trim().max(1000).optional(),
  leadership: z.array(schoolLeadershipMemberSchema).optional(),
  trustees: z.array(z.string()).optional(),
  faculty: z.array(z.string()).optional(),
  branding: z.object({
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#0E1D38"),
    secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#172A4D"),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#C5A048"),
    logoUrl: websiteResourceUrlSchema.default("/images/bmi-logo.png"),
  }),
  contact: z.object({
    admissionsEmail: z.string().email().default(ADMISSIONS_EMAIL),
    registrarEmail: z.string().email().default(REGISTRAR_EMAIL),
    financeEmail: z.string().email().default(FINANCE_EMAIL),
    adminEmail: z.string().email().default(ADMIN_EMAIL),
    phones: z.array(z.string()).default(["+254 721 341 793", "+254 704 500 872"]),
    address: z.string().default("Mukurwe-ini Plaza, Nyeri County, Kenya"),
  }),
  website: websiteConfigurationSchema.optional(),
});

export type SchoolPortalConfig = z.infer<typeof schoolPortalConfigSchema>;

export const schoolEducationConfigInputSchema = schoolPortalConfigSchema.partial().extend({
  institutionName: z.string().trim().min(2).max(180),
});

export const bmiUniversityTenantConfig: SchoolPortalConfig = schoolPortalConfigSchema.parse({
  schemaVersion: EDUCATION_CONFIGURATION_VERSION,
  institutionName: INSTITUTION_ACADEMIC_FULL,
  shortName: "BMI University",
  legalEntityName: INSTITUTION_LEGAL_NAME,
  tagline:
    "Developing Christ-centered men and women with the values, knowledge, and skills essential to impact the world.",
  description:
    "Accredited global higher education institution dedicated to theological scholarship, biblical truth, and transformational leadership.",
  portalPath: "/portal",
  umsPath: "/ums",
  branding: {
    primaryColor: "#0E1D38",
    secondaryColor: "#172A4D",
    accentColor: "#C5A048",
    logoUrl: "/images/bmi-logo.png",
  },
  contact: {
    admissionsEmail: ADMISSIONS_EMAIL,
    registrarEmail: REGISTRAR_EMAIL,
    financeEmail: FINANCE_EMAIL,
    adminEmail: ADMIN_EMAIL,
    phones: ["+254 721 341 793", "+254 704 500 872", "704-607-5540"],
    address: "Mukurwe-ini Plaza, Nyeri County, Kenya & Charlotte, NC, USA",
  },
});

export const bemiTrainingInstituteTenantConfig: SchoolPortalConfig = schoolPortalConfigSchema.parse({
  schemaVersion: EDUCATION_CONFIGURATION_VERSION,
  institutionName: "BEMI Training Institute",
  shortName: "BEMI Institute",
  legalEntityName: INSTITUTION_LEGAL_NAME,
  tagline: "Vocational, Theological & Executive Ministry Training across East Africa.",
  description:
    "Kenya and East Africa campus of Bethel Ministries International University delivering certificate, diploma, and articulated degree pathways.",
  portalPath: "/portal",
  umsPath: "/ums",
  branding: {
    primaryColor: "#0E1D38",
    secondaryColor: "#780F20",
    accentColor: "#C5A048",
    logoUrl: "/images/bmi-logo.png",
  },
  contact: {
    admissionsEmail: ADMISSIONS_EMAIL,
    registrarEmail: REGISTRAR_EMAIL,
    financeEmail: FINANCE_EMAIL,
    adminEmail: ADMIN_EMAIL,
    phones: ["+254 721 341 793", "+254 704 500 872"],
    address: "Mukurwe-ini Plaza, Mukurweini Road, Nyeri County, Kenya",
  },
});

export type EducationInstitutionKey = "bmi" | "bemi";

export interface EducationInstitutionWebsiteProfile {
  name?: string | null;
  legalName?: string | null;
  admissionsEmail?: string | null;
  registrarEmail?: string | null;
  financeEmail?: string | null;
  adminEmail?: string | null;
  phones?: string[];
  address?: string | null;
}

export const educationInstitutionWebsiteOverridesSchema = z.object({
  tagline: z.string().trim().max(400).optional(),
  description: z.string().trim().max(4000).optional(),
  founderName: z.string().trim().max(180).optional(),
  missionStatement: z.string().trim().max(2000).optional(),
  visionStatement: z.string().trim().max(2000).optional(),
  valuesStatement: z.string().trim().max(2000).optional(),
  legalDisclaimer: z.string().trim().max(1000).optional(),
  regionalHubNote: z.string().trim().max(1000).optional(),
  branding: schoolPortalConfigSchema.shape.branding.partial().optional(),
  contact: schoolPortalConfigSchema.shape.contact.partial().optional(),
  website: websiteConfigurationSchema.optional(),
}).strict();

function educationTemplateBase(key: EducationInstitutionKey): SchoolPortalConfig {
  return key === "bemi" ? bemiTrainingInstituteTenantConfig : bmiUniversityTenantConfig;
}

export function resolveEducationInstitutionWebsiteConfig(
  key: EducationInstitutionKey,
  stored: unknown,
  profile?: EducationInstitutionWebsiteProfile,
): SchoolPortalConfig {
  const base = educationTemplateBase(key);
  const storedConfig = isTenantTemplateOverlay(stored)
    ? resolveTenantTemplateOverlay(base, stored)
    : deepMergeCascade(base, stored);
  const resolved = profile
    ? deepMergeCascade(storedConfig, {
        ...(profile.name ? { institutionName: profile.name, shortName: profile.name.slice(0, 60) } : {}),
        ...(profile.legalName !== undefined ? { legalEntityName: profile.legalName ?? undefined } : {}),
        contact: {
          ...(profile.admissionsEmail !== undefined ? { admissionsEmail: profile.admissionsEmail ?? undefined } : {}),
          ...(profile.registrarEmail !== undefined ? { registrarEmail: profile.registrarEmail ?? undefined } : {}),
          ...(profile.financeEmail !== undefined ? { financeEmail: profile.financeEmail ?? undefined } : {}),
          ...(profile.adminEmail !== undefined ? { adminEmail: profile.adminEmail ?? undefined } : {}),
          ...(profile.phones !== undefined ? { phones: profile.phones } : {}),
          ...(profile.address !== undefined ? { address: profile.address ?? undefined } : {}),
        },
      })
    : storedConfig;
  const parsed = schoolPortalConfigSchema.safeParse(resolved);
  return parsed.success ? parsed.data : base;
}

export function createEducationInstitutionWebsiteOverlay(
  key: EducationInstitutionKey,
  effective: SchoolPortalConfig,
) {
  return buildTenantTemplateOverlay({
    packageId: "school-education",
    templateId: "school-portal",
    templateVersion: SCHOOL_PORTAL_TEMPLATE_VERSION,
    configurationSchemaVersion: EDUCATION_CONFIGURATION_VERSION,
    base: educationTemplateBase(key),
    effective,
  });
}

export interface CreateWhiteLabeledEducationInput {
  tenantSlug: string;
  institutionName: string;
  shortName?: string;
  legalEntityName?: string;
  tagline?: string;
  description?: string;
  email?: string;
  phone?: string;
  address?: string;
  primaryColor?: string;
  accentColor?: string;
  logoUrl?: string;
  founderName?: string;
  missionStatement?: string;
  visionStatement?: string;
  valuesStatement?: string;
  accreditationLabel?: string;
  legalDisclaimer?: string;
  leadership?: SchoolLeadershipMember[];
  trustees?: string[];
  faculty?: string[];
  programs?: Program[];
}

export function createWhiteLabeledEducationConfig(input: CreateWhiteLabeledEducationInput) {
  const pkg = createWhiteLabeledPackageConfig({
    packageId: "school-education",
    templateId: "oxford-imperial-university",
    tenantSlug: input.tenantSlug,
    brandName: input.institutionName,
    tagline: input.tagline,
    introduction: input.description,
    about: input.description,
    themeOverrides: {
      primaryColor: ensureAccessibleHexColor(input.primaryColor, "#0E1D38"),
      accentColor: ensureAccessibleHexColor(input.accentColor, "#8B5B29"),
    },
    contact: {
      email: input.email,
      phones: input.phone ? [input.phone] : undefined,
      address: input.address,
    },
    offerings: (input.programs ?? PROGRAMS.slice(0, 6)).map((program, idx) => ({
      id: `program-${idx + 1}`,
      name: program.label,
      description: program.description,
      category: program.level,
    })),
  });

  return {
    ...pkg,
    portalConfig: schoolPortalConfigSchema.parse({
      schemaVersion: EDUCATION_CONFIGURATION_VERSION,
      institutionName: input.institutionName,
      shortName: input.shortName ?? input.institutionName,
      legalEntityName: input.legalEntityName ?? input.institutionName,
      tagline: input.tagline ?? pkg.packageSettings.organization.tagline,
      description: input.description ?? pkg.packageSettings.organization.introduction,
      portalPath: "/portal",
      umsPath: "/ums",
      founderName: input.founderName,
      missionStatement:
        input.missionStatement ??
        `${input.institutionName} develops scholars and leaders with the values, knowledge, and skills essential to impact the world.`,
      visionStatement:
        input.visionStatement ??
        `Through residential and online programs, ${input.institutionName} educates students to make meaningful contributions to their workplaces and communities.`,
      valuesStatement:
        input.valuesStatement ??
        `The educational philosophy of ${input.institutionName} centers on academic excellence, ethical integrity, and transformative leadership.`,
      accreditationLabel: input.accreditationLabel ?? "Accredited Higher Education Institution",
      legalDisclaimer:
        input.legalDisclaimer ??
        `All academic programs, tuition settlements, and credentials are issued under the authority of ${input.legalEntityName ?? input.institutionName}.`,
      leadership: input.leadership ?? [],
      trustees: input.trustees ?? [],
      faculty: input.faculty ?? [],
      branding: {
        primaryColor: pkg.website.branding.primaryColor,
        secondaryColor: pkg.website.branding.secondaryColor,
        accentColor: "#C5A048",
        logoUrl: input.logoUrl ?? pkg.packageSettings.branding.logoUrl,
      },
      contact: {
        admissionsEmail: input.email ?? `admissions@${input.tenantSlug}.org`,
        registrarEmail: input.email ?? `registrar@${input.tenantSlug}.org`,
        financeEmail: input.email ?? `finance@${input.tenantSlug}.org`,
        adminEmail: input.email ?? `admin@${input.tenantSlug}.org`,
        phones: input.phone ? [input.phone] : ["+254 700 000 000"],
        address: input.address ?? "Main Campus",
      },
      website: pkg.website,
    }),
  };
}

