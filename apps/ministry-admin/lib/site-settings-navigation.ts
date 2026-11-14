import type { ChurchPublicSiteSettings } from "@bazion/church-ministry-contracts";

export function setSitePageEnabled(
  settings: ChurchPublicSiteSettings,
  pageId: string,
  enabled: boolean,
): ChurchPublicSiteSettings {
  if (pageId === "home" && !enabled) return settings;
  return {
    ...settings,
    pages: settings.pages.map((page) => page.id === pageId ? { ...page, enabled } : page),
  };
}

export function addSiteNavigationItem(settings: ChurchPublicSiteSettings): ChurchPublicSiteSettings {
  const ids = new Set(settings.navigation.map(({ id }) => id));
  let suffix = 1;
  while (ids.has(`custom-link-${suffix}`)) suffix += 1;
  return {
    ...settings,
    navigation: [...settings.navigation, { id: `custom-link-${suffix}`, label: "", href: "" }],
  };
}

export function updateSiteNavigationItem(
  settings: ChurchPublicSiteSettings,
  index: number,
  changes: { label?: string; href?: string },
): ChurchPublicSiteSettings {
  if (!settings.navigation[index]) return settings;
  return {
    ...settings,
    navigation: settings.navigation.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item),
  };
}

export function removeSiteNavigationItem(
  settings: ChurchPublicSiteSettings,
  index: number,
): ChurchPublicSiteSettings {
  return {
    ...settings,
    navigation: settings.navigation.filter((_, itemIndex) => itemIndex !== index),
  };
}
