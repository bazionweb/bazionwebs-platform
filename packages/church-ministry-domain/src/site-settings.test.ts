import { describe, expect, it, vi } from "vitest";
import { getMinistrySiteSettings, saveMinistrySiteSettings } from "./site-settings.js";
import type { MinistrySiteSettingsRepository, MinistrySiteSettingsSnapshot } from "./site-settings.js";

function snapshot(tenantName: string, title: string, email: string): MinistrySiteSettingsSnapshot {
  return {
    tenantName,
    profile: {
      ministryName: tenantName,
      logoAssetUrl: `/${tenantName.toLowerCase().replaceAll(" ", "-")}.png`,
      description: "A local community of faith.",
      vision: "Serve our community.",
      mission: "Share hope.",
      outreach: "Care for neighbours.",
      address: `${tenantName} campus`,
      email,
      telephoneNumbers: ["+254712345678"],
      socialLinks: { facebook: "https://facebook.com/example", other: "https://example.test" },
    },
    storedSettings: JSON.stringify({ hero: { title } }),
    leaders: [],
  };
}

describe("ministry site settings use cases", () => {
  it("loads settings and identity from the requested tenant only", async () => {
    const records = new Map([
      ["tenant-a", snapshot("Harbour Church", "Come ashore", "harbour@example.test")],
      ["tenant-b", snapshot("River Chapel", "Find your way home", "river@example.test")],
    ]);
    const load = vi.fn(async (tenantId: string) => records.get(tenantId)!);
    const repository: MinistrySiteSettingsRepository = {
      load,
      save: vi.fn(async () => undefined),
    };

    const [harbour, river] = await Promise.all([
      getMinistrySiteSettings(repository, "tenant-a"),
      getMinistrySiteSettings(repository, "tenant-b"),
    ]);

    expect(harbour.profile.ministryName).toBe("Harbour Church");
    expect(harbour.profile.contact.email).toBe("harbour@example.test");
    expect(harbour.settings.hero.title).toBe("Come ashore");
    expect(river.profile.ministryName).toBe("River Chapel");
    expect(river.profile.contact.email).toBe("river@example.test");
    expect(river.settings.hero.title).toBe("Find your way home");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps legacy leadership rows in the site settings when no settings record exists", async () => {
    const data = snapshot("Harbour Church", "Come ashore", "harbour@example.test");
    data.storedSettings = null;
    data.leaders = [{ name: "Grace Njeri", position: "Pastor", biography: "Serving the community.", photoUrl: "javascript:bad()" }];
    const repository: MinistrySiteSettingsRepository = {
      load: async () => data,
      save: vi.fn(async () => undefined),
    };

    const result = await getMinistrySiteSettings(repository, "tenant-a");

    expect(result.settings.leadership).toEqual([{
      name: "Grace Njeri",
      role: "Pastor",
      bio: "Serving the community.",
      photoUrl: undefined,
    }]);
  });

  it("validates before saving and persists through the tenant-scoped port", async () => {
    const save = vi.fn(async () => undefined);
    const repository: MinistrySiteSettingsRepository = {
      load: async () => snapshot("Harbour Church", "Come ashore", "harbour@example.test"),
      save,
    };
    const now = new Date("2026-11-10T10:00:00.000Z");

    const invalid = await saveMinistrySiteSettings(repository, "tenant-a", { profile: { ministryName: "x" } }, now);
    expect(invalid.success).toBe(false);
    expect(save).not.toHaveBeenCalled();

    const valid = await saveMinistrySiteSettings(repository, "tenant-a", {
      profile: { ministryName: "Harbour Church", logoUrl: "/church.svg" },
      settings: { hero: { title: "Come ashore" } },
    }, now);
    expect(valid).toEqual({ success: true, updatedAt: now.toISOString() });
    expect(save).toHaveBeenCalledWith("tenant-a", expect.objectContaining({ profile: expect.objectContaining({ ministryName: "Harbour Church" }) }), now);
  });
});
