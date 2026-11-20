import { isEducationInstitutionWebsitePageEnabled } from "@bazion/education-contracts";
import { resolveEducationTenant } from "../../lib/education-tenant";
import { EducationShell } from "../../components/education/education-shell";
import { BmiAdmissionsPage } from "@bazion/education-template";
import { notFound } from "next/navigation";
import { renderConfiguredTemplatePage } from "../../lib/configured-template-page";

export default async function AdmissionsPageRoute() {
  const education = await resolveEducationTenant();
  if (!education.isEducation) {
    const configuredPage = await renderConfiguredTemplatePage("/admissions");
    if (configuredPage) return configuredPage;
    notFound();
  }
  if (!isEducationInstitutionWebsitePageEnabled(education.tenantConfig, "/admissions")) notFound();
  return (
    <EducationShell>
      <BmiAdmissionsPage />
    </EducationShell>
  );
}

