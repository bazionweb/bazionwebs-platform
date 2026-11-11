import { describe, expect, it } from "vitest";
import { defaultSmeWebsiteTemplateConfig, smeWebsiteTemplateConfigSchema } from "./config.js";
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
});
