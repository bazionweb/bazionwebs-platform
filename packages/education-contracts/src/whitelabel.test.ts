import { describe, expect, it } from "vitest";
import {
  bmiUniversityTenantConfig,
  bemiTrainingInstituteTenantConfig,
  createWhiteLabeledEducationConfig,
  schoolPortalConfigSchema,
} from "./whitelabel.js";

describe("white-label education contracts", () => {
  it("validates canonical BMI University and BEMI Training Institute tenant configs", () => {
    expect(() => schoolPortalConfigSchema.parse(bmiUniversityTenantConfig)).not.toThrow();
    expect(() => schoolPortalConfigSchema.parse(bemiTrainingInstituteTenantConfig)).not.toThrow();
    expect(bmiUniversityTenantConfig.shortName).toBe("BMI University");
    expect(bemiTrainingInstituteTenantConfig.shortName).toBe("BEMI Institute");
  });

  it("generates a 100% white-labeled school configuration with zero BMI or BEMI literals", () => {
    const output = createWhiteLabeledEducationConfig({
      tenantSlug: "oxford-grace-seminary",
      institutionName: "Oxford Grace Theological Seminary",
      shortName: "Oxford Grace",
      legalEntityName: "Oxford Grace Educational Trust",
      tagline: "Equipping Global Scholars for Transformational Service",
      description:
        "An accredited theological seminary dedicated to rigorous scholarship and ethical leadership.",
      email: "admissions@oxfordgrace.example.edu",
      phone: "+44 1865 555123",
      address: "14 High Street, Oxford, United Kingdom",
      primaryColor: "#1B365D",
      accentColor: "#B48327",
      logoUrl: "/assets/oxford-grace-crest.svg",
      founderName: "Dr. Eleanor Vance",
      accreditationLabel: "UK Quality Assured Higher Education",
      leadership: [
        {
          name: "Dr. Eleanor Vance",
          role: "Chancellor, Oxford Grace",
          img: "/assets/chancellor.jpg",
        },
      ],
      trustees: ["Dr. Eleanor Vance, Chair", "Prof. Arthur Pendelton, Trustee"],
      faculty: ["Dr. Eleanor Vance, Systematic Theology", "Prof. Clara Hughes, Ethics"],
    });

    expect(() => schoolPortalConfigSchema.parse(output.portalConfig)).not.toThrow();

    const serialized = JSON.stringify(output).toLowerCase();
    expect(serialized).not.toContain("bmi");
    expect(serialized).not.toContain("bemi");
    expect(serialized).not.toContain("bethel");
    expect(serialized).not.toContain("mukurweini");
    expect(serialized).not.toContain("mukurwe-ini");
    expect(serialized).not.toContain("cookhorne");
    expect(serialized).not.toContain("githinji");
    expect(serialized).not.toContain("bmiuniversities.org");

    expect(output.portalConfig.institutionName).toBe("Oxford Grace Theological Seminary");
    expect(output.portalConfig.shortName).toBe("Oxford Grace");
    expect(output.portalConfig.contact.admissionsEmail).toBe("admissions@oxfordgrace.example.edu");
    expect(output.portalConfig.branding.logoUrl).toBe("/assets/oxford-grace-crest.svg");
  });
});

