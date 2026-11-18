import { redirect } from "next/navigation";
import { resolveEducationTenant } from "../../lib/education-tenant";
import { renderConfiguredTemplatePage } from "../../lib/configured-template-page";

export default async function BemiPage() {
  const education = await resolveEducationTenant();
  if (!education.isEducation) {
    const configuredPage = await renderConfiguredTemplatePage("/bemi");
    if (configuredPage) return configuredPage;
  }
  redirect("/institutes/bemi");
}

