import { isEducationInstitutionWebsitePageEnabled } from "@bazion/education-contracts";
import { resolveEducationTenant } from "../../lib/education-tenant";
import { EducationShell } from "../../components/education/education-shell";
import { BmiVerifyPage } from "@bazion/education-template";
import { notFound } from "next/navigation";
import { renderConfiguredTemplatePage } from "../../lib/configured-template-page";

export default async function VerifyPageRoute() {
  const education = await resolveEducationTenant();
  if (!education.isEducation) {
    const configuredPage = await renderConfiguredTemplatePage("/verify");
    if (configuredPage) return configuredPage;
    notFound();
  }
  if (!isEducationInstitutionWebsitePageEnabled(education.tenantConfig, "/verify")) notFound();
  return (
    <EducationShell>
      <BmiVerifyPage />
    </EducationShell>
  );
}

