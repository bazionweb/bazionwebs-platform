import { headers, cookies } from "next/headers";
import {
  BMI_UNIVERSITY_TENANT_ID,
  BEMI_INSTITUTE_TENANT_ID,
  BMI_LEGACY_TENANT_ID,
  BEMI_LEGACY_TENANT_ID,
  bmiUniversityTenantConfig,
  bemiTrainingInstituteTenantConfig,
  isBmiHost,
  isBemiHost,
  cleanHostname,
  type SchoolPortalConfig,
} from "@bazion/education-contracts";
import { extractTenantSlugFromHost } from "@bazion/auth";

export interface EducationTenantContext {
  host?: string;
  tenantHeader?: string;
  tenantCookie?: string;
  envTenantId?: string;
  defaultTenantId?: string;
  tenantMode?: string;
  previewMode?: boolean;
}

export interface EducationTenantResult {
  isEducation: boolean;
  isBemi: boolean;
  tenantConfig: SchoolPortalConfig;
}

/**
 * Pure resolution logic for education tenant detection across development,
 * preview, and production domains.
 */
export function resolveEducationTenantFromContext(
  ctx: EducationTenantContext,
): EducationTenantResult {
  const host = cleanHostname(ctx.host ?? "");
  const tenantHeader = (ctx.tenantHeader ?? "").trim().toLowerCase();
  const tenantCookie = (ctx.tenantCookie ?? "").trim().toLowerCase();
  const envTenantId = (ctx.envTenantId ?? "").trim().toLowerCase();
  const defaultTenantId = (ctx.defaultTenantId ?? "").trim();
  const tenantMode = (ctx.tenantMode ?? "").trim().toLowerCase();
  const isPreview = Boolean(ctx.previewMode);

  // Helper: check if a string matches BEMI identifiers
  const matchesBemiIdentifier = (value: string) =>
    value === "bemi" ||
    value === "bemi-institute" ||
    value === BEMI_INSTITUTE_TENANT_ID ||
    value === BEMI_LEGACY_TENANT_ID;

  // Helper: check if a string matches BMI identifiers
  const matchesBmiIdentifier = (value: string) =>
    value === "bmi" ||
    value === "bmi-university" ||
    value === BMI_UNIVERSITY_TENANT_ID ||
    value === BMI_LEGACY_TENANT_ID;

  // 1. Explicit Header Override (set by middleware from ?tenant=... query param or proxy)
  if (tenantHeader) {
    if (matchesBemiIdentifier(tenantHeader)) {
      return { isEducation: true, isBemi: true, tenantConfig: bemiTrainingInstituteTenantConfig };
    }
    if (matchesBmiIdentifier(tenantHeader)) {
      return { isEducation: true, isBemi: false, tenantConfig: bmiUniversityTenantConfig };
    }
  }

  // 2. Explicit Cookie Override (saved user/dev preview selection)
  if (tenantCookie) {
    if (matchesBemiIdentifier(tenantCookie)) {
      return { isEducation: true, isBemi: true, tenantConfig: bemiTrainingInstituteTenantConfig };
    }
    if (matchesBmiIdentifier(tenantCookie)) {
      return { isEducation: true, isBemi: false, tenantConfig: bmiUniversityTenantConfig };
    }
  }

  // 3. Hostname Resolution (Production domains & Dev subdomains like bemi.localhost or bmi.localhost)
  if (host) {
    if (isBemiHost(host)) {
      return { isEducation: true, isBemi: true, tenantConfig: bemiTrainingInstituteTenantConfig };
    }
    if (isBmiHost(host)) {
      return { isEducation: true, isBemi: false, tenantConfig: bmiUniversityTenantConfig };
    }

    const previewSlug = extractTenantSlugFromHost(host, process.env.PUBLIC_STOREFRONT_URL);
    if (previewSlug) {
      if (matchesBemiIdentifier(previewSlug)) {
        return { isEducation: true, isBemi: true, tenantConfig: bemiTrainingInstituteTenantConfig };
      }
      if (matchesBmiIdentifier(previewSlug)) {
        return { isEducation: true, isBemi: false, tenantConfig: bmiUniversityTenantConfig };
      }
    }
  }

  // 4. Server Process Environment Defaults (For naked loopback dev: http://localhost:3100)
  const isLoopback = !host || host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (isLoopback) {
    if (envTenantId === "bemi" || matchesBemiIdentifier(defaultTenantId)) {
      return { isEducation: true, isBemi: true, tenantConfig: bemiTrainingInstituteTenantConfig };
    }
    if (envTenantId === "bmi" || matchesBmiIdentifier(defaultTenantId)) {
      return { isEducation: true, isBemi: false, tenantConfig: bmiUniversityTenantConfig };
    }
  }

  // 5. Generic Education Mode / Preview flag
  const isGenericEducation =
    tenantMode === "education" ||
    isPreview ||
    host.includes("education") ||
    tenantCookie.includes("education");

  if (isGenericEducation) {
    const isBemi = envTenantId === "bemi" || matchesBemiIdentifier(defaultTenantId);
    return {
      isEducation: true,
      isBemi,
      tenantConfig: isBemi ? bemiTrainingInstituteTenantConfig : bmiUniversityTenantConfig,
    };
  }

  // 6. Not an education tenant (e.g. Church, SME Commerce)
  return {
    isEducation: false,
    isBemi: false,
    tenantConfig: bmiUniversityTenantConfig,
  };
}

/**
 * Server-side tenant resolver for Next.js App Router (pages, layouts, metadata).
 */
export async function resolveEducationTenant(): Promise<EducationTenantResult> {
  let host = "";
  let tenantHeader = "";
  let tenantCookie = "";

  try {
    const h = await headers();
    const hostHeader = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    host = hostHeader.split(",", 1)[0]?.trim().toLowerCase();
    tenantHeader = h.get("x-bazion-tenant")?.trim().toLowerCase() ?? "";

    const c = await cookies();
    tenantCookie = c.get("bazion_tenant")?.value?.trim().toLowerCase() ?? "";
  } catch {
    // In static rendering or non-request context
  }

  return resolveEducationTenantFromContext({
    host,
    tenantHeader,
    tenantCookie,
    envTenantId: process.env.EDUCATION_TENANT_ID,
    defaultTenantId: process.env.DEFAULT_TENANT_ID,
    tenantMode: process.env.NEXT_PUBLIC_TENANT_TYPE ?? process.env.TENANT_RESOLUTION_MODE,
    previewMode: process.env.EDUCATION_PREVIEW === "true",
  });
}
