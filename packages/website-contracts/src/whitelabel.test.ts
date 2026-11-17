import { describe, expect, it } from "vitest";
import { websiteColorSchema } from "./index.js";
import {
  createWhiteLabeledPackageConfig,
  deepMergeCascade,
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

  describe("deepMergeCascade (Sparse Delta Prototype Inheritance)", () => {
    it("merges keyed arrays by id, inheriting new template items and preserving custom tenant items", () => {
      const templateBasePages = [
        { id: "home", path: "/", title: "Template Home", enabled: true, sections: ["hero", "text"] },
        { id: "about", path: "/about", title: "Template About", enabled: true, sections: ["hero", "team"] },
        { id: "live", path: "/live", title: "Template Live Broadcast", enabled: true, sections: ["hero", "media"] }, // NEWLY ADDED TO TEMPLATE
      ];

      const tenantOverrides = [
        { id: "home", title: "Custom Tenant Sanctuary Home" },
        { id: "custom-page", path: "/giving-drive", title: "Giving Drive", enabled: true, sections: ["text"] }, // TENANT CUSTOM
      ];

      const result = deepMergeCascade(templateBasePages, tenantOverrides);

      expect(result).toHaveLength(4);
      // Home has tenant title but preserved template path, enabled, and sections
      expect(result.find((p) => p.id === "home")).toEqual({
        id: "home",
        path: "/",
        title: "Custom Tenant Sanctuary Home",
        enabled: true,
        sections: ["hero", "text"],
      });
      // About is untouched from template
      expect(result.find((p) => p.id === "about")).toEqual(templateBasePages[1]);
      // Live is automatically inherited from template without touching tenant DB
      expect(result.find((p) => p.id === "live")).toEqual(templateBasePages[2]);
      // Tenant's custom page is preserved
      expect(result.find((p) => p.id === "custom-page")).toEqual(tenantOverrides[1]);
    });

    it("deeply merges nested objects, preserving template defaults when tenant overrides are sparse", () => {
      const baseTheme = {
        preset: "maroon-gold",
        headerStyle: "classic",
        heroStyle: "rotator",
        cardStyle: "rounded",
        fontPairing: "outfit-inter",
        branding: {
          primaryColor: "#4A1110",
          secondaryColor: "#6B1A18",
          accentColor: "#B45E14",
        },
      };

      const tenantSparseOverrides = {
        heroStyle: "centered-bold",
        branding: {
          primaryColor: "#16A34A",
        },
      };

      const result = deepMergeCascade(baseTheme, tenantSparseOverrides);

      expect(result).toEqual({
        preset: "maroon-gold",
        headerStyle: "classic",
        heroStyle: "centered-bold", // Overridden
        cardStyle: "rounded",
        fontPairing: "outfit-inter",
        branding: {
          primaryColor: "#16A34A", // Overridden
          secondaryColor: "#6B1A18", // Inherited from template
          accentColor: "#B45E14", // Inherited from template
        },
      });
    });

    it("replaces non-keyed arrays when tenant provides an explicit list, and preserves base when omitted", () => {
      const baseConfig = {
        rotatorWords: ["Worship", "Community", "Discipleship"],
        sampleTags: ["faith", "prayer"],
      };

      const withCustomRotator = deepMergeCascade(baseConfig, {
        rotatorWords: ["Faith", "Victory"],
      });
      expect(withCustomRotator.rotatorWords).toEqual(["Faith", "Victory"]);
      expect(withCustomRotator.sampleTags).toEqual(["faith", "prayer"]);

      const withOmittedRotator = deepMergeCascade(baseConfig, {
        sampleTags: ["missions"],
      });
      // Omitted array preserves template defaults
      expect(withOmittedRotator.rotatorWords).toEqual(["Worship", "Community", "Discipleship"]);
      expect(withOmittedRotator.sampleTags).toEqual(["missions"]);

      const withEmptyRotator = deepMergeCascade(baseConfig, {
        rotatorWords: [],
      });
      // Explicit empty array is honored
      expect(withEmptyRotator.rotatorWords).toEqual([]);
    });
  });
});
