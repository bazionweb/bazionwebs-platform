import {
  churchPublicSiteSettingsSchema,
  churchSiteSettingsInputSchema,
  type ChurchPublicSiteSettings,
  type ChurchSiteSettingsInput,
} from "@bazion/church-ministry-contracts";

export interface MinistrySiteSettingsSnapshot {
  tenantName: string | null;
  profile: {
    ministryName: string | null;
    logoAssetUrl: string | null;
    description: string | null;
    vision: string | null;
    mission: string | null;
    outreach: string | null;
    address: string | null;
    email: string | null;
    telephoneNumbers: unknown;
    socialLinks: unknown;
  } | null;
  storedSettings: string | null;
  leaders: Array<{
    name: string;
    position: string;
    biography: string | null;
    photoUrl: string | null;
  }>;
}

/** Database and transaction details stay behind this ministry-owned port. */
export interface MinistrySiteSettingsRepository {
  load(tenantId: string): Promise<MinistrySiteSettingsSnapshot>;
  save(tenantId: string, input: ChurchSiteSettingsInput, updatedAt: Date): Promise<void>;
}

function safePublicImageUrl(value: string | null | undefined): string {
  if (!value) return "";
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try { return new URL(value).protocol === "https:" ? value : ""; } catch { return ""; }
}

function safeSocialLinks(value: unknown): Record<string, string> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const allowed = new Set(["youtube", "facebook", "instagram", "twitter", "whatsapp"]);
  return Object.fromEntries(Object.entries(value).flatMap(([key, link]) => {
    if (!allowed.has(key) || typeof link !== "string") return [];
    try { return new URL(link).protocol === "https:" ? [[key, link]] : []; } catch { return []; }
  }));
}

function parseStoredSettings(value: string | null): ChurchPublicSiteSettings {
  if (!value) return churchPublicSiteSettingsSchema.parse({});
  try {
    const parsed = churchPublicSiteSettingsSchema.safeParse(JSON.parse(value) as unknown);
    return parsed.success ? parsed.data : churchPublicSiteSettingsSchema.parse({});
  } catch {
    return churchPublicSiteSettingsSchema.parse({});
  }
}

/** Loads a tenant's ministry site editor state through the repository port. */
export async function getMinistrySiteSettings(repository: MinistrySiteSettingsRepository, tenantId: string) {
  if (!tenantId.trim()) throw new Error("A tenant context is required to read ministry site settings.");
  const snapshot = await repository.load(tenantId);
  const settings = parseStoredSettings(snapshot.storedSettings);
  if (!snapshot.storedSettings) {
    settings.leadership = snapshot.leaders.map((leader) => ({
      name: leader.name,
      role: leader.position,
      bio: leader.biography ?? undefined,
      photoUrl: safePublicImageUrl(leader.photoUrl) || undefined,
    }));
  }
  const profile = snapshot.profile;
  return {
    profile: {
      ministryName: profile?.ministryName ?? snapshot.tenantName ?? "Ministry",
      tagline: profile?.description ?? "",
      logoUrl: safePublicImageUrl(profile?.logoAssetUrl),
      vision: profile?.vision ?? "",
      mission: profile?.mission ?? "",
      outreach: profile?.outreach ?? "",
      contact: {
        address: profile?.address ?? "",
        email: profile?.email ?? "",
        phones: Array.isArray(profile?.telephoneNumbers)
          ? profile.telephoneNumbers.filter((phone): phone is string => typeof phone === "string")
          : [],
      },
      social: safeSocialLinks(profile?.socialLinks),
    },
    settings,
  };
}

/** Validates and persists settings atomically through a tenant-scoped repository. */
export async function saveMinistrySiteSettings(
  repository: MinistrySiteSettingsRepository,
  tenantId: string,
  input: unknown,
  updatedAt = new Date(),
) {
  if (!tenantId.trim()) throw new Error("A tenant context is required to update ministry site settings.");
  const parsed = churchSiteSettingsInputSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, issues: parsed.error.issues };
  await repository.save(tenantId, parsed.data, updatedAt);
  return { success: true as const, updatedAt: updatedAt.toISOString() };
}
