import { notFound } from "next/navigation";
import SermonsPageContent from "./page-content";
import { isTenantWebsitePageEnabled } from "../../lib/server-site-pages";
import { renderConfiguredTemplatePage } from "../../lib/configured-template-page";

export default async function SermonsPageRoute() {
  const configuredPage = await renderConfiguredTemplatePage("/sermons");
  if (configuredPage) return configuredPage;
  if (!await isTenantWebsitePageEnabled("sermons")) notFound();
  return <SermonsPageContent />;
}
