import { describe, expect, it } from "vitest";
import { churchPublicSiteSettingsSchema } from "@bazion/church-ministry-contracts";
import { getWebsitePageForRoute } from "./site-page-availability";

describe("tenant website route availability", () => {
  it("matches dynamic detail routes to their configured parent page", () => {
    const settings = churchPublicSiteSettingsSchema.parse({});

    expect(getWebsitePageForRoute(settings.pages, "/events/revival-night")?.id).toBe("events");
    expect(getWebsitePageForRoute(settings.pages, "/sermons/weekly-message")?.id).toBe("sermons");
  });

  it("normalizes a trailing slash and leaves unknown routes unmatched", () => {
    const settings = churchPublicSiteSettingsSchema.parse({});

    expect(getWebsitePageForRoute(settings.pages, "/about/")?.path).toBe("/about");
    expect(getWebsitePageForRoute(settings.pages, "/unknown")).toBeUndefined();
  });

  it("returns the configured publish state for a direct page route", () => {
    const defaults = churchPublicSiteSettingsSchema.parse({});
    const settings = churchPublicSiteSettingsSchema.parse({
      pages: defaults.pages.map((page) => page.id === "about" ? { ...page, enabled: false } : page),
    });

    expect(getWebsitePageForRoute(settings.pages, "/about")?.enabled).toBe(false);
  });
});
