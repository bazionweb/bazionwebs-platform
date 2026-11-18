import { notFound } from "next/navigation";
import TermsPageContent from "./page-content";
import { isTenantWebsitePageEnabled } from "../../lib/server-site-pages";
import { resolveEducationTenant } from "../../lib/education-tenant";
import { EducationShell } from "../../components/education/education-shell";
import { BmiTermsPage } from "@bazion/education-template";
import { isEducationInstitutionWebsitePageEnabled } from "@bazion/education-contracts";
import { renderConfiguredTemplatePage } from "../../lib/configured-template-page";

export default async function TermsPageRoute() {
  const education = await resolveEducationTenant();
  if (education.isEducation) {
    if (!isEducationInstitutionWebsitePageEnabled(education.tenantConfig, "/terms")) notFound();
    return (
      <EducationShell>
        <BmiTermsPage />
      </EducationShell>
    );
  }
  const configuredPage = await renderConfiguredTemplatePage("/terms");
  if (configuredPage) return configuredPage;
  if (!await isTenantWebsitePageEnabled("terms")) notFound();
  return <TermsPageContent />;
}
