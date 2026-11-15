import { describe, expect, it } from "vitest";
import {
  createWhiteLabeledPackageConfig,
  extractWhiteLabelFromRepoSource,
  platformWhiteLabelPackageCatalog,
} from "./whitelabel.js";

describe("white-label education templates and repo import", () => {
  it("provides oxford-imperial-university template with clean white-label metadata", () => {
    const educationPkg = platformWhiteLabelPackageCatalog.find((p) => p.packageId === "school-education");
    expect(educationPkg).toBeDefined();

    const oxfordTemplate = educationPkg?.templates.find((t) => t.id === "oxford-imperial-university");
    expect(oxfordTemplate).toBeDefined();
    expect(oxfordTemplate?.name).toBe("Higher Education & University Campus");

    const config = createWhiteLabeledPackageConfig({
      packageId: "school-education",
      templateId: "oxford-imperial-university",
      tenantSlug: "heritage-college",
      brandName: "Heritage International College",
      tagline: "Inspiring Leadership & Academic Excellence",
    });

    expect(config.packageSettings.packageId).toBe("school-education");
    expect(config.packageSettings.templateId).toBe("oxford-imperial-university");
    expect(config.packageSettings.organization.name).toBe("Heritage International College");
    expect(config.packageSettings.organization.tagline).toBe("Inspiring Leadership & Academic Excellence");

    const serialized = JSON.stringify(config).toLowerCase();
    expect(serialized).not.toContain("bmi");
    expect(serialized).not.toContain("bemi");
    expect(serialized).not.toContain("bible missionary");
  });

  it("infers school-education from @bmi/shared and strips BMI/BEMI brand literals", () => {
    const result = extractWhiteLabelFromRepoSource({
      repoUrl: "https://github.com/bmi-institute/bmi-university",
      configSource: `
        export const SITE = {
          fullName: "Bible Missionary Institute",
          shortName: "BMI",
          tagline: "Biblical & Executive Leadership",
          contactEmail: "info@bmi.ac.ke",
          phones: ["+254 700 000000"]
        };
      `,
      styleSource: `
        :root {
          --color-primary: #1A365D;
          --color-accent: #C5A059;
        }
      `,
      packageJson: JSON.stringify({
        name: "bmi-university",
        dependencies: {
          "@bmi/shared": "workspace:*",
          next: "15.0.0",
        },
      }),
      targetBrand: {
        tenantSlug: "savanna-academy",
        brandName: "Savanna Modern Academy",
        tagline: "Excellence in 21st Century Education",
      },
    });

    expect(result.inferredPackageId).toBe("school-education");
    expect(result.detectedSourceBrand.brandName).toBe("Bible Missionary Institute");

    const cleanSerialized = JSON.stringify(result.generated).toLowerCase();
    expect(cleanSerialized).not.toContain("bible missionary");
    expect(cleanSerialized).not.toContain("info@bmi.ac.ke");
    expect(result.generated.packageSettings.organization.name).toBe("Savanna Modern Academy");
  });

  it("supports assigning education modules on school-education package", () => {
    const educationPkg = platformWhiteLabelPackageCatalog.find((p) => p.packageId === "school-education");
    expect(educationPkg?.assignableModules).toContain("forms-leads");
    expect(educationPkg?.assignableModules).toContain("media-storage");
  });
});
