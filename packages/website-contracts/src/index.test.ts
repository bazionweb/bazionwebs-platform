import { describe, expect, it } from "vitest";
import {
  WEBSITE_CONFIGURATION_VERSION,
  websiteConfigurationSchema,
  websitePageSectionSchema,
} from "./index.js";

describe("versioned website configuration", () => {
  it("provides safe defaults for branding, navigation, SEO and supported pages", () => {
    const config = websiteConfigurationSchema.parse({});

    expect(config.schemaVersion).toBe(WEBSITE_CONFIGURATION_VERSION);
    expect(config.branding.primaryColor).toBe("#1f2937");
    expect(config.navigation.map(({ href }) => href)).toEqual(["/", "/about", "/services", "/contact"]);
    expect(config.seo).toEqual({ title: "", description: "" });
    expect(config.pages.find(({ id }) => id === "contact")?.sections).toContain("contact-form");
  });

  it("accepts constrained tenant branding, navigation, SEO and page sections", () => {
    const config = websiteConfigurationSchema.parse({
      schemaVersion: "1.0.0",
      branding: { primaryColor: "#193a31", logoUrl: "/media/logo.svg" },
      navigation: [
        { id: "home", label: "Welcome", href: "/" },
        { id: "services", label: "Our services", href: "https://example.test/services" },
      ],
      seo: { title: "Harbour Studio", description: "Design and repair for local homes." },
      pages: [{ id: "home", path: "/", title: "Welcome", sections: ["hero", "feature-list", "contact-form"] }],
    });

    expect(config.branding.logoUrl).toBe("/media/logo.svg");
    expect(config.navigation[1]?.href).toBe("https://example.test/services");
    expect(config.pages[0]?.enabled).toBe(true);
  });

  it("rejects unsafe URLs, unreadable brand colors, unsupported sections and unknown config fields", () => {
    expect(websiteConfigurationSchema.safeParse({ navigation: [{ id: "home", label: "Home", href: "javascript:alert(1)" }] }).success).toBe(false);
    expect(websiteConfigurationSchema.safeParse({ navigation: [{ id: "home", label: "Home", href: "//external.test" }] }).success).toBe(false);
    expect(websiteConfigurationSchema.safeParse({ branding: { primaryColor: "#ffffff" } }).success).toBe(false);
    expect(websitePageSectionSchema.safeParse("arbitrary-html").success).toBe(false);
    expect(websiteConfigurationSchema.safeParse({ script: "<script>bad()</script>" }).success).toBe(false);
  });

  it("rejects duplicate page identities, paths and navigation destinations", () => {
    expect(websiteConfigurationSchema.safeParse({
      navigation: [
        { id: "home", label: "Home", href: "/" },
        { id: "home", label: "Start", href: "/start" },
      ],
    }).success).toBe(false);
    expect(websiteConfigurationSchema.safeParse({
      pages: [
        { id: "home", path: "/", title: "Home", sections: ["hero"] },
        { id: "landing", path: "/", title: "Landing", sections: ["text"] },
      ],
    }).success).toBe(false);
    expect(websiteConfigurationSchema.safeParse({
      pages: [{ id: "home", path: "/", title: "Home", sections: ["hero", "hero"] }],
    }).success).toBe(false);
  });

  it("requires a home page and rejects navigation to pages that are missing or disabled", () => {
    expect(websiteConfigurationSchema.safeParse({ pages: [] }).success).toBe(false);
    expect(websiteConfigurationSchema.safeParse({
      navigation: [{ id: "missing", label: "Missing", href: "/missing" }],
    }).success).toBe(false);
    expect(websiteConfigurationSchema.safeParse({
      navigation: [{ id: "about", label: "About", href: "/about" }],
      pages: [
        { id: "home", path: "/", title: "Home", sections: ["hero"] },
        { id: "about", path: "/about", title: "About", enabled: false, sections: ["text"] },
      ],
    }).success).toBe(false);
  });

  it("rejects unsupported schema versions and oversized site maps", () => {
    expect(websiteConfigurationSchema.safeParse({ schemaVersion: "2.0.0" }).success).toBe(false);
    expect(websiteConfigurationSchema.safeParse({
      navigation: Array.from({ length: 13 }, (_, index) => ({ id: `link-${index}`, label: `Link ${index}`, href: `/link-${index}` })),
    }).success).toBe(false);
  });
});
