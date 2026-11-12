import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getProvisioningOfferCatalogV1JsonSchema,
  provisioningOfferBindingV1Schema,
  provisioningOfferCatalogV1Schema,
} from "./provisioning-catalog.js";

const binding = {
  offer: { id: "website-business", version: "2026.1.0" },
  composition: {
    product: { id: "bazion-site", version: "1.0.0" },
    solution: { id: "business-website", version: "1.0.0" },
    template: { id: "node-nextjs", version: "1.0.0" },
  },
  requiredModules: [{ id: "website-content", version: "1.0.0" }],
  optionalModules: [{ id: "analytics", version: "1.0.0" }],
  distributionMode: "shared-managed",
};

describe("versioned provisioning offer catalog contract", () => {
  it("accepts an exact price-free shared-managed release binding", () => {
    expect(provisioningOfferBindingV1Schema.parse(binding)).toEqual(binding);
    expect(provisioningOfferCatalogV1Schema.parse({
      schemaVersion: "1.0.0",
      generatedAt: "2026-11-12T00:00:00.000Z",
      bindings: [binding],
    }).bindings).toHaveLength(1);
  });

  it("rejects dedicated mode and duplicate required/optional entitlements", () => {
    expect(provisioningOfferBindingV1Schema.safeParse({ ...binding, distributionMode: "dedicated" }).success).toBe(false);
    expect(provisioningOfferBindingV1Schema.safeParse({
      ...binding,
      optionalModules: binding.requiredModules,
    }).success).toBe(false);
  });

  it("rejects duplicate versions in one catalog response", () => {
    const result = provisioningOfferCatalogV1Schema.safeParse({
      schemaVersion: "1.0.0",
      generatedAt: "2026-11-12T00:00:00.000Z",
      bindings: [binding, binding],
    });
    expect(result.success).toBe(false);
  });

  it("keeps the published JSON Schema artifact synchronized with the runtime contract", () => {
    const artifact = JSON.parse(readFileSync(
      new URL("../contracts/provisioning-offer-catalog-v1.schema.json", import.meta.url),
      "utf8",
    )) as unknown;
    expect(artifact).toEqual(getProvisioningOfferCatalogV1JsonSchema());
  });
});
