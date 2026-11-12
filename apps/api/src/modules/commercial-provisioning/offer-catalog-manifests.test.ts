import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { platformProvisioningOfferBindings } from "./offer-resolution.js";

function readJson(relativePath: string): Record<string, any> {
  return JSON.parse(readFileSync(new URL(`../../../../../${relativePath}`, import.meta.url), "utf8")) as Record<string, any>;
}

function sortedRefs(refs: readonly { id: string; version: string }[]): string[] {
  return refs.map((ref) => `${ref.id}@${ref.version}`).sort();
}

describe("production offer bindings match platform release manifests", () => {
  it("only publishes commercial offers pinned to stable product, solution, template, and module releases", () => {
    const commercialOffers = readJson("products/commercial-offerings.json");
    const commercialOfferIds = new Set<string>(commercialOffers.offerings.map((offer: { id: string }) => offer.id));

    for (const binding of platformProvisioningOfferBindings) {
      expect(commercialOfferIds.has(binding.offer.id)).toBe(true);
      expect(binding.distributionMode).toBe("shared-managed");
      expect(binding.availability).toBe("active");

      const product = readJson(`products/${binding.composition.product.id}/manifest.json`);
      const solution = readJson(`solutions/${binding.composition.solution.id}/manifest.json`);
      const template = readJson(`templates/${binding.composition.template.id}/manifest.json`);

      expect(product).toMatchObject({
        id: binding.composition.product.id,
        version: binding.composition.product.version,
        status: "stable",
        solution: binding.composition.solution,
      });
      expect(solution).toMatchObject({
        id: binding.composition.solution.id,
        version: binding.composition.solution.version,
        status: "stable",
        readiness: "buildable",
      });
      expect(template).toMatchObject({
        id: binding.composition.template.id,
        version: binding.composition.template.version,
        status: "stable",
      });
      expect(product.templates).toContainEqual(binding.composition.template);
      expect(sortedRefs(binding.requiredModules)).toEqual(sortedRefs(product.requiredModules));
      expect(sortedRefs(binding.optionalModules)).toEqual(sortedRefs(product.optionalModules));
    }
  });
});
