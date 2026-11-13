import { notFound } from "next/navigation";
import GivePageContent from "./page-content";
import { isTenantWebsitePageEnabled } from "../../lib/server-site-pages";

export default async function GivePageRoute() {
  if (!await isTenantWebsitePageEnabled("giving")) notFound();
  return <GivePageContent />;
}
