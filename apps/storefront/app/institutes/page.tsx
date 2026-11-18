import { resolveEducationTenant } from "../../lib/education-tenant";
import { EducationShell } from "../../components/education/education-shell";
import { BmiInstitutesPage } from "@bazion/education-template";
import { notFound } from "next/navigation";
import { renderConfiguredTemplatePage } from "../../lib/configured-template-page";

export default async function InstitutesPageRoute() {
  const education = await resolveEducationTenant();
  if (!education.isEducation) {
    const configuredPage = await renderConfiguredTemplatePage("/institutes");
    if (configuredPage) return configuredPage;
    notFound();
  }
  return (
    <EducationShell>
      <BmiInstitutesPage />
    </EducationShell>
  );
}

