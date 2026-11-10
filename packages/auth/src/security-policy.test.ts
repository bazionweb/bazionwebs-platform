import { describe, expect, it, vi } from "vitest";
import {
  canCreateClientOrganization,
  canAccessPlatformTenantScope,
  canGrantClientOwner,
  normalizeTenantHostname,
  resolveTrustedOriginsForRequest,
} from "./security-policy.js";

describe("authentication and tenant-origin policy", () => {
  it("only allows verified platform owners to create client organizations", () => {
    expect(canCreateClientOrganization("platform_owner", true)).toBe(true);
    expect(canCreateClientOrganization("platform_admin", true)).toBe(false);
    expect(canCreateClientOrganization("platform_support", true)).toBe(false);
    expect(canCreateClientOrganization("admin", true)).toBe(false);
    expect(canCreateClientOrganization("platform_admin", false)).toBe(false);
    expect(canCreateClientOrganization(null, true)).toBe(false);
  });

  it("keeps cross-tenant scope exclusive to the platform owner", () => {
    expect(canAccessPlatformTenantScope("platform_owner", null, "tenant-b")).toBe(true);
    expect(canAccessPlatformTenantScope("platform_admin", "tenant-a", "tenant-a")).toBe(true);
    expect(canAccessPlatformTenantScope("platform_admin", "tenant-a", "tenant-b")).toBe(false);
    expect(canAccessPlatformTenantScope("platform_admin", null, "tenant-a")).toBe(false);
    expect(canAccessPlatformTenantScope("platform_support", "tenant-a", "tenant-b")).toBe(false);
  });

  it("reserves client owner grants for the audited platform transfer workflow", () => {
    expect(canGrantClientOwner("platform_owner", "owner")).toBe(false);
    expect(canGrantClientOwner("platform_admin", "admin,owner")).toBe(false);
    expect(canGrantClientOwner("platform_support", "admin,owner")).toBe(false);
    expect(canGrantClientOwner("admin", "owner")).toBe(false);
    expect(canGrantClientOwner("admin", "admin,orderManager")).toBe(true);
  });

  it("normalizes hostnames and rejects malformed host input", () => {
    expect(normalizeTenantHostname("  SHOP.Example.COM. ")).toBe("shop.example.com");
    expect(normalizeTenantHostname("localhost")).toBe("localhost");
    expect(normalizeTenantHostname("")).toBeNull();
    expect(normalizeTenantHostname("example.com/path")).toBeNull();
    expect(normalizeTenantHostname("user@example.com")).toBeNull();
    expect(normalizeTenantHostname("-bad.example")).toBeNull();
    expect(normalizeTenantHostname("bad-.example")).toBeNull();
    expect(normalizeTenantHostname("a".repeat(64) + ".example")).toBeNull();
  });

  it("returns configured origins unchanged when no request is present", async () => {
    const defaults = ["https://app.bazionweb.com"];
    await expect(resolveTrustedOriginsForRequest(undefined, defaults, "production", vi.fn()))
      .resolves.toBe(defaults);
  });

  it("allows localhost only outside production", async () => {
    const defaults = ["http://localhost:3000"];
    const devRequest = new Request("http://localhost:4000", { headers: { origin: "http://localhost:4300" } });
    const prodRequest = new Request("http://localhost:4000", { headers: { origin: "http://localhost:4300" } });
    await expect(resolveTrustedOriginsForRequest(devRequest, defaults, "development", vi.fn()))
      .resolves.toEqual(["http://localhost:3000", "http://localhost:4300"]);
    await expect(resolveTrustedOriginsForRequest(prodRequest, defaults, "production", vi.fn()))
      .resolves.toEqual(defaults);
  });

  it("requires verified HTTPS hosts on the default port for client origins", async () => {
    const defaults = ["https://app.bazionweb.com"];
    const verify = vi.fn(async (host: string) => host === "shop.example.com");
    const valid = new Request("https://api.bazionweb.com", { headers: { origin: "https://shop.example.com" } });
    const unverified = new Request("https://api.bazionweb.com", { headers: { origin: "https://unknown.example.com" } });
    const insecure = new Request("https://api.bazionweb.com", { headers: { origin: "http://shop.example.com" } });
    const customPort = new Request("https://api.bazionweb.com", { headers: { origin: "https://shop.example.com:8443" } });

    await expect(resolveTrustedOriginsForRequest(valid, defaults, "production", verify))
      .resolves.toEqual([...defaults, "https://shop.example.com"]);
    await expect(resolveTrustedOriginsForRequest(unverified, defaults, "production", verify)).resolves.toEqual(defaults);
    await expect(resolveTrustedOriginsForRequest(insecure, defaults, "production", verify)).resolves.toEqual(defaults);
    await expect(resolveTrustedOriginsForRequest(customPort, defaults, "production", verify)).resolves.toEqual(defaults);
    expect(verify).toHaveBeenCalledWith("shop.example.com");
  });

  it("does not trust origins containing credentials or malformed hostnames", async () => {
    const defaults = ["https://app.bazionweb.com"];
    const verify = vi.fn(async () => true);
    const credentialed = new Request("https://api.bazionweb.com", {
      headers: { origin: "https://user:password@shop.example.com" },
    });
    await expect(resolveTrustedOriginsForRequest(credentialed, defaults, "production", verify)).resolves.toEqual(defaults);
    expect(verify).not.toHaveBeenCalled();
  });
});
