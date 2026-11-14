import {
  type ChurchSiteSettingsInput,
  type SiteSettingsVersionSummary,
  churchSiteSettingsInputSchema,
} from "@bazion/church-ministry-contracts";

export interface MinistrySiteSettingsVersionsRepository {
  getLatestPublishedVersion(tenantId: string): Promise<{
    versionNumber: number;
    settings: ChurchSiteSettingsInput["settings"];
    profile: ChurchSiteSettingsInput["profile"];
    publishedAt: string;
    publishedBy: string | null;
  } | null>;
  getCurrentDraft(tenantId: string): Promise<{
    versionNumber: number;
    settings: ChurchSiteSettingsInput["settings"];
    profile: ChurchSiteSettingsInput["profile"];
    createdAt: string;
    createdBy: string | null;
  } | null>;
  saveDraft(
    tenantId: string,
    input: ChurchSiteSettingsInput,
    createdBy?: string,
  ): Promise<{ versionNumber: number }>;
  publishDraft(
    tenantId: string,
    publishedBy?: string,
    note?: string,
  ): Promise<{ versionNumber: number; publishedAt: string }>;
  listVersions(tenantId: string): Promise<SiteSettingsVersionSummary[]>;
  rollbackToVersion(
    tenantId: string,
    targetVersionNumber: number,
    rolledBackBy?: string,
    note?: string,
  ): Promise<{ newVersionNumber: number; publishedAt: string }>;
  discardDraft(tenantId: string): Promise<void>;
}

export async function saveSiteSettingsDraftUseCase(
  repository: MinistrySiteSettingsVersionsRepository,
  tenantId: string,
  rawInput: unknown,
  createdBy?: string,
) {
  if (!tenantId.trim()) throw new Error("A tenant context is required.");
  const parsed = churchSiteSettingsInputSchema.parse(rawInput);
  return repository.saveDraft(tenantId, parsed, createdBy);
}

export async function publishSiteSettingsDraftUseCase(
  repository: MinistrySiteSettingsVersionsRepository,
  tenantId: string,
  publishedBy?: string,
  note?: string,
) {
  if (!tenantId.trim()) throw new Error("A tenant context is required.");
  return repository.publishDraft(tenantId, publishedBy, note);
}

export async function rollbackSiteSettingsVersionUseCase(
  repository: MinistrySiteSettingsVersionsRepository,
  tenantId: string,
  versionNumber: number,
  rolledBackBy?: string,
  note?: string,
) {
  if (!tenantId.trim()) throw new Error("A tenant context is required.");
  if (!Number.isInteger(versionNumber) || versionNumber < 1) {
    throw new Error("A valid version number is required for rollback.");
  }
  return repository.rollbackToVersion(tenantId, versionNumber, rolledBackBy, note);
}

