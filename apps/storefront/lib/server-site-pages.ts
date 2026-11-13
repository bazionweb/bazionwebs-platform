import { churchPublicSiteSettingsSchema } from "@bazion/church-ministry-contracts";
import { fetchTenantPublicData } from "./server-tenant-api";

/** Reads the tenant-owned page switch before a route renders any public content. */
export async function isTenantWebsitePageEnabled(pageId: string): Promise<boolean> {
  const response = await fetchTenantPublicData<{ siteSettings?: unknown }>("/v1/public/church/site");
  if (!response?.siteSettings) return true;

  const parsed = churchPublicSiteSettingsSchema.safeParse(response.siteSettings);
  if (!parsed.success) return true;
  return parsed.data.pages.find((page) => page.id === pageId)?.enabled ?? true;
}
