import { describe, expect, it } from "vitest";
import { churchPublicSiteSettingsSchema, getPublicWebsiteNavigation } from "@bazion/church-ministry-contracts";
import { addSiteNavigationItem, removeSiteNavigationItem, setSitePageEnabled, updateSiteNavigationItem } from "./site-settings-navigation";

describe("tenant site navigation editor updates", () => {
  it("hides and restores a page link when publishing is toggled", () => {
    const initial = churchPublicSiteSettingsSchema.parse({});
    const hidden = setSitePageEnabled(initial, "about", false);

    expect(hidden.navigation.some(({ href }) => href === "/about")).toBe(true);
    expect(getPublicWebsiteNavigation(hidden.navigation, hidden.pages).some(({ href }) => href === "/about")).toBe(false);
    expect(churchPublicSiteSettingsSchema.safeParse(hidden).success).toBe(true);

    const republished = setSitePageEnabled(hidden, "about", true);
    expect(getPublicWebsiteNavigation(republished.navigation, republished.pages).some(({ href }) => href === "/about")).toBe(true);
  });

  it("does not allow the home page to be unpublished", () => {
    const initial = churchPublicSiteSettingsSchema.parse({});
    const unchanged = setSitePageEnabled(initial, "home", false);

    expect(unchanged).toBe(initial);
    expect(churchPublicSiteSettingsSchema.safeParse({ ...initial, pages: initial.pages.map((page) => page.id === "home" ? { ...page, enabled: false } : page) }).success).toBe(false);
  });

  it("creates unique navigation IDs and allows rows to be edited or removed", () => {
    const initial = churchPublicSiteSettingsSchema.parse({
      navigation: [
        { id: "home", label: "Home", href: "/" },
        { id: "custom-link-1", label: "Give", href: "/give" },
      ],
    });
    const added = addSiteNavigationItem(initial);
    const edited = updateSiteNavigationItem(added, 2, { label: "Partner", href: "https://partner.example.org" });
    const removed = removeSiteNavigationItem(edited, 1);

    expect(added.navigation[2]?.id).toBe("custom-link-2");
    expect(edited.navigation[2]).toMatchObject({ label: "Partner", href: "https://partner.example.org" });
    expect(removed.navigation.map(({ id }) => id)).toEqual(["home", "custom-link-2"]);
    expect(updateSiteNavigationItem(initial, 9, { label: "Missing" })).toBe(initial);
  });
});
