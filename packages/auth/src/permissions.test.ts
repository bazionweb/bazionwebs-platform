import { describe, expect, it } from "vitest";
import { parseOrganizationRoles, rolePermissionMap } from "./permissions.js";

describe("Bazion organization role policy", () => {
  it("parses Better Auth multi-role values without empty roles", () => {
    expect(parseOrganizationRoles("admin,orderManager")).toEqual(["admin", "orderManager"]);
    expect(parseOrganizationRoles("")).toEqual([]);
    expect(parseOrganizationRoles(["admin", "orderManager"])).toEqual(["admin", "orderManager"]);
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

  it("restricts enquiry access, export and deletion to tenant owners and admins", () => {
    expect(rolePermissionMap.owner.enquiry).toEqual(["read", "export", "delete"]);
    expect(rolePermissionMap.admin.enquiry).toEqual(["read", "export", "delete"]);
    expect("enquiry" in rolePermissionMap.viewer).toBe(false);
    expect("enquiry" in rolePermissionMap.contentEditor).toBe(false);
    expect(rolePermissionMap.owner.enquiryPolicy).toEqual(["read", "update"]);
    expect(rolePermissionMap.admin.enquiryPolicy).toEqual(["read", "update"]);
    expect("enquiryPolicy" in rolePermissionMap.viewer).toBe(false);
  });
});
