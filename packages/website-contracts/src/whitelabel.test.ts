import { describe, expect, it } from "vitest";
import { websiteColorSchema } from "./index.js";
import {
  createWhiteLabeledPackageConfig,
  ensureAccessibleHexColor,
  extractWhiteLabelFromRepoSource,
  generateByowDokployCompose,
  platformWhiteLabelPackageCatalog,
} from "./whitelabel.js";

describe("universal multi-package white-labeling engine", () => {
  it("covers all 9 Bazion platform packages with valid WebsiteConfiguration templates", () => {
    expect(platformWhiteLabelPackageCatalog.map((p) => p.packageId)).toEqual([
      "sme-website",
      "ecommerce",
      "professional-services",
      "clinic-management",
      "school-education",
      "ngo-membership",
      "startup-saas",
      "enterprise-erp",
      "church-ministry",
    ]);

    for (const pkg of platformWhiteLabelPackageCatalog) {
      const output = createWhiteLabeledPackageConfig({
        packageId: pkg.packageId,
        tenantSlug: `demo-${pkg.packageId}`,
        brandName: `Demo ${pkg.name}`,
      });
      expect(output.website.pages.some((p) => p.id === "home" && p.path === "/")).toBe(true);
      expect(output.assignableModules.length).toBeGreaterThan(0);
    }
  });

  it("normalizes light hex colors to satisfy >= 4.5:1 WCAG contrast on white", () => {
    const normalized = ensureAccessibleHexColor("#F59E0B", "#0F766E");
    expect(() => websiteColorSchema.parse(normalized)).not.toThrow();
  });

  it("white-labels an SME / E-Commerce repo and scrubs source company literals", () => {
    const result = extractWhiteLabelFromRepoSource({
      repoUrl: "https://github.com/vendor/kibo-storefront",
      configSource: `
        export const STORE_CONFIG = {
          storeName: "Kibo Roasters Ltd",
          tagline: "Artisan Coffee Delivered Daily",
          email: "orders@kiboroasters.example",
          paybill: "888222",
          instagram: "https://instagram.com/kiboroasters"
        };
      `,
      styleSource: `
        :root {
          --color-primary: #2D1A12;
          --color-accent: #F59E0B;
        }
      `,
      packageJson: JSON.stringify({
        dependencies: { next: "16.4.5", react: "19.2.0" },
      }),
      targetBrand: {
        tenantSlug: "savanna-greens",
        brandName: "Savanna Organic Greens",
        tagline: "Fresh Farm Produce Across Nairobi",
        contact: { email: "hello@savannagreens.example", phones: ["+254 712 000999"] },
        payment: { mpesaPaybill: "410410", accountNo: "SAVANNA" },
      },
    });

    expect(result.inferredPackageId).toBe("ecommerce");
    expect(result.detectedFramework).toBe("nextjs");
    expect(result.detectedSourceBrand.brandName).toBe("Kibo Roasters Ltd");
    expect(result.detectedSourceBrand.paybill).toBe("888222");

    const cleanSerialized = JSON.stringify(result.generated).toLowerCase();
    expect(cleanSerialized).not.toContain("kibo roasters");
    expect(cleanSerialized).not.toContain("orders@kiboroasters");
    expect(cleanSerialized).not.toContain("888222");
    expect(result.generated.packageSettings.organization.name).toBe("Savanna Organic Greens");
    expect(result.generated.packageSettings.payment.mpesaPaybill).toBe("410410");
  });

  it("auto-infers ecommerce and clinic packages from imported repo source", () => {
    const shop = extractWhiteLabelFromRepoSource({
      repoUrl: "https://github.com/acme/nextjs-ecommerce-cart",
      configSource: 'export const SHOP = { name: "Acme Retail", productCatalog: true };',
      targetBrand: { tenantSlug: "nova-mart", brandName: "Nova Mart" },
    });
    expect(shop.inferredPackageId).toBe("ecommerce");

    const clinic = extractWhiteLabelFromRepoSource({
      repoUrl: "https://github.com/acme/clinic-portal",
      configSource: 'export const CLINIC = { clinicName: "City Medical", patientPortal: true };',
      targetBrand: { tenantSlug: "haven-clinic", brandName: "Haven Family Clinic" },
    });
    expect(clinic.inferredPackageId).toBe("clinic-management");
  });

  it("generates package-tagged Dokploy BYOW compose blueprints for any package", () => {
    const blueprint = generateByowDokployCompose({
      tenantId: "00000000-0000-4000-8000-000000000077",
      tenantSlug: "apex-advisory",
      packageId: "professional-services",
      primaryDomain: "apex.example.com",
      repoUrl: "https://github.com/apex/website",
      framework: "astro",
    });

    expect(blueprint.packageId).toBe("professional-services");
    expect(blueprint.internalPort).toBe(80);
    expect(blueprint.composeYaml).toContain('com.bazion.package.id=professional-services');
    expect(blueprint.composeYaml).toContain('GIT_REPO_URL: "https://github.com/apex/website"');
  });
});
