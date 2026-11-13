import { beforeEach, describe, expect, it, vi } from "vitest";
import { churchPublicSiteSettingsSchema } from "@bazion/church-ministry-contracts";

vi.mock("./server-tenant-api", () => ({ fetchTenantPublicData: vi.fn() }));

import { fetchTenantPublicData } from "./server-tenant-api";
import { isTenantWebsitePageEnabled } from "./server-site-pages";

const fetchSite = vi.mocked(fetchTenantPublicData);

describe("server-side tenant page publishing", () => {
  beforeEach(() => fetchSite.mockReset());

  it("returns the saved enabled state for a configured page", async () => {
    const defaults = churchPublicSiteSettingsSchema.parse({});
    const settings = churchPublicSiteSettingsSchema.parse({
      pages: defaults.pages.map((page) => page.id === "about" ? { ...page, enabled: false } : page),
    });
    fetchSite.mockResolvedValueOnce({ siteSettings: settings } as never);

    await expect(isTenantWebsitePageEnabled("about")).resolves.toBe(false);
    expect(fetchSite).toHaveBeenCalledWith("/v1/public/church/site");
  });

  it("keeps routes available when no tenant site settings exist yet", async () => {
    fetchSite.mockResolvedValueOnce({ siteSettings: null } as never);

    await expect(isTenantWebsitePageEnabled("about")).resolves.toBe(true);
  });

  it("uses safe defaults rather than taking pages offline for malformed legacy data", async () => {
    fetchSite.mockResolvedValueOnce({ siteSettings: { pages: "invalid" } } as never);

    await expect(isTenantWebsitePageEnabled("about")).resolves.toBe(true);
  });
});
