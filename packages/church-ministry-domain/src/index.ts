export function slugifyContentTitle(title: string, fallback = "content"): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140)
    .replace(/-+$/g, "");
  return slug.length >= 3 ? slug : fallback;
}

/**
 * Pick a unique, bounded slug within the caller's current tenant scope.
 * The caller supplies the tenant-scoped existence check so this domain helper
 * stays independent of a database, API framework, and storage provider.
 */
export async function uniqueTenantSlug(
  baseSlug: string,
  maxLength: number,
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  if (!Number.isInteger(maxLength) || maxLength < 1) {
    throw new RangeError("maxLength must be a positive integer.");
  }

  const base = baseSlug.slice(0, maxLength).replace(/-+$/g, "") || "content";
  let candidate = base;
  let suffixNumber = 2;
  while (await isTaken(candidate)) {
    const suffix = `-${suffixNumber++}`;
    const boundedSuffix = suffix.slice(-maxLength);
    const prefixLength = Math.max(0, maxLength - boundedSuffix.length);
    const prefix = base.slice(0, prefixLength).replace(/-+$/g, "");
    candidate = `${prefix}${boundedSuffix}`;
  }
  return candidate;
}

export {
  getMinistrySiteSettings,
  saveMinistrySiteSettings,
  type MinistrySiteSettingsRepository,
  type MinistrySiteSettingsSnapshot,
} from "./site-settings.js";
