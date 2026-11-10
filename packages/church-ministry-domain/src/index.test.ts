import { describe, expect, it } from "vitest";
import { slugifyContentTitle, uniqueTenantSlug } from "./index.js";

describe("slugifyContentTitle", () => {
  it("normalizes accents and punctuation into a stable URL slug", () => {
    expect(slugifyContentTitle("Révival & Praise Night!")).toBe("revival-and-praise-night");
  });

  it("uses the provided fallback for titles without a usable slug", () => {
    expect(slugifyContentTitle("--", "sermon")).toBe("sermon");
  });
});

describe("uniqueTenantSlug", () => {
  it("returns the base slug when the tenant has not used it", async () => {
    await expect(uniqueTenantSlug("revival-night", 120, async () => false)).resolves.toBe("revival-night");
  });

  it("increments a suffix until it finds an unused slug", async () => {
    const used = new Set(["revival-night", "revival-night-2"]);
    await expect(uniqueTenantSlug("revival-night", 120, async (slug) => used.has(slug)))
      .resolves.toBe("revival-night-3");
  });

  it("keeps suffixed values within the configured limit", async () => {
    const used = new Set(["revival", "reviva-2"]);
    await expect(uniqueTenantSlug("revival-night", 8, async (slug) => used.has(slug)))
      .resolves.toBe("reviva-3");
    expect("reviva-3").toHaveLength(8);
    await expect(uniqueTenantSlug("x", 1, async (slug) => slug === "x")).resolves.toBe("2");
  });

  it("uses a safe fallback for an empty base and rejects invalid limits", async () => {
    await expect(uniqueTenantSlug("---", 10, async () => false)).resolves.toBe("content");
    await expect(uniqueTenantSlug("content", 0, async () => false)).rejects.toThrow(RangeError);
  });
});
