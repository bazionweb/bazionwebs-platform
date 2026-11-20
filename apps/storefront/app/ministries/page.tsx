import { notFound } from "next/navigation";
import MinistriesPageContent from "./page-content";
import { isTenantWebsitePageEnabled } from "../../lib/server-site-pages";
import { renderConfiguredTemplatePage } from "../../lib/configured-template-page";

export default async function MinistriesPageRoute() {
  const configuredPage = await renderConfiguredTemplatePage("/ministries");
  if (configuredPage) return configuredPage;
  if (!await isTenantWebsitePageEnabled("ministries")) notFound();
  return <MinistriesPageContent />;
}
