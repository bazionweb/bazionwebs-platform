import { z } from "zod";

const releaseReferenceSchema = z.object({
  id: z.string().trim().min(1).max(120).regex(/^[a-z0-9][a-z0-9._-]*$/),
  version: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9][A-Za-z0-9.+_-]*$/),
}).strict();

export const provisioningOfferBindingV1Schema = z.object({
  offer: releaseReferenceSchema,
  composition: z.object({
    product: releaseReferenceSchema,
    solution: releaseReferenceSchema,
    template: releaseReferenceSchema,
  }).strict(),
  requiredModules: z.array(releaseReferenceSchema).min(1).max(100),
  optionalModules: z.array(releaseReferenceSchema).max(100),
  distributionMode: z.literal("shared-managed"),
}).strict().superRefine((binding, context) => {
  const moduleIds = new Set<string>();
  for (const [index, module] of [...binding.requiredModules, ...binding.optionalModules].entries()) {
    if (moduleIds.has(module.id)) {
      context.addIssue({
        code: "custom",
        path: [index < binding.requiredModules.length ? "requiredModules" : "optionalModules", index < binding.requiredModules.length ? index : index - binding.requiredModules.length, "id"],
        message: "A module may appear only once in an offer binding.",
      });
    }
    moduleIds.add(module.id);
  }
});

/** Public, price-free view of the active Platform-owned provisioning allowlist. */
export const provisioningOfferCatalogV1Schema = z.object({
  schemaVersion: z.literal("1.0.0"),
  generatedAt: z.iso.datetime(),
  bindings: z.array(provisioningOfferBindingV1Schema).max(1_000),
}).strict().superRefine((catalog, context) => {
  const keys = new Set<string>();
  catalog.bindings.forEach((binding, index) => {
    const key = `${binding.offer.id}@${binding.offer.version}`;
    if (keys.has(key)) {
      context.addIssue({
        code: "custom",
        path: ["bindings", index, "offer"],
        message: "Offer versions must be unique in a catalog response.",
      });
    }
    keys.add(key);
  });
});

/** Machine-readable catalog schema for independently deployed commercial clients. */
export function getProvisioningOfferCatalogV1JsonSchema() {
  return {
    ...z.toJSONSchema(provisioningOfferCatalogV1Schema, { target: "draft-2020-12" }),
    $id: "https://schemas.bazionweb.com/platform/provisioning-offer-catalog/1.0.0",
    title: "Bazion platform provisioning offer catalog v1",
    description: "Price-free, immutable offer-to-product bindings published by the platform.",
  };
}

export type ProvisioningOfferBindingV1 = z.infer<typeof provisioningOfferBindingV1Schema>;
export type ProvisioningOfferCatalogV1 = z.infer<typeof provisioningOfferCatalogV1Schema>;
