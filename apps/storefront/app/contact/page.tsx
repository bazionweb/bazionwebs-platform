import { notFound } from "next/navigation";
import ContactPageContent from "./page-content";
import { isTenantWebsitePageEnabled } from "../../lib/server-site-pages";

export default async function ContactPageRoute() {
  if (!await isTenantWebsitePageEnabled("contact")) notFound();
  return <ContactPageContent />;
}
