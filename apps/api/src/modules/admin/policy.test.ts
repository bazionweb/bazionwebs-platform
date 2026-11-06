import { describe, expect, it } from "vitest";
import {
  clientAssignableRoles,
  invitationInputSchema,
  memberListQuerySchema,
  memberRoleInputSchema,
  platformTenantOwnerCandidatesQuerySchema,
  platformTenantModuleInputSchema,
  platformTenantSettingsInputSchema,
  platformTenantAuditQuerySchema,
  platformTenantDomainInputSchema,
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


describe("platform tenant control-plane input policy", () => {
  it("bounds and normalizes owner candidate searches", () => {
    expect(platformTenantOwnerCandidatesQuerySchema.parse({ q: "  jane ", limit: "25" }))
      .toEqual({ q: "jane", limit: 25, offset: 0 });
    expect(platformTenantOwnerCandidatesQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
  });

  it("accepts only explicit module enabled state", () => {
    expect(platformTenantModuleInputSchema.safeParse({ enabled: false }).success).toBe(true);
    expect(platformTenantModuleInputSchema.safeParse({ enabled: true, force: true }).success).toBe(false);
  });

  it("requires a version and a non-empty allowlisted settings patch", () => {
    expect(platformTenantSettingsInputSchema.safeParse({
      expectedVersion: 0,
      settings: { brandName: "Bazion Client", primaryColor: "#236b4c", defaultCurrency: "KES" },
    }).success).toBe(true);
    expect(platformTenantSettingsInputSchema.safeParse({
      expectedVersion: 0, settings: { arbitrary: "unsafe" },
    }).success).toBe(false);
    expect(platformTenantSettingsInputSchema.safeParse({
      expectedVersion: 0, settings: { defaultCurrency: "XXX" },
    }).success).toBe(false);
    expect(platformTenantSettingsInputSchema.safeParse({
      expectedVersion: 0, settings: {},
    }).success).toBe(false);
  });

  it("accepts only a hostname for custom-domain challenges", () => {
    expect(platformTenantDomainInputSchema.safeParse({ hostname: "shop.example.com" }).success).toBe(true);
    expect(platformTenantDomainInputSchema.safeParse({ hostname: "  shop.example.com  " }).success).toBe(true);
    expect(platformTenantDomainInputSchema.safeParse({ hostname: "shop.example.com", token: "do-not-accept" }).success).toBe(false);
    expect(platformTenantDomainInputSchema.safeParse({ hostname: "" }).success).toBe(false);
  });

  it("bounds audit history pagination and optional action filters", () => {
    expect(platformTenantAuditQuerySchema.parse({ limit: "10" })).toEqual({ limit: 10, offset: 0 });
    expect(platformTenantAuditQuerySchema.safeParse({ offset: "-1" }).success).toBe(false);
  });
});
