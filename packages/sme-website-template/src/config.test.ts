import { describe, expect, it } from "vitest";
import { defaultSmeWebsiteTemplateConfig, isSmeEnquiryCollectionAvailable, smeWebsiteTemplateConfigSchema } from "./config.js";
import { getSmePageMetadata } from "./seo.js";
import { getSmeEnquiryEndpoint } from "./contact-form.js";

describe("SME website template", () => {
  it("provides generic demo-safe pages and service content without customer data", () => {
    const config = defaultSmeWebsiteTemplateConfig;

    expect(config.schemaVersion).toBe("1.0.0");
    expect(config.business.name).toBe("Your Business");
    expect(config.business.contact).toEqual({});
    expect(config.website.pages.map(({ id }) => id)).toContain("privacy");
    expect(config.business.services).toHaveLength(3);
    expect(config.business.privacyNotice).toBe("");
    expect(config.business.privacyNoticeVersion).toBe("1.0.0");
  });

  it("rejects malformed services, invalid business details, and unknown configuration data", () => {
    expect(smeWebsiteTemplateConfigSchema.safeParse({
      business: {
        ...defaultSmeWebsiteTemplateConfig.business,
        services: [{ id: "unsafe id", name: "A", description: "Too short" }],
      },
    }).success).toBe(false);
    expect(smeWebsiteTemplateConfigSchema.safeParse({
      business: defaultSmeWebsiteTemplateConfig.business,
      script: "alert(1)",
    }).success).toBe(false);
  });

  it("creates page-specific SEO and excludes disabled or unconfigured privacy pages", () => {
    const config = smeWebsiteTemplateConfigSchema.parse({
      website: {
        seo: { title: "Harbour Repairs", description: "Local repair services." },
      },
      business: {
        ...defaultSmeWebsiteTemplateConfig.business,
        name: "Harbour Repairs",
        privacyNotice: "We only use contact details to respond to a request. This policy explains how information is retained.",
      },
    });

    expect(getSmePageMetadata(config, "services")).toMatchObject({
      title: "Services | Harbour Repairs",
      description: "Local repair services.",
      noindex: false,
    });
    expect(getSmePageMetadata(defaultSmeWebsiteTemplateConfig, "privacy")).toMatchObject({
      title: "Page not available",
      noindex: true,
    });
  });

  it("keeps enquiry posts on a same-site endpoint", () => {
    expect(getSmeEnquiryEndpoint()).toBe("/v1/public/site/enquiries");
    expect(getSmeEnquiryEndpoint("/custom/enquiry-route")).toBe("/custom/enquiry-route");
    expect(getSmeEnquiryEndpoint("https://outside.example/collect")).toBe("/v1/public/site/enquiries");
    expect(getSmeEnquiryEndpoint("//outside.example/collect")).toBe("/v1/public/site/enquiries");
  });

  it("shows enquiry collection only when the module and a published privacy page are available", () => {
    const policy = "We use your contact details only to respond and remove them after the stated retention period.";
    const configured = smeWebsiteTemplateConfigSchema.parse({
      business: { ...defaultSmeWebsiteTemplateConfig.business, privacyNotice: policy },
    });
    const missingNotice = smeWebsiteTemplateConfigSchema.parse({ business: defaultSmeWebsiteTemplateConfig.business });
    const hiddenPrivacyPage = smeWebsiteTemplateConfigSchema.parse({
      website: {
        pages: defaultSmeWebsiteTemplateConfig.website.pages.map((page) => page.id === "privacy" ? { ...page, enabled: false } : page),
      },
      business: { ...defaultSmeWebsiteTemplateConfig.business, privacyNotice: policy },
    });

    expect(isSmeEnquiryCollectionAvailable(configured, true)).toBe(true);
    expect(isSmeEnquiryCollectionAvailable(configured, false)).toBe(false);
    expect(isSmeEnquiryCollectionAvailable(missingNotice, true)).toBe(false);
    expect(isSmeEnquiryCollectionAvailable(hiddenPrivacyPage, true)).toBe(false);
  });

  it("keeps two tenants independently branded through the same template configuration", () => {
    const tenantA = smeWebsiteTemplateConfigSchema.parse({
      website: { branding: { primaryColor: "#1d4ed8" } },
      business: { ...defaultSmeWebsiteTemplateConfig.business, name: "Harbour Repairs" },
    });
    const tenantB = smeWebsiteTemplateConfigSchema.parse({
      website: { branding: { primaryColor: "#166534" } },
      business: { ...defaultSmeWebsiteTemplateConfig.business, name: "Maji Works" },
    });

    expect([tenantA.business.name, tenantA.website.branding.primaryColor]).toEqual(["Harbour Repairs", "#1d4ed8"]);
    expect([tenantB.business.name, tenantB.website.branding.primaryColor]).toEqual(["Maji Works", "#166534"]);
  });
});
