import { describe, expect, it } from "vitest";
import { parseOrganizationRoles, rolePermissionMap } from "./permissions.js";

describe("Bazion organization role policy", () => {
  it("parses Better Auth multi-role values without empty roles", () => {
    expect(parseOrganizationRoles("admin,orderManager")).toEqual(["admin", "orderManager"]);
    expect(parseOrganizationRoles("")).toEqual([]);
    expect(parseOrganizationRoles(null)).toEqual([]);
  });

  it("keeps catalog managers away from orders and organization settings", () => {
    expect(rolePermissionMap.catalogManager.product).toContain("update");
    expect("order" in rolePermissionMap.catalogManager).toBe(false);
    expect("organization" in rolePermissionMap.catalogManager).toBe(false);
  });

  it("grants order managers only order and customer read capabilities", () => {
    expect(rolePermissionMap.orderManager.order).toEqual(["read", "update"]);
    expect(rolePermissionMap.orderManager.customer).toEqual(["read"]);
    expect("product" in rolePermissionMap.orderManager).toBe(false);
  });

  it("keeps viewers read-only", () => {
    for (const permissions of Object.values(rolePermissionMap.viewer)) {
      expect(permissions.every((action) => action === "read")).toBe(true);
    }
  });

  it("reserves organisation settings and refunds for client owners", () => {
    expect(rolePermissionMap.owner.organization).toContain("update");
    expect("organization" in rolePermissionMap.admin).toBe(false);
    expect(rolePermissionMap.owner.order).toContain("refund");
    expect(rolePermissionMap.admin.order).not.toContain("refund");
  });
});
