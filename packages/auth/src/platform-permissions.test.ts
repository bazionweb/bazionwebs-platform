import { describe, expect, it } from "vitest";
import {
  canAccessPlatformPermission,
  getPlatformPermissions,
  platformPermissions,
} from "./security-policy.js";

describe("platform permission contract", () => {
  it("grants the owner the complete declared permission catalogue", () => {
    expect(getPlatformPermissions("platform_owner")).toEqual(platformPermissions);
  });

  it("keeps platform administrators away from owner-only destructive and ownership actions", () => {
    expect(canAccessPlatformPermission("platform_admin", "tenant.create")).toBe(true);
    expect(canAccessPlatformPermission("platform_admin", "tenant.suspend")).toBe(true);
    expect(canAccessPlatformPermission("platform_admin", "tenant.close")).toBe(false);
    expect(canAccessPlatformPermission("platform_admin", "tenant.owner.assign")).toBe(false);
  });

  it("limits support to read-only platform operations", () => {
    expect(canAccessPlatformPermission("platform_support", "tenant.list")).toBe(true);
    expect(canAccessPlatformPermission("platform_support", "audit.read")).toBe(true);
    expect(canAccessPlatformPermission("platform_support", "tenant.update")).toBe(false);
    expect(canAccessPlatformPermission("platform_support", "tenant.suspend")).toBe(false);
    expect(canAccessPlatformPermission("platform_support", "tenant.modules.update")).toBe(false);
  });

  it("does not treat client organization roles as platform roles", () => {
    for (const role of ["owner", "admin", "member", "catalogManager", "orderManager", "viewer", ""]) {
      expect(getPlatformPermissions(role)).toEqual([]);
      expect(canAccessPlatformPermission(role, "tenant.list")).toBe(false);
    }
  });

  it("denies unknown permissions and missing roles", () => {
    expect(canAccessPlatformPermission("platform_owner", "tenant.delete")).toBe(false);
    expect(canAccessPlatformPermission(null, "platform.overview.read")).toBe(false);
    expect(canAccessPlatformPermission(undefined, "platform.overview.read")).toBe(false);
  });
});
