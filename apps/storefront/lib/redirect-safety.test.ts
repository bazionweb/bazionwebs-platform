import { describe, expect, it } from "vitest";
import {
  buildTenantStorefrontUrl,
  buildTenantWorkspacePickerUrl,
  resolveConfiguredWorkspaceBaseUrl,
  resolveSafeRedirectTarget,
} from "@bazion/auth/client";

describe("storefront redirect and URL helpers", () => {
  it("allows safe relative redirect paths inside the storefront origin", () => {
    expect(
      resolveSafeRedirectTarget("/admin?tab=overview#top", {
        allowedOrigins: ["https://tenant.bazionweb.test"],
        fallback: "/admin",
      }),
    ).toBe("/admin?tab=overview#top");
  });

  it("blocks open redirect attempts using external origins, protocol-relative paths, backslashes, or JS URIs", () => {
    const allowedOrigins = ["https://portal.bazionweb.test"];
    expect(resolveSafeRedirectTarget("https://evil.example/steal", { allowedOrigins, fallback: "/admin" })).toBe("/admin");
    expect(resolveSafeRedirectTarget("//evil.example/steal", { allowedOrigins, fallback: "/admin" })).toBe("/admin");
    expect(resolveSafeRedirectTarget("/\\evil.example", { allowedOrigins, fallback: "/admin" })).toBe("/admin");
    expect(resolveSafeRedirectTarget("javascript:alert(1)", { allowedOrigins, fallback: "/admin" })).toBe("/admin");
    expect(resolveSafeRedirectTarget("https://portal.bazionweb.test@evil.example/x", { allowedOrigins, fallback: "/admin" })).toBe("/admin");
  });

  it("permits explicit same-origin callbackURL values", () => {
    expect(
      resolveSafeRedirectTarget("https://portal.bazionweb.test/workspace?select=org_1", {
        allowedOrigins: ["https://portal.bazionweb.test"],
        fallback: "/workspace",
      }),
    ).toBe("https://portal.bazionweb.test/workspace?select=org_1");
  });

  it("builds configurable tenant storefront and workspace picker URLs without hardcoded hosts", () => {
    expect(resolveConfiguredWorkspaceBaseUrl("https://stores.bazionweb.com/ignored")).toBe("https://stores.bazionweb.com");
    expect(buildTenantStorefrontUrl("https://stores.bazionweb.com", "grace-chapel")).toBe(
      "https://stores.bazionweb.com/?tenant=grace-chapel",
    );
    expect(
      buildTenantWorkspacePickerUrl("https://stores.bazionweb.com", {
        organizationId: "org_123",
        tenantSlug: "grace-chapel",
        next: "/admin",
      }),
    ).toBe("https://stores.bazionweb.com/workspace?select=org_123&workspace=grace-chapel&redirect=%2Fadmin");
  });
});

