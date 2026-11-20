import { smeWebsiteTemplateConfigSchema, type SmeWebsiteTemplateConfig } from "@bazion/sme-website-template";
import { fetchTenantPublicData } from "./server-tenant-api";

interface PublicPackageConfigResponse {
  configuration?: unknown;
  template?: { id: string; configuredVersion: string; currentVersion: string; updateMode: "automatic" | "pinned" } | null;
}

export interface PublicTenantWebsiteConfig {
  packageId: string;
  templateId: string;
  templateVersion: string;
  updateMode: "automatic" | "pinned";
  website: SmeWebsiteTemplateConfig["website"];
  smeConfig: SmeWebsiteTemplateConfig;
}

/** Loads only the public, host-resolved website configuration for the current request. */
export async function getPublicTenantWebsiteConfig(): Promise<PublicTenantWebsiteConfig | null> {
  const response = await fetchTenantPublicData<PublicPackageConfigResponse>("/v1/public/website/config");
  const configuration = response?.configuration;
  if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) return null;

  const record = configuration as Record<string, unknown>;
  if (typeof record.packageId !== "string" || typeof record.templateId !== "string") return null;
  const parsedSmeConfig = smeWebsiteTemplateConfigSchema.safeParse(record.smeConfig);
  if (!parsedSmeConfig.success) return null;

  const template = response?.template;
  return {
    packageId: record.packageId,
    templateId: template?.id ?? record.templateId,
    templateVersion: template?.currentVersion ?? String(record.templateVersion ?? "1.0.0"),
    updateMode: template?.updateMode ?? "automatic",
    website: parsedSmeConfig.data.website,
    smeConfig: parsedSmeConfig.data,
  };
}
