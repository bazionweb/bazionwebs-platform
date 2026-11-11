import { describe, expect, it } from "vitest";
import {
  WEBSITE_CONFIGURATION_VERSION,
  WEBSITE_ENQUIRY_PRIVACY_NOTICE_VERSION,
  getPublicWebsiteNavigation,
  websiteEnquirySchema,
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

  it("requires an enabled home page and rejects navigation to pages that are missing", () => {
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
    }).success).toBe(true);
    expect(websiteConfigurationSchema.safeParse({
      pages: [{ id: "home", path: "/", title: "Home", enabled: false, sections: ["hero"] }],
    }).success).toBe(false);
  });

  it("keeps external links and published pages while hiding unpublished and unconfigured destinations", () => {
    const navigation = [
      { id: "home", label: "Home", href: "/" },
      { id: "about", label: "About", href: "/about" },
      { id: "contact", label: "Contact", href: "/contact" },
      { id: "partner", label: "Partner", href: "https://partner.example.org" },
    ];
    const pages = [
      { id: "home", path: "/", title: "Home", enabled: true, sections: ["hero"] as const },
      { id: "about", path: "/about", title: "About", enabled: false, sections: ["text"] as const },
    ];

    expect(getPublicWebsiteNavigation(navigation, pages).map(({ id }) => id)).toEqual(["home", "partner"]);
  });

  it("drops unsafe navigation destinations even when called with unparsed input", () => {
    const navigation = [
      { id: "home", label: "Home", href: "/" },
      { id: "script", label: "Unsafe", href: "javascript:alert(1)" },
      { id: "insecure", label: "Insecure", href: "http://example.org" },
      { id: "protocol-relative", label: "Protocol relative", href: "//example.org" },
    ];
    const pages = [{ id: "home", path: "/", title: "Home", enabled: true, sections: ["hero"] as const }];

    expect(getPublicWebsiteNavigation(navigation, pages).map(({ id }) => id)).toEqual(["home"]);
  });

  it("rejects unsupported schema versions and oversized site maps", () => {
    expect(websiteConfigurationSchema.safeParse({ schemaVersion: "2.0.0" }).success).toBe(false);
    expect(websiteConfigurationSchema.safeParse({
      navigation: Array.from({ length: 13 }, (_, index) => ({ id: `link-${index}`, label: `Link ${index}`, href: `/link-${index}` })),
    }).success).toBe(false);
  });
});

describe("public website enquiry contract", () => {
  const validEnquiry = {
    fullName: "Amina Otieno",
    email: "amina@example.test",
    subject: "Service question",
    message: "Please share more details about your services.",
    privacyConsent: true,
  };

  it("normalizes fields and applies the versioned form defaults", () => {
    const parsed = websiteEnquirySchema.parse({ ...validEnquiry, fullName: " Amina Otieno " });

    expect(parsed.fullName).toBe("Amina Otieno");
    expect(parsed.formId).toBe("contact");
    expect(parsed.privacyNoticeVersion).toBe(WEBSITE_ENQUIRY_PRIVACY_NOTICE_VERSION);
    expect(parsed.subject).toBe("Service question");
    expect(parsed.companyWebsite).toBe("");
    expect(WEBSITE_ENQUIRY_PRIVACY_NOTICE_VERSION).toBe("1.0.0");
  });

  it("requires consent and one valid contact method, and constrains user input", () => {
    expect(websiteEnquirySchema.safeParse({ ...validEnquiry, privacyConsent: false }).success).toBe(false);
    expect(websiteEnquirySchema.safeParse({ ...validEnquiry, privacyNoticeVersion: "not-versioned" }).success).toBe(false);
    expect(websiteEnquirySchema.safeParse({ ...validEnquiry, privacyNoticeVersion: "1".repeat(41) }).success).toBe(false);
    expect(websiteEnquirySchema.safeParse({ ...validEnquiry, email: "", telephone: "" }).success).toBe(false);
    expect(websiteEnquirySchema.safeParse({ ...validEnquiry, email: "not-an-email" }).success).toBe(false);
    expect(websiteEnquirySchema.safeParse({ ...validEnquiry, email: "", telephone: "+1" }).success).toBe(false);
    expect(websiteEnquirySchema.safeParse({ ...validEnquiry, email: "", telephone: "++254 712345678" }).success).toBe(false);
    expect(websiteEnquirySchema.safeParse({ ...validEnquiry, message: "short" }).success).toBe(false);
    expect(websiteEnquirySchema.safeParse({ ...validEnquiry, unknown: "unexpected" }).success).toBe(false);
  });

  it("accepts telephone-only enquiries and preserves the spam honeypot for server handling", () => {
    const parsed = websiteEnquirySchema.parse({
      fullName: "James Kariuki",
      telephone: "+254 712 345 678",
      message: "Call me to discuss a project.",
      privacyConsent: true,
      companyWebsite: "bot.example",
    });

    expect(parsed.telephone).toBe("+254 712 345 678");
    expect(parsed.companyWebsite).toBe("bot.example");
  });
});
