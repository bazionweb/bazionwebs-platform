import { describe, expect, it } from "vitest";
import { createNeutralMinistrySite, getMinistrySiteFallback, neutralMinistrySite } from "./ministry-site-defaults";

describe("neutral ministry site defaults", () => {
  it("does not inherit Global Mission identity, contact details, or branding", () => {
    const siteText = JSON.stringify(neutralMinistrySite).toLowerCase();

    expect(siteText).not.toContain("global mission");
    expect(siteText).not.toContain("propagating revival");
    expect(siteText).not.toContain("globalmissionfc@gmail.com");
    expect(siteText).not.toContain("254721341793");
    expect(neutralMinistrySite.branding).toEqual({
      logoUrl: "",
      primaryColor: "#1f2937",
      secondaryColor: "#475569",
      accentColor: "#c99a43",
    });
    expect(neutralMinistrySite.contact).toEqual({ phones: [], email: "", address: "" });
    expect(neutralMinistrySite.navigation.map(({ href }) => href)).toContain("/contact");
    expect(neutralMinistrySite.pages.find(({ id }) => id === "home")?.sections).toContain("hero");
  });

  it("applies a tenant's public identity without carrying another tenant's content", () => {
    const site = createNeutralMinistrySite({ slug: "new-church", name: "  New Church  " });

    expect(site.tenantSlug).toBe("new-church");
    expect(site.ministryName).toBe("New Church");
    expect(site.hero.title).toBe("A place to");
    expect(site.contact.phones).toEqual([]);
  });

  it("keeps Global Mission and a second ministry on separate defaults", () => {
    const globalMission = getMinistrySiteFallback({
      slug: "global-mission-fc",
      name: "Global Mission for Christ International",
    });
    const secondMinistry = getMinistrySiteFallback({
      slug: "new-light-church",
      name: "Global Mission for Christ International",
    });

    expect(globalMission.branding.logoUrl).toBe("/images/gmfc-logo.png");
    expect(globalMission.contact.email).toBe("globalmissionfc@gmail.com");
    expect(secondMinistry.tenantSlug).toBe("new-light-church");
    expect(secondMinistry.branding.logoUrl).toBe("");
    expect(secondMinistry.contact.email).toBe("");
    expect(secondMinistry.hero.title).toBe("A place to");
    expect(secondMinistry.vision.statement).toBe("");
  });
});
