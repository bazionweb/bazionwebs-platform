import { notFound } from "next/navigation";
import { SmeServicesPage, SmeWebsiteShell, isSmeWebsitePageEnabled } from "@bazion/sme-website-template";
import { getPublicTenantWebsiteConfig } from "../../lib/server-website-config";

export default async function TenantServicesPage() {
  const websiteConfig = await getPublicTenantWebsiteConfig();
  if (!websiteConfig || websiteConfig.packageId === "church-ministry"
    || !isSmeWebsitePageEnabled(websiteConfig.smeConfig, "services")) {
    notFound();
  }
  return (
    <SmeWebsiteShell config={websiteConfig.smeConfig} currentPath="/services">
      <SmeServicesPage config={websiteConfig.smeConfig} />
    </SmeWebsiteShell>
  );
}
