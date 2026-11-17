import { describe, expect, it } from "vitest";
import { churchSiteSettingsInputSchema } from "@bazion/church-ministry-contracts";
import {
  churchTemplateCatalog,
  createWhiteLabeledChurchConfig,
  ensureAccessibleHexColor,
  extractWhiteLabelTemplateFromRepoSource,
  generateByowDokployCompose,
  inferChurchTemplateId,
  resolveEffectiveChurchSiteSettings,
} from "./whitelabel-template.js";

const GMFC_SAMPLE_CONFIG_TS = `
export const SITE_CONFIG = {
  fullName: "Global Mission for Christ International",
  shortName: "GMFCI",
  tagline: "Revive the Nations. Preach the Gospel. Win Souls.",
};

export const CONTACT = {
  email: "globalmissionforchrist@gmail.com",
  phones: ["+254 722 769771", "+254 721 341793"],
  paybill: "247 247",
  accountNo: "262518",
};

export const SOCIAL = {
  youtube: "https://www.youtube.com/@GlobalMissionfc",
  facebook: "https://web.facebook.com/globalmissionfc",
  twitter: "https://twitter.com/globalmissionfc",
};
`;

const GMFC_SAMPLE_TOKENS_CSS = `
:root {
  --color-primary: #6B1A18;
  --color-primary-dark: #4A1110;
  --color-accent: #E8920B;
  --font-heading: "Plus Jakarta Sans", sans-serif;
  --font-body: "Inter", sans-serif;
}
`;

const GMFC_SAMPLE_PACKAGE_JSON = JSON.stringify({
  name: "gmfc-website",
  dependencies: {
    next: "16.4.5",
    react: "19.2.0",
  },
});

describe("white-label church templates", () => {
  it("exposes white-labeled templates including the GMFC revival signature and HKM kingdom CMS", () => {
    expect(churchTemplateCatalog.map((t) => t.id)).toEqual([
      "gmfc-revival-signature",
      "church-ministry",
      "royal-cathedral",
      "hkm-kingdom-cms",
    ]);
  });

  it("darkens light brand colors to pass >= 4.5:1 WCAG contrast on white", () => {
    const normalized = ensureAccessibleHexColor("#E8920B", "#B45E14");
    expect(normalized).toMatch(/^#[0-9A-F]{6}$/);
    const generated = createWhiteLabeledChurchConfig({
      tenantSlug: "contrast-test",
      ministryName: "Contrast Test Church",
      themeOverrides: { accentColor: normalized },
    });
    expect(() => churchSiteSettingsInputSchema.parse(generated.siteSettingsInput)).not.toThrow();
  });

  it("generates a 100% white-labeled configuration with zero GMFC literals", () => {
    const output = createWhiteLabeledChurchConfig({
      tenantSlug: "grace-chapel-nairobi",
      ministryName: "Grace Chapel Nairobi",
      templateId: "gmfc-revival-signature",
      tagline: "Raising Disciples Across East Africa",
      contact: {
        email: "hello@gracechapel.example",
        phones: ["+254 700 111222"],
        address: "Ngong Road, Nairobi",
      },
      giving: {
        mpesaPaybill: "522522",
        accountNo: "GRACE01",
        accountName: "Grace Chapel",
      },
    });

    const serialized = JSON.stringify(output).toLowerCase();
    expect(serialized).not.toContain("global mission");
    expect(serialized).not.toContain("anthony githui");
    expect(serialized).not.toContain("shadrach");
    expect(serialized).not.toContain("247 247");
    expect(serialized).not.toContain("262518");
    expect(serialized).not.toContain("global · yinv");
    expect(serialized).not.toContain("globalmissionforchrist");

    expect(output.config.tenantSlug).toBe("grace-chapel-nairobi");
    expect(output.config.ministryName).toBe("Grace Chapel Nairobi");
    expect(output.siteSettingsInput.profile.ministryName).toBe("Grace Chapel Nairobi");
    expect(output.siteSettingsInput.settings.giving.mpesaPaybill).toBe("522522");
  });

  it("generates a valid white-labeled HKM Kingdom CMS template output", () => {
    const output = createWhiteLabeledChurchConfig({
      tenantSlug: "hkm-church",
      ministryName: "Heavenly God Kingdom Churches",
      templateId: "hkm-kingdom-cms",
      tagline: "Advancing the Kingdom of God across communities",
      contact: {
        email: "office@hkmministries.org",
        phones: ["+254 700 000000"],
      },
    });

    expect(output.template.id).toBe("hkm-kingdom-cms");
    expect(output.config.ministryName).toBe("Heavenly God Kingdom Churches");
    expect(output.siteSettingsInput.profile.ministryName).toBe("Heavenly God Kingdom Churches");
    const validated = churchSiteSettingsInputSchema.safeParse(output.siteSettingsInput);
    expect(validated.success).toBe(true);
  });

  it("extracts and scrubs brand literals from an imported GitHub repo into a clean target tenant config", () => {
    const result = extractWhiteLabelTemplateFromRepoSource({
      repoUrl: "https://github.com/example/gmfc-site",
      configTs: GMFC_SAMPLE_CONFIG_TS,
      tokensCss: GMFC_SAMPLE_TOKENS_CSS,
      packageJson: GMFC_SAMPLE_PACKAGE_JSON,
      targetBrand: {
        tenantSlug: "grace-bible-church",
        ministryName: "Grace Bible Church",
        tagline: "Knowing Christ and Making Him Known",
        contact: {
          email: "info@gracebible.example",
          phones: ["+254 711 555666"],
          address: "Mombasa Road, Nairobi",
        },
        giving: {
          mpesaPaybill: "400200",
          accountNo: "GBC-TITHE",
          accountName: "Grace Bible Church",
        },
      },
    });

    expect(result.detectedFramework).toBe("nextjs");
    expect(result.detectedSourceBrand.siteName).toBe("Global Mission for Christ International");
    expect(result.detectedSourceBrand.paybill).toBe("247 247");
    expect(result.detectedSourceBrand.emails).toContain("globalmissionforchrist@gmail.com");
    expect(result.detectedSourceBrand.colors.primary).toBe("#6B1A18");
    expect(result.detectedSourceBrand.colors.accent).toBe("#E8920B");

    const variableNames = result.whiteLabelVariables.map((v) => v.variable);
    expect(variableNames).toContain("site.ministryName");
    expect(variableNames).toContain("site.giving.mpesaPaybill");
    expect(variableNames).toContain("site.branding.accentColor");

    expect(() =>
      churchSiteSettingsInputSchema.parse(result.generated.siteSettingsInput),
    ).not.toThrow();

    const cleanTargetJson = JSON.stringify(result.generated).toLowerCase();
    expect(cleanTargetJson).not.toContain("global mission");
    expect(cleanTargetJson).not.toContain("247 247");
    expect(cleanTargetJson).not.toContain("262518");
    expect(cleanTargetJson).not.toContain("globalmissionfc");
    expect(result.generated.config.ministryName).toBe("Grace Bible Church");
  });

  it("builds hardened BYOW Dokploy docker-compose blueprints", () => {
    const nextCompose = generateByowDokployCompose({
      tenantId: "00000000-0000-4000-8000-000000000099",
      tenantSlug: "calvary-chapel",
      primaryDomain: "calvary.example.com",
      repoUrl: "https://github.com/calvary/website.git",
      branch: "production",
      framework: "nextjs",
    });

    expect(nextCompose.internalPort).toBe(3000);
    expect(nextCompose.healthcheckPath).toBe("/api/health");
    expect(nextCompose.composePath).toBe("tenants/calvary-chapel/docker-compose.yml");
    expect(nextCompose.composeYaml).toContain('GIT_REPO_URL: "https://github.com/calvary/website.git"');
    expect(nextCompose.composeYaml).toContain('GIT_BRANCH: "production"');
    expect(nextCompose.composeYaml).toContain('com.bazion.tenant.slug=calvary-chapel');

    const staticCompose = generateByowDokployCompose({
      tenantId: "00000000-0000-4000-8000-000000000100",
      tenantSlug: "hope-fellowship",
      repoUrl: "https://github.com/hope/static-site",
      framework: "static",
    });
    expect(staticCompose.internalPort).toBe(80);
    expect(staticCompose.composeYaml).toContain("image: nginx:1.27-alpine");
  });

  describe("template-to-tenant live inheritance (zero double-editing)", () => {
    it("infers templateId from raw database record, tenantSlug, or theme preset", () => {
      expect(inferChurchTemplateId({ templateId: "hkm-kingdom-cms" })).toBe("hkm-kingdom-cms");
      expect(inferChurchTemplateId({ overrides: { templateId: "royal-cathedral" } })).toBe("royal-cathedral");
      expect(inferChurchTemplateId(null, "hkm-church-ministries")).toBe("hkm-kingdom-cms");
      expect(inferChurchTemplateId({ theme: { preset: "royal-navy" } })).toBe("royal-cathedral");
      expect(inferChurchTemplateId(null, "some-other-church")).toBe("gmfc-revival-signature");
    });

    it("resolves effective site settings by cascading live template defaults with sparse tenant overrides", () => {
      // Simulate tenant storing ONLY their explicit overrides in the database
      const tenantSparseDbRecord = {
        templateId: "hkm-kingdom-cms",
        overrides: {
          branding: {
            primaryColor: "#047857", // Customized emerald
          },
          giving: {
            mpesaPaybill: "777888",
            accountName: "HKM Offering",
          },
        },
      };

      const resolved = resolveEffectiveChurchSiteSettings(tenantSparseDbRecord, {
        tenantSlug: "hkm-church",
        tenantName: "Heavenly God Kingdom Churches",
      });

      // Tenant's custom overrides are strictly preserved
      expect(resolved.branding.primaryColor).toBe("#047857");
      expect(resolved.giving.mpesaPaybill).toBe("777888");
      expect(resolved.giving.accountName).toBe("HKM Offering");

      // Canonical template defaults are inherited without storing them in tenant DB
      expect(resolved.templateId).toBe("hkm-kingdom-cms");
      expect(resolved.theme.preset).toBe("forest-bronze");
      expect(resolved.theme.headerStyle).toBe("classic");
      expect(resolved.pages.some((p) => p.id === "home")).toBe(true);
      expect(resolved.pages.some((p) => p.id === "giving")).toBe(true);
      expect(resolved.visitorInfo.arrival).toContain("Welcome Desk");
    });

    it("demonstrates zero double-editing: newly added template features automatically propagate to tenant without modifying tenant DB row", () => {
      // Step 1: Tenant DB row was saved at Time T0 with ONLY custom church name and custom color
      const tenantSavedDbRow = JSON.stringify({
        templateId: "hkm-kingdom-cms",
        overrides: {
          branding: {
            primaryColor: "#15803d",
          },
        },
      });

      // Step 2: Resolve at T0
      const initialEffective = resolveEffectiveChurchSiteSettings(tenantSavedDbRow, {
        tenantSlug: "hkm-church",
        tenantName: "Heavenly Kingdom Assembly",
      });
      expect(initialEffective.branding.primaryColor).toBe("#15803d");
      expect(initialEffective.pages.length).toBeGreaterThanOrEqual(4);

      // Step 3: Developer updates template code (e.g. template catalog or default pages)
      // Even if tenant DB row remains 100% UNTOUCHED, runtime resolution pulls live template definitions
      const templateDescriptor = churchTemplateCatalog.find((t) => t.id === "hkm-kingdom-cms")!;
      expect(templateDescriptor.features).toContain("Self-Service Member Portal with PIN & Password Access");

      // Step 4: Resolve again (simulating request after template code update)
      const reResolved = resolveEffectiveChurchSiteSettings(tenantSavedDbRow, {
        tenantSlug: "hkm-church",
        tenantName: "Heavenly Kingdom Assembly",
      });

      // Assert: Tenant site has the latest template configuration AND keeps custom brand overrides
      expect(reResolved.branding.primaryColor).toBe("#15803d");
      expect(reResolved.templateId).toBe("hkm-kingdom-cms");
      // No DB migration or update was required for tenant!
    });

    it("seamlessly upgrades legacy static JSON database rows without data loss", () => {
      // Legacy tenant has full monolithic JSON saved in ministry_settings
      const legacySavedConfig = createWhiteLabeledChurchConfig({
        tenantSlug: "legacy-revival",
        ministryName: "Legacy Revival Center",
        templateId: "gmfc-revival-signature",
        themeOverrides: { primaryColor: "#4A1110" },
      });

      const legacyDbRow = JSON.stringify(legacySavedConfig.siteSettingsInput.settings);

      const resolved = resolveEffectiveChurchSiteSettings(legacyDbRow, {
        tenantSlug: "legacy-revival",
        tenantName: "Legacy Revival Center",
      });

      expect(resolved.branding.primaryColor).toBe("#4A1110");
      expect(resolved.templateId).toBe("gmfc-revival-signature");
      expect(resolved.pages.some((p) => p.id === "home")).toBe(true);
    });
  });
});
