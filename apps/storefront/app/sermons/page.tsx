import { notFound } from "next/navigation";
import SermonsPageContent from "./page-content";
import { isTenantWebsitePageEnabled } from "../../lib/server-site-pages";

export default async function SermonsPageRoute() {
  if (!await isTenantWebsitePageEnabled("sermons")) notFound();
  return <SermonsPageContent />;
}
