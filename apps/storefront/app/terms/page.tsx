import { notFound } from "next/navigation";
import TermsPageContent from "./page-content";
import { isTenantWebsitePageEnabled } from "../../lib/server-site-pages";

export default async function TermsPageRoute() {
  if (!await isTenantWebsitePageEnabled("terms")) notFound();
  return <TermsPageContent />;
}
