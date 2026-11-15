import { notFound } from "next/navigation";
import AboutPageContent from "./page-content";
import { isTenantWebsitePageEnabled } from "../../lib/server-site-pages";
import { resolveEducationTenant } from "../../lib/education-tenant";
import { EducationShell } from "../../components/education/education-shell";
import { BmiAboutPage } from "@bazion/education-template";

export default async function AboutPageRoute() {
  const education = await resolveEducationTenant();
  if (education.isEducation) {
    return (
      <EducationShell>
        <BmiAboutPage />
      </EducationShell>
    );
  }
  if (!await isTenantWebsitePageEnabled("about")) notFound();
  return <AboutPageContent />;
}
