import { z } from "zod";
import {
  websiteConfigurationSchema,
  ensureAccessibleHexColor,
  createWhiteLabeledPackageConfig,
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

export {
  BMI_UNIVERSITY_TENANT_ID,
  BEMI_INSTITUTE_TENANT_ID,
  BMI_LEGACY_TENANT_ID,
  BEMI_LEGACY_TENANT_ID,
};

export const schoolPortalConfigSchema = z.object({
  schemaVersion: z.literal(EDUCATION_CONFIGURATION_VERSION).default(EDUCATION_CONFIGURATION_VERSION),
  institutionName: z.string().trim().min(2).max(180),
  shortName: z.string().trim().min(2).max(60),
  legalEntityName: z.string().trim().max(180).optional(),
  tagline: z.string().trim().max(400).default(""),
  description: z.string().trim().max(4000).default(""),
  portalPath: z.string().default("/portal"),
  umsPath: z.string().default("/ums"),
  branding: z.object({
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#0E1D38"),
    secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#172A4D"),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#C5A048"),
    logoUrl: z.string().default("/images/bmi-logo.png"),
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

export interface CreateWhiteLabeledEducationInput {
  tenantSlug: string;
  institutionName: string;
  shortName?: string;
  tagline?: string;
  description?: string;
  email?: string;
  phone?: string;
  address?: string;
  primaryColor?: string;
  accentColor?: string;
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
      tagline: input.tagline ?? pkg.packageSettings.organization.tagline,
      description: input.description ?? pkg.packageSettings.organization.introduction,
      portalPath: "/portal",
      umsPath: "/ums",
      branding: {
        primaryColor: pkg.website.branding.primaryColor,
        secondaryColor: pkg.website.branding.secondaryColor,
        accentColor: "#C5A048",
        logoUrl: pkg.packageSettings.branding.logoUrl,
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

