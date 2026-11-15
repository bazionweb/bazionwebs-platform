import { headers, cookies } from "next/headers";
import {
  BMI_UNIVERSITY_TENANT_ID,
  BEMI_INSTITUTE_TENANT_ID,
  bmiUniversityTenantConfig,
  bemiTrainingInstituteTenantConfig,
  type SchoolPortalConfig,
} from "@bazion/education-contracts";

export async function resolveEducationTenant(): Promise<{
  isEducation: boolean;
  isBemi: boolean;
  tenantConfig: SchoolPortalConfig;
}> {
  let host = "";
  let tenantCookie = "";

  try {
    const h = await headers();
    const hostHeader = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    host = hostHeader.split(",", 1)[0]?.trim().toLowerCase();
    const c = await cookies();
    tenantCookie = c.get("bazion_tenant")?.value?.trim().toLowerCase() ?? "";
  } catch {
    // In static rendering or non-request context
  }

  const defaultTenantId = process.env.DEFAULT_TENANT_ID ?? "";
  const tenantMode = (process.env.NEXT_PUBLIC_TENANT_TYPE ?? process.env.TENANT_RESOLUTION_MODE ?? "").toLowerCase();

  const isBemi =
    host.includes("bemi") ||
    tenantCookie.includes("bemi") ||
    defaultTenantId === BEMI_INSTITUTE_TENANT_ID;

  const isBmi =
    host.includes("bmi") ||
    tenantCookie.includes("bmi") ||
    defaultTenantId === BMI_UNIVERSITY_TENANT_ID;

  const isEducation =
    isBmi ||
    isBemi ||
    host.includes("education") ||
    host.includes("oxford") ||
    tenantCookie.includes("education") ||
    tenantCookie.includes("oxford") ||
    tenantMode === "education" ||
    process.env.EDUCATION_PREVIEW === "true";

  const tenantConfig = isBemi ? bemiTrainingInstituteTenantConfig : bmiUniversityTenantConfig;

  return {
    isEducation,
    isBemi,
    tenantConfig,
  };
}

