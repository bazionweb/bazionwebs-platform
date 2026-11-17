import { describe, it, expect } from "vitest";
import { resolveEducationTenantFromContext } from "./education-tenant";
import {
  BMI_UNIVERSITY_TENANT_ID,
  BEMI_INSTITUTE_TENANT_ID,
  BMI_LEGACY_TENANT_ID,
  BEMI_LEGACY_TENANT_ID,
} from "@bazion/education-contracts";

describe("resolveEducationTenantFromContext - Domain Assignment & Isolation", () => {
  describe("Local Development Naked Loopback (http://localhost:3100)", () => {
    it("resolves to BMI University when running under pnpm dev:bmi (envTenantId: 'bmi')", () => {
      const result = resolveEducationTenantFromContext({
        host: "localhost:3100",
        envTenantId: "bmi",
        defaultTenantId: BMI_UNIVERSITY_TENANT_ID,
      });

      expect(result.isEducation).toBe(true);
      expect(result.isBemi).toBe(false);
      expect(result.tenantConfig.institutionName).toContain("Bethel");
      expect(result.tenantConfig.shortName).toBe("BMI University");
    });

    it("resolves to BEMI Institute when running under pnpm dev:bemi (envTenantId: 'bemi')", () => {
      const result = resolveEducationTenantFromContext({
        host: "localhost:3100",
        envTenantId: "bemi",
        defaultTenantId: BEMI_INSTITUTE_TENANT_ID,
      });

      expect(result.isEducation).toBe(true);
      expect(result.isBemi).toBe(true);
      expect(result.tenantConfig.institutionName).toContain("BEMI");
    });

    it("resolves to BMI University when defaultTenantId matches canonical BMI ID", () => {
      const result = resolveEducationTenantFromContext({
        host: "localhost:3100",
        defaultTenantId: BMI_UNIVERSITY_TENANT_ID,
      });

      expect(result.isEducation).toBe(true);
      expect(result.isBemi).toBe(false);
    });

    it("resolves to BEMI Institute when defaultTenantId matches canonical BEMI ID", () => {
      const result = resolveEducationTenantFromContext({
        host: "localhost:3100",
        defaultTenantId: BEMI_INSTITUTE_TENANT_ID,
      });

      expect(result.isEducation).toBe(true);
      expect(result.isBemi).toBe(true);
    });

    it("resolves to legacy IDs for backwards compatibility", () => {
      const legacyBmi = resolveEducationTenantFromContext({
        host: "localhost:3100",
        defaultTenantId: BMI_LEGACY_TENANT_ID,
      });
      expect(legacyBmi.isEducation).toBe(true);
      expect(legacyBmi.isBemi).toBe(false);

      const legacyBemi = resolveEducationTenantFromContext({
        host: "localhost:3100",
        defaultTenantId: BEMI_LEGACY_TENANT_ID,
      });
      expect(legacyBemi.isEducation).toBe(true);
      expect(legacyBemi.isBemi).toBe(true);
    });

    it("does NOT resolve to education when running church/ministry or commerce tenant", () => {
      const result = resolveEducationTenantFromContext({
        host: "localhost:3100",
        defaultTenantId: "7a80eaae-6f8c-44c1-b22a-3dca458f0ec1", // GMFC Church
      });

      expect(result.isEducation).toBe(false);
      expect(result.isBemi).toBe(false);
    });
  });

  describe("Development Subdomain Isolation (*.localhost:3100)", () => {
    it("resolves bmi.localhost:3100 to BMI University regardless of server default", () => {
      const result = resolveEducationTenantFromContext({
        host: "bmi.localhost:3100",
        envTenantId: "bemi", // Even if server default was BEMI
      });

      expect(result.isEducation).toBe(true);
      expect(result.isBemi).toBe(false);
      expect(result.tenantConfig.institutionName).toContain("Bethel");
      expect(result.tenantConfig.shortName).toBe("BMI University");
    });

    it("resolves bemi.localhost:3100 to BEMI Institute regardless of server default", () => {
      const result = resolveEducationTenantFromContext({
        host: "bemi.localhost:3100",
        envTenantId: "bmi", // Even if server default was BMI
      });

      expect(result.isEducation).toBe(true);
      expect(result.isBemi).toBe(true);
      expect(result.tenantConfig.institutionName).toContain("BEMI");
    });

    it("resolves aliases bmi-university.localhost and bemi-institute.localhost", () => {
      const bmiAlias = resolveEducationTenantFromContext({ host: "bmi-university.localhost:3100" });
      expect(bmiAlias.isEducation).toBe(true);
      expect(bmiAlias.isBemi).toBe(false);

      const bemiAlias = resolveEducationTenantFromContext({ host: "bemi-institute.localhost:3100" });
      expect(bemiAlias.isEducation).toBe(true);
      expect(bemiAlias.isBemi).toBe(true);
    });
  });

  describe("Interactive Header and Cookie Overrides (?tenant=...)", () => {
    it("prioritizes x-bazion-tenant header for on-the-fly tenant switching", () => {
      const result = resolveEducationTenantFromContext({
        host: "localhost:3100",
        tenantHeader: "bemi",
        envTenantId: "bmi",
      });

      expect(result.isEducation).toBe(true);
      expect(result.isBemi).toBe(true);
    });

    it("prioritizes bazion_tenant cookie for user session persistence", () => {
      const result = resolveEducationTenantFromContext({
        host: "localhost:3100",
        tenantCookie: "bmi",
        envTenantId: "bemi",
      });

      expect(result.isEducation).toBe(true);
      expect(result.isBemi).toBe(false);
    });
  });

  describe("Production Custom Domain Isolation", () => {
    it("maps canonical Kenyan and global BMI domains to BMI University", () => {
      const domains = [
        "bmi.ac.ke",
        "www.bmi.ac.ke",
        "university.bmi.ac.ke",
        "portal.bmi.ac.ke",
        "ums.bmi.ac.ke",
        "verify.bmi.ac.ke",
        "bmiuniversities.org",
        "www.bmiuniversities.org",
        "bmi-university.pages.dev",
      ];

      for (const domain of domains) {
        const result = resolveEducationTenantFromContext({ host: domain });
        expect(result.isEducation, `Expected ${domain} to be education`).toBe(true);
        expect(result.isBemi, `Expected ${domain} not to be BEMI`).toBe(false);
        expect(result.tenantConfig.institutionName).toContain("Bethel");
        expect(result.tenantConfig.shortName).toBe("BMI University");
      }
    });

    it("maps canonical BEMI domains to BEMI Training Institute", () => {
      const domains = [
        "bemi.org",
        "www.bemi.org",
        "institute.bemi.org",
        "portal.bemi.org",
        "bemi.ac.ke",
        "bemi-institute.pages.dev",
      ];

      for (const domain of domains) {
        const result = resolveEducationTenantFromContext({ host: domain });
        expect(result.isEducation, `Expected ${domain} to be education`).toBe(true);
        expect(result.isBemi, `Expected ${domain} to be BEMI`).toBe(true);
        expect(result.tenantConfig.institutionName).toContain("BEMI");
      }
    });

    it("rejects non-education domains from resolving to education", () => {
      const domains = [
        "gmfc.org",
        "church.bazionweb.com",
        "shop.example.com",
        "example.com",
      ];

      for (const domain of domains) {
        const result = resolveEducationTenantFromContext({ host: domain });
        expect(result.isEducation, `Expected ${domain} not to be education`).toBe(false);
      }
    });
  });
});
