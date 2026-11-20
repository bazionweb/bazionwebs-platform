import { notFound } from "next/navigation";
import ContactPageContent from "./page-content";
import { isTenantWebsitePageEnabled } from "../../lib/server-site-pages";
import { resolveEducationTenant } from "../../lib/education-tenant";
import { EducationShell } from "../../components/education/education-shell";
import { BmiContactPage } from "@bazion/education-template";
import { SmeContactPage, SmeWebsiteShell, isSmeWebsitePageEnabled } from "@bazion/sme-website-template";
import { getPublicTenantWebsiteConfig } from "../../lib/server-website-config";

export default async function ContactPageRoute() {
  const education = await resolveEducationTenant();
  if (education.isEducation) {
    return (
      <EducationShell>
        <BmiContactPage />
      </EducationShell>
    );
  }
  const websiteConfig = await getPublicTenantWebsiteConfig();
  if (websiteConfig && websiteConfig.packageId !== "church-ministry"
    && isSmeWebsitePageEnabled(websiteConfig.smeConfig, "contact")) {
    return (
      <SmeWebsiteShell config={websiteConfig.smeConfig} currentPath="/contact">
        <SmeContactPage config={websiteConfig.smeConfig} formsLeadsEnabled={false} />
      </SmeWebsiteShell>
    );
  }
  if (!await isTenantWebsitePageEnabled("contact")) notFound();
  return <ContactPageContent />;
}
