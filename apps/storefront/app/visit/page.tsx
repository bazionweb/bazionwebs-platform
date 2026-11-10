import { notFound } from "next/navigation";
import VisitPageContent from "./page-content";
import { isTenantWebsitePageEnabled } from "../../lib/server-site-pages";

export default async function VisitPageRoute() {
  if (!await isTenantWebsitePageEnabled("visit")) notFound();
  return <VisitPageContent />;
}
