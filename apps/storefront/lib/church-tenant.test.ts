import { describe, expect, it } from "vitest";
import {
  HKM_CHURCH_TENANT_ID,
  isHkmHost,
  resolveChurchTenantFromContext,
} from "./church-tenant";

describe("church-tenant resolution", () => {
  it("recognizes HKM domains and subdomains", () => {
    expect(isHkmHost("hkm.localhost:3100")).toBe(true);
    expect(isHkmHost("admin.hkmministries.org")).toBe(true);
    expect(isHkmHost("hkmministries.org")).toBe(true);
    expect(isHkmHost("www.hkmministries.org")).toBe(true);
    expect(isHkmHost("hkm-ministries.localhost")).toBe(true);
    expect(isHkmHost("bmi.localhost:3100")).toBe(false);
    expect(isHkmHost("example.com")).toBe(false);
  });

  it("resolves HKM tenant from context header, cookie, or default environment", () => {
    const fromHost = resolveChurchTenantFromContext({ host: "hkm.localhost:3100" });
    expect(fromHost.isHkm).toBe(true);
    expect(fromHost.tenantId).toBe(HKM_CHURCH_TENANT_ID);
    expect(fromHost.tenantConfig.churchName).toContain("HKM");

    const fromHeader = resolveChurchTenantFromContext({ tenantHeader: "hkm" });
    expect(fromHeader.isHkm).toBe(true);

    const fromEnv = resolveChurchTenantFromContext({ defaultTenantId: HKM_CHURCH_TENANT_ID });
    expect(fromEnv.isHkm).toBe(true);

    const nonHkm = resolveChurchTenantFromContext({ host: "other.com" });
    expect(nonHkm.isHkm).toBe(false);
  });
});

