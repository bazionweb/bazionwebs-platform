import { notFound } from "next/navigation";
import { renderConfiguredTemplatePage } from "../../lib/configured-template-page";

export default async function TenantServicesPage() {
  const configuredPage = await renderConfiguredTemplatePage("/services");
  if (configuredPage) return configuredPage;
  notFound();
}
