import { notFound } from "next/navigation";
import {
  SmeConfiguredPage,
  SmeWebsiteShell,
  type SmeWebsiteTemplateConfig,
} from "@bazion/sme-website-template";
import { getPublicTenantWebsiteConfig } from "./server-website-config";

/**
 * Resolves a route from the request host's current tenant template configuration.
 * A configured tenant with a disabled/missing page fails closed instead of falling
 * through to unrelated shared storefront content.
 */
export async function renderConfiguredTemplatePage(path: string) {
  const website = await getPublicTenantWebsiteConfig();
  if (!website || website.packageId === "church-ministry") return null;

  const page = website.smeConfig.website.pages.find((candidate) => candidate.path === path);
  if (!page?.enabled) notFound();

  return (
    <SmeWebsiteShell config={website.smeConfig} currentPath={path}>
      <SmeConfiguredPage config={website.smeConfig as SmeWebsiteTemplateConfig} page={page} />
    </SmeWebsiteShell>
  );
}
