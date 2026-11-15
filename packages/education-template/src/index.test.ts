import { describe, expect, it } from "vitest";
import {
  bmiUniversityTenantConfig,
  bemiTrainingInstituteTenantConfig,
  createWhiteLabeledEducationConfig,
  PROGRAMS,
} from "./index.js";

describe("@bazion/education-template", () => {
  it("exports canonical BMI and BEMI defaults alongside program catalog", () => {
    expect(bmiUniversityTenantConfig.shortName).toBe("BMI University");
    expect(bemiTrainingInstituteTenantConfig.shortName).toBe("BEMI Institute");
    expect(PROGRAMS.length).toBeGreaterThanOrEqual(10);
  });

  it("supports white-labeled non-BMI institutions without brand leakage", () => {
    const custom = createWhiteLabeledEducationConfig({
      tenantSlug: "oxford-imperial-university",
      institutionName: "Oxford Imperial University",
      shortName: "Oxford Imperial",
    });

    expect(custom.portalConfig.institutionName).toBe("Oxford Imperial University");
    expect(JSON.stringify(custom)).not.toContain("Bethel Ministries");
    expect(JSON.stringify(custom)).not.toContain("BEMI");
  });
});

