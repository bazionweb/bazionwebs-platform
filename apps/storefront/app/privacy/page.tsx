import { notFound } from "next/navigation";
import PrivacyPolicyPageContent from "./page-content";
import { isTenantWebsitePageEnabled } from "../../lib/server-site-pages";
import { resolveEducationTenant } from "../../lib/education-tenant";
import { EducationShell } from "../../components/education/education-shell";
import { BmiPrivacyPage } from "@bazion/education-template";
import { SmePrivacyPage, SmeWebsiteShell, isSmeWebsitePageEnabled } from "@bazion/sme-website-template";
import { getPublicTenantWebsiteConfig } from "../../lib/server-website-config";

export default async function PrivacyPolicyPageRoute() {
  const education = await resolveEducationTenant();
  if (education.isEducation) {
    return (
      <EducationShell>
        <BmiPrivacyPage />
      </EducationShell>
    );
  }
  const websiteConfig = await getPublicTenantWebsiteConfig();
  if (websiteConfig && websiteConfig.packageId !== "church-ministry"
    && isSmeWebsitePageEnabled(websiteConfig.smeConfig, "privacy")) {
    return (
      <SmeWebsiteShell config={websiteConfig.smeConfig} currentPath="/privacy">
        <SmePrivacyPage config={websiteConfig.smeConfig} />
      </SmeWebsiteShell>
    );
  }
  if (!await isTenantWebsitePageEnabled("privacy")) notFound();
  return <PrivacyPolicyPageContent />;
}
