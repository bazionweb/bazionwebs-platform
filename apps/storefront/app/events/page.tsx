import { notFound } from "next/navigation";
import EventsPageContent from "./page-content";
import { isTenantWebsitePageEnabled } from "../../lib/server-site-pages";

export default async function EventsPageRoute() {
  if (!await isTenantWebsitePageEnabled("events")) notFound();
  return <EventsPageContent />;
}
