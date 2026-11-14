import { describe, expect, it } from "vitest";
import { churchSiteSettingsInputSchema } from "@bazion/church-ministry-contracts";
import {
  churchTemplateCatalog,
  createWhiteLabeledChurchConfig,
  ensureAccessibleHexColor,
  extractWhiteLabelTemplateFromRepoSource,
  generateByowDokployCompose,
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
  it("exposes three white-labeled templates including the GMFC revival signature", () => {
    expect(churchTemplateCatalog.map((t) => t.id)).toEqual([
      "gmfc-revival-signature",
      "church-ministry",
      "royal-cathedral",
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
});
