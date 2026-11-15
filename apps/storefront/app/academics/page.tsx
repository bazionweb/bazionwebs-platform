import { resolveEducationTenant } from "../../lib/education-tenant";
import { EducationShell } from "../../components/education/education-shell";
import { BmiAcademicsPage } from "@bazion/education-template";
import { notFound } from "next/navigation";

export default async function AcademicsPageRoute() {
  const education = await resolveEducationTenant();
  if (!education.isEducation) notFound();
  return (
    <EducationShell>
      <BmiAcademicsPage />
    </EducationShell>
  );
}

