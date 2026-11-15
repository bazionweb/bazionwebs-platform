import { notFound } from "next/navigation";
import TermsPageContent from "./page-content";
import { isTenantWebsitePageEnabled } from "../../lib/server-site-pages";
import { resolveEducationTenant } from "../../lib/education-tenant";
import { EducationShell } from "../../components/education/education-shell";
import { BmiTermsPage } from "@bazion/education-template";

export default async function TermsPageRoute() {
  const education = await resolveEducationTenant();
  if (education.isEducation) {
    return (
      <EducationShell>
        <BmiTermsPage />
      </EducationShell>
    );
  }
  if (!await isTenantWebsitePageEnabled("terms")) notFound();
  return <TermsPageContent />;
}
