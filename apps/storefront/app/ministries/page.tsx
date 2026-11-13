import { notFound } from "next/navigation";
import MinistriesPageContent from "./page-content";
import { isTenantWebsitePageEnabled } from "../../lib/server-site-pages";

export default async function MinistriesPageRoute() {
  if (!await isTenantWebsitePageEnabled("ministries")) notFound();
  return <MinistriesPageContent />;
}
