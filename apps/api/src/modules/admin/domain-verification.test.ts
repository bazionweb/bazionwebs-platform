import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { verifyTenantDomainTxt } from "./domain-verification.js";

describe("tenant domain DNS proof", () => {
  it("accepts a matching token split across TXT chunks", async () => {
    const token = "a".repeat(64);
    const resolver = vi.fn(async (name: string) => [["bazionweb-verification=", token.slice(0, 28), token.slice(28)]]);
    const result = await verifyTenantDomainTxt(
      "shop.example.com",
      createHash("sha256").update(token).digest("hex"),
      resolver,
    );
    expect(result).toBe(true);
    expect(resolver).toHaveBeenCalledWith("_bazionweb-challenge.shop.example.com");
  });

  it("rejects mismatched and malformed challenge values", async () => {
    const resolver = vi.fn(async () => [["bazionweb-verification=", "not-a-token"]]);
    await expect(verifyTenantDomainTxt("shop.example.com", "f".repeat(64), resolver)).resolves.toBe(false);
    await expect(verifyTenantDomainTxt("shop.example.com", "not-a-hash", resolver)).resolves.toBe(false);
  });

  it("treats a missing DNS TXT record as an unverified domain", async () => {
    const resolver = vi.fn(async () => {
      throw Object.assign(new Error("No TXT record"), { code: "ENODATA" });
    });
    await expect(verifyTenantDomainTxt("shop.example.com", "f".repeat(64), resolver)).resolves.toBe(false);
  });

  it("does not swallow DNS resolver failures unrelated to missing records", async () => {
    const resolver = vi.fn(async () => {
      throw Object.assign(new Error("DNS resolver unavailable"), { code: "ESERVFAIL" });
    });
    await expect(verifyTenantDomainTxt("shop.example.com", "f".repeat(64), resolver)).rejects.toThrow("DNS resolver unavailable");
  });
});
