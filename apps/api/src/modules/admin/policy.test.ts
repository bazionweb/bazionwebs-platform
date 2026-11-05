import { describe, expect, it } from "vitest";
import {
  clientAssignableRoles,
  invitationInputSchema,
  memberListQuerySchema,
  memberRoleInputSchema,
} from "./policy.js";

describe("client administration input policy", () => {
  it("allows the defined tenant roles but never lets a client assign owner", () => {
    expect(clientAssignableRoles).toEqual([
      "admin", "member", "catalogManager", "orderManager", "contentEditor", "viewer",
    ]);
    expect(memberRoleInputSchema.safeParse({ role: "viewer" }).success).toBe(true);
    expect(memberRoleInputSchema.safeParse({ role: "owner" }).success).toBe(false);
    expect(invitationInputSchema.safeParse({ email: "client@example.test", role: "owner" }).success).toBe(false);
  });

  it("normalizes email whitespace and rejects malformed addresses", () => {
    expect(invitationInputSchema.parse({ email: "  staff@example.test  ", role: "catalogManager" }))
      .toEqual({ email: "staff@example.test", role: "catalogManager" });
    expect(invitationInputSchema.safeParse({ email: "not-an-email", role: "viewer" }).success).toBe(false);
  });

  it("bounds member pagination and supplies stable defaults", () => {
    expect(memberListQuerySchema.parse({})).toEqual({ limit: 50, offset: 0 });
    expect(memberListQuerySchema.parse({ limit: "25", offset: "50" })).toEqual({ limit: 25, offset: 50 });
    expect(memberListQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
    expect(memberListQuerySchema.safeParse({ offset: "-1" }).success).toBe(false);
  });
});
