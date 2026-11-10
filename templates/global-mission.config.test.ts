import { describe, expect, it } from "vitest";
import { churchPublicSiteSettingsSchema } from "@bazion/church-ministry-contracts";
import { globalMissionConfig } from "./global-mission.config.js";

describe("Global Mission template website configuration", () => {
  it("uses the shared website contract and publishes every configured navigation destination", () => {
    const settings = churchPublicSiteSettingsSchema.parse({
      navigation: globalMissionConfig.navigation,
      pages: globalMissionConfig.pages,
    });

    expect(settings.navigation.map(({ href }) => href)).toContain("/contact");
    expect(settings.pages.find(({ id }) => id === "home")?.enabled).toBe(true);
    expect(settings.navigation.every(({ href }) => {
      const page = settings.pages.find(({ path }) => path === new URL(href, "https://global-mission.invalid").pathname);
      return href.startsWith("https://") || page?.enabled === true;
    })).toBe(true);
  });
});
