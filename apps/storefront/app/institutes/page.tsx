import { resolveEducationTenant } from "../../lib/education-tenant";
import { EducationShell } from "../../components/education/education-shell";
import { BmiInstitutesPage } from "@bazion/education-template";
import { notFound } from "next/navigation";

export default async function InstitutesPageRoute() {
  const education = await resolveEducationTenant();
  if (!education.isEducation) notFound();
  return (
    <EducationShell>
      <BmiInstitutesPage />
    </EducationShell>
  );
}

