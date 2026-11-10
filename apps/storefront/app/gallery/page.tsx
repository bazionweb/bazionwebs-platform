import { notFound } from "next/navigation";
import GalleryPageContent from "./page-content";
import { isTenantWebsitePageEnabled } from "../../lib/server-site-pages";

export default async function GalleryPageRoute() {
  if (!await isTenantWebsitePageEnabled("gallery")) notFound();
  return <GalleryPageContent />;
}
