import { notFound } from "next/navigation";
import PrivacyPolicyPageContent from "./page-content";
import { isTenantWebsitePageEnabled } from "../../lib/server-site-pages";

export default async function PrivacyPolicyPageRoute() {
  if (!await isTenantWebsitePageEnabled("privacy")) notFound();
  return <PrivacyPolicyPageContent />;
}
