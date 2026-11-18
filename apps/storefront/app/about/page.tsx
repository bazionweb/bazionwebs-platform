import { notFound } from "next/navigation";
import AboutPageContent from "./page-content";
import { isTenantWebsitePageEnabled } from "../../lib/server-site-pages";
import { resolveEducationTenant } from "../../lib/education-tenant";
import { EducationShell } from "../../components/education/education-shell";
import { BmiAboutPage } from "@bazion/education-template";
import { SmeAboutPage, SmeWebsiteShell, isSmeWebsitePageEnabled } from "@bazion/sme-website-template";
import { getPublicTenantWebsiteConfig } from "../../lib/server-website-config";

export default async function AboutPageRoute() {
  const education = await resolveEducationTenant();
  if (education.isEducation) {
    return (
      <EducationShell>
        <BmiAboutPage />
      </EducationShell>
    );
  }
  const websiteConfig = await getPublicTenantWebsiteConfig();
  if (websiteConfig && websiteConfig.packageId !== "church-ministry"
    && isSmeWebsitePageEnabled(websiteConfig.smeConfig, "about")) {
    return (
      <SmeWebsiteShell config={websiteConfig.smeConfig} currentPath="/about">
        <SmeAboutPage config={websiteConfig.smeConfig} />
      </SmeWebsiteShell>
    );
  }
  if (!await isTenantWebsitePageEnabled("about")) notFound();
  return <AboutPageContent />;
}
