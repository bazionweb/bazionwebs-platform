import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../config.js";
import { extractRequestTenantInputs, resolveRequestTenantId, resolveTenantId, resolveTenantRouting } from "./tenant-resolution.js";

const mocks = vi.hoisted(() => ({
  resolvePublicTenantByHostname: vi.fn(),
  resolvePublicTenantBySlug: vi.fn(),
  resolvePublicTenantInstallationByHostname: vi.fn(),
}));

vi.mock("@bazion/auth/server", () => ({
  resolvePublicTenantByHostname: mocks.resolvePublicTenantByHostname,
  resolvePublicTenantBySlug: mocks.resolvePublicTenantBySlug,
  resolvePublicTenantInstallationByHostname: mocks.resolvePublicTenantInstallationByHostname,
}));

const productionConfig = {
  NODE_ENV: "production",
  TENANT_RESOLUTION_MODE: "verified_domain",
  PUBLIC_STOREFRONT_URL: "https://sites.bazionweb.com",
} as AppConfig;

const developmentConfig = {
  NODE_ENV: "development",
  TENANT_RESOLUTION_MODE: "verified_domain",
  DEFAULT_TENANT_ID: "default-tenant-id",
  PUBLIC_STOREFRONT_URL: "http://localhost:3000",
} as AppConfig;

describe("resolveTenantId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolvePublicTenantByHostname.mockResolvedValue(null);
    mocks.resolvePublicTenantBySlug.mockResolvedValue(null);
    mocks.resolvePublicTenantInstallationByHostname.mockResolvedValue(null);
  });

  it("uses the verified hostname even when a request supplies another tenant selector", async () => {
    mocks.resolvePublicTenantByHostname.mockResolvedValue({ id: "verified-tenant-id" });

    await expect(resolveTenantId("members.example.org:443", productionConfig, "other-tenant"))
      .resolves.toBe("verified-tenant-id");

    expect(mocks.resolvePublicTenantByHostname).toHaveBeenCalledWith("members.example.org");
    expect(mocks.resolvePublicTenantBySlug).not.toHaveBeenCalled();
  });

  it("does not use an explicit selector as a production fallback for an unmapped hostname", async () => {
    mocks.resolvePublicTenantBySlug.mockResolvedValue({ id: "header-tenant-id" });

    await expect(resolveTenantId("unknown.example.org", productionConfig, "header-tenant"))
      .rejects.toMatchObject({ statusCode: 404, code: "TENANT_NOT_FOUND" });

    expect(mocks.resolvePublicTenantBySlug).not.toHaveBeenCalled();
  });

  it("allows an explicit tenant selector only on a local development loopback host", async () => {
    mocks.resolvePublicTenantBySlug.mockResolvedValue({ id: "local-tenant-id" });

    await expect(resolveTenantId("localhost:4000", developmentConfig, "Local-Tenant"))
      .resolves.toBe("local-tenant-id");

    expect(mocks.resolvePublicTenantByHostname).toHaveBeenCalledWith("localhost");
    expect(mocks.resolvePublicTenantBySlug).toHaveBeenCalledWith("local-tenant");
  });

  it("keeps a tenant-specific localhost hostname authoritative over an explicit selector", async () => {
    mocks.resolvePublicTenantBySlug.mockImplementation(async (slug: string) =>
      slug === "alpha" ? { id: "alpha-tenant-id" } : { id: "other-tenant-id" },
    );

    await expect(resolveTenantId("alpha.localhost:4000", developmentConfig, "other"))
      .resolves.toBe("alpha-tenant-id");

    expect(mocks.resolvePublicTenantBySlug).toHaveBeenCalledTimes(1);
    expect(mocks.resolvePublicTenantBySlug).toHaveBeenCalledWith("alpha");
  });

  it("does not allow an explicit selector on a non-loopback development hostname", async () => {
    mocks.resolvePublicTenantBySlug.mockResolvedValue({ id: "header-tenant-id" });

    await expect(resolveTenantId("preview.example.test", developmentConfig, "header-tenant"))
      .rejects.toMatchObject({ statusCode: 404, code: "TENANT_NOT_FOUND" });

    expect(mocks.resolvePublicTenantBySlug).not.toHaveBeenCalled();
  });

  it("supports bracketed IPv6 loopback for the local static fallback", async () => {
    await expect(resolveTenantId("[::1]:4000", {
      ...developmentConfig,
      TENANT_RESOLUTION_MODE: "static",
    }, undefined)).resolves.toBe("default-tenant-id");

    expect(mocks.resolvePublicTenantByHostname).toHaveBeenCalledWith("::1");
  });

  it("resolves verified domain-to-installation routing while retaining legacy null installation_id fallback", async () => {
    mocks.resolvePublicTenantInstallationByHostname.mockResolvedValueOnce({
      id: "tenant-1",
      slug: "tenant-one",
      name: "Tenant One",
      default_currency: "KES",
      installation_id: "inst-brand-a",
    });

    await expect(resolveTenantRouting("brand-a.example.org:443", productionConfig))
      .resolves.toEqual({ tenantId: "tenant-1", installationId: "inst-brand-a" });
    expect(mocks.resolvePublicTenantInstallationByHostname).toHaveBeenCalledWith("brand-a.example.org");

    mocks.resolvePublicTenantInstallationByHostname.mockResolvedValueOnce({
      id: "tenant-1",
      slug: "tenant-one",
      name: "Tenant One",
      default_currency: "KES",
      installation_id: null,
    });

    await expect(resolveTenantRouting("legacy.example.org", productionConfig))
      .resolves.toEqual({ tenantId: "tenant-1", installationId: null });
  });

  it("resolves server-based production preview subdomains from PUBLIC_STOREFRONT_URL before custom domain verification", async () => {
    mocks.resolvePublicTenantBySlug.mockResolvedValueOnce({ id: "grace-tenant-id" });

    await expect(resolveTenantId("grace.sites.bazionweb.com:443", productionConfig))
      .resolves.toBe("grace-tenant-id");
    expect(mocks.resolvePublicTenantBySlug).toHaveBeenCalledWith("grace");

    mocks.resolvePublicTenantBySlug.mockResolvedValueOnce({ id: "grace-tenant-id" });
    await expect(resolveTenantRouting("grace.sites.bazionweb.com", productionConfig))
      .resolves.toEqual({ tenantId: "grace-tenant-id", installationId: null });
  });

  it("ignores reserved preview subdomains in production unless mapped as verified domains", async () => {
    await expect(resolveTenantId("www.sites.bazionweb.com", productionConfig))
      .rejects.toMatchObject({ statusCode: 404, code: "TENANT_NOT_FOUND" });
    expect(mocks.resolvePublicTenantBySlug).not.toHaveBeenCalled();
  });

  it("extracts x-forwarded-host, local origin subdomain, and bazion_tenant cookie in dev requests", async () => {
    mocks.resolvePublicTenantBySlug.mockResolvedValueOnce({ id: "gmfc-id" });
    await expect(resolveRequestTenantId({
      hostname: "localhost:4000",
      headers: { "x-forwarded-host": "global-mission-fc.localhost:3000" },
    }, developmentConfig)).resolves.toBe("gmfc-id");
    expect(mocks.resolvePublicTenantBySlug).toHaveBeenCalledWith("global-mission-fc");

    mocks.resolvePublicTenantBySlug.mockResolvedValueOnce({ id: "gmfc-id" });
    await expect(resolveRequestTenantId({
      hostname: "localhost:4000",
      headers: { cookie: "other=1; bazion_tenant=global-mission-fc" },
    }, developmentConfig)).resolves.toBe("gmfc-id");

    const prodExtracted = extractRequestTenantInputs({
      hostname: "unknown.example.org",
      headers: { "x-forwarded-host": "global-mission-fc.localhost:3000", cookie: "bazion_tenant=global-mission-fc" },
    }, productionConfig);
    expect(prodExtracted).toEqual({ hostname: "unknown.example.org" });
  });
});
