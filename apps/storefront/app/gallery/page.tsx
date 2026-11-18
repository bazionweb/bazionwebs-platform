import { notFound } from "next/navigation";
import GalleryPageContent from "./page-content";
import { isTenantWebsitePageEnabled } from "../../lib/server-site-pages";
import { renderConfiguredTemplatePage } from "../../lib/configured-template-page";

export default async function GalleryPageRoute() {
  const configuredPage = await renderConfiguredTemplatePage("/gallery");
  if (configuredPage) return configuredPage;
  if (!await isTenantWebsitePageEnabled("gallery")) notFound();
  return <GalleryPageContent />;
}
