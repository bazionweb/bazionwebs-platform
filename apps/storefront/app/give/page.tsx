import { notFound } from "next/navigation";
import GivePageContent from "./page-content";
import { isTenantWebsitePageEnabled } from "../../lib/server-site-pages";
import { renderConfiguredTemplatePage } from "../../lib/configured-template-page";

export default async function GivePageRoute() {
  const configuredPage = await renderConfiguredTemplatePage("/give");
  if (configuredPage) return configuredPage;
  if (!await isTenantWebsitePageEnabled("giving")) notFound();
  return <GivePageContent />;
}
