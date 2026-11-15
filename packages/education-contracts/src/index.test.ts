import { describe, expect, it } from "vitest";
import {
  bmiUniversityTenantConfig,
  bemiTrainingInstituteTenantConfig,
  createWhiteLabeledEducationConfig,
  PROGRAMS,
} from "./index.js";

describe("@bazion/education-contracts index and whitelabel", () => {
  it("exports canonical BMI and BEMI configuration", () => {
    expect(bmiUniversityTenantConfig.shortName).toBe("BMI University");
    expect(bemiTrainingInstituteTenantConfig.shortName).toBe("BEMI Institute");
    expect(PROGRAMS.length).toBeGreaterThanOrEqual(10);
  });

  it("creates clean white-labeled configurations without brand leakage", () => {
    const config = createWhiteLabeledEducationConfig({
      tenantSlug: "oxford-imperial-university",
      institutionName: "Oxford Imperial University",
    });
    expect(config.portalConfig.institutionName).toBe("Oxford Imperial University");
    expect(JSON.stringify(config)).not.toContain("Bethel Ministries");
    expect(JSON.stringify(config)).not.toContain("BEMI");
  });
});

