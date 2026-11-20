import { resolveEducationTenant } from "../../lib/education-tenant";
import { EducationShell } from "../../components/education/education-shell";
import { BmiAcademicsPage } from "@bazion/education-template";
import { notFound } from "next/navigation";
import { renderConfiguredTemplatePage } from "../../lib/configured-template-page";

export default async function AcademicsPageRoute() {
  const education = await resolveEducationTenant();
  if (!education.isEducation) {
    const configuredPage = await renderConfiguredTemplatePage("/academics");
    if (configuredPage) return configuredPage;
    notFound();
  }
  return (
    <EducationShell>
      <BmiAcademicsPage />
    </EducationShell>
  );
}

