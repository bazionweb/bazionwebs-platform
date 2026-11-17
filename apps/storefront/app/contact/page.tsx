import { notFound } from "next/navigation";
import ContactPageContent from "./page-content";
import { isTenantWebsitePageEnabled } from "../../lib/server-site-pages";
import { resolveEducationTenant } from "../../lib/education-tenant";
import { EducationShell } from "../../components/education/education-shell";
import { BmiContactPage } from "@bazion/education-template";

export default async function ContactPageRoute() {
  const education = await resolveEducationTenant();
  if (education.isEducation) {
    return (
      <EducationShell>
        <BmiContactPage />
      </EducationShell>
    );
  }
  if (!await isTenantWebsitePageEnabled("contact")) notFound();
  return <ContactPageContent />;
}
