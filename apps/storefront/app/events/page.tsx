import { notFound } from "next/navigation";
import EventsPageContent from "./page-content";
import { isTenantWebsitePageEnabled } from "../../lib/server-site-pages";
import { renderConfiguredTemplatePage } from "../../lib/configured-template-page";

export default async function EventsPageRoute() {
  const configuredPage = await renderConfiguredTemplatePage("/events");
  if (configuredPage) return configuredPage;
  if (!await isTenantWebsitePageEnabled("events")) notFound();
  return <EventsPageContent />;
}
