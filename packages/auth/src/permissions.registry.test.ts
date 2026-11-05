import { describe, expect, it } from "vitest";
import permissionRegistry from "../../../products/permissions.json" with { type: "json" };
import { rolePermissionMap, statement } from "./permissions.js";

describe("central permission registry adapter", () => {
  it("keeps Better Auth's static access-control statement aligned with module-owned permission declarations", () => {
    const expected: Record<string, string[]> = {};
    for (const permission of permissionRegistry.permissions) {
      expected[permission.resource] ??= [];
      if (!expected[permission.resource]!.includes(permission.action)) {
        expected[permission.resource]!.push(permission.action);
      }
    }
    for (const actions of Object.values(expected)) actions.sort();
    const actual = Object.fromEntries(
      Object.entries(statement).map(([resource, actions]) => [resource, [...actions].sort()]),
    );
    expect(actual).toEqual(expected);
  });

  it("keeps every role grant aligned with the central registry", () => {
    for (const role of permissionRegistry.roles) {
      const expected: Record<string, string[]> = {};
      for (const permission of permissionRegistry.permissions) {
        if (!permission.roles.includes(role)) continue;
        expected[permission.resource] ??= [];
        expected[permission.resource]!.push(permission.action);
      }
      for (const actions of Object.values(expected)) actions.sort();

      const actual = Object.fromEntries(
        Object.entries(rolePermissionMap[role as keyof typeof rolePermissionMap])
          .map(([resource, actions]) => [resource, [...actions].sort()]),
      );
      expect(actual).toEqual(expected);
    }
  });
});
