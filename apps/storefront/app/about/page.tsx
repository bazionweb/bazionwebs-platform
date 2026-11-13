import { notFound } from "next/navigation";
import AboutPageContent from "./page-content";
import { isTenantWebsitePageEnabled } from "../../lib/server-site-pages";

export default async function AboutPageRoute() {
  if (!await isTenantWebsitePageEnabled("about")) notFound();
  return <AboutPageContent />;
}
