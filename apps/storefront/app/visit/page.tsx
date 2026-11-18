import { notFound } from "next/navigation";
import VisitPageContent from "./page-content";
import { isTenantWebsitePageEnabled } from "../../lib/server-site-pages";
import { renderConfiguredTemplatePage } from "../../lib/configured-template-page";

export default async function VisitPageRoute() {
  const configuredPage = await renderConfiguredTemplatePage("/visit");
  if (configuredPage) return configuredPage;
  if (!await isTenantWebsitePageEnabled("visit")) notFound();
  return <VisitPageContent />;
}
