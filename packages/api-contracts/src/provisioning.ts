import { z } from "zod";

const externalIdSchema = z.string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, "Use a stable external identifier.");

const catalogIdSchema = z.string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9._-]*$/, "Use a lowercase catalog-safe identifier.");

const versionSchema = z.string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9.+_-]*$/, "Use an immutable release version.");

const hostnameSchema = z.string()
  .trim()
  .max(253)
  .regex(
    /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/,
    "Use a fully qualified hostname without a scheme or path.",
  );

const productReferenceSchema = z.object({
  id: catalogIdSchema,
  version: versionSchema,
}).strict();

/**
 * Versioned wire command from Bazion's commercial system to the platform.
 * It contains commercial references and product composition, never payment
 * credentials, card data, prices, provider secrets or database credentials.
 */
export const provisionProductRequestV1Schema = z.object({
  schemaVersion: z.literal("1.0.0"),
  eventId: z.string().uuid(),
  correlationId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(16).max(200),
  occurredAt: z.iso.datetime(),
  source: z.literal("bazionweb"),
  customer: z.object({
    externalCustomerId: externalIdSchema,
    displayName: z.string().trim().min(1).max(180),
    primaryContact: z.object({
      name: z.string().trim().min(1).max(120),
      email: z.email().max(254).regex(/^[^A-Z]*$/, "Send contact email in lowercase."),
    }).strict(),
  }).strict(),
  order: z.object({
    externalOrderId: externalIdSchema,
    offerId: catalogIdSchema,
    offerVersion: versionSchema,
  }).strict(),
  composition: z.object({
    product: productReferenceSchema,
    solution: productReferenceSchema,
    template: productReferenceSchema,
  }).strict(),
  requestedDomain: hostnameSchema.optional(),
}).strict();

export type ProvisionProductRequestV1 = z.infer<typeof provisionProductRequestV1Schema>;

/** Machine-readable request schema published for the independently deployed commercial API. */
export function getProvisionProductRequestV1JsonSchema() {
  return {
    ...z.toJSONSchema(provisionProductRequestV1Schema, { target: "draft-2020-12" }),
    $id: "https://schemas.bazionweb.com/platform/provision-product-request/1.0.0",
    title: "Bazion product provisioning request v1",
    description: "A paid Bazion commercial order requesting a version-pinned product installation. Do not include prices, payment credentials, secrets or database credentials.",
  };
}

export const provisioningOperationStatusSchema = z.enum([
  "accepted",
  "validating",
  "provisioning_tenant",
  "configuring_installation",
  "provisioning_hosting",
  "ready",
  "compensating",
  "compensation_required",
  "compensated",
  "failed",
]);

export type ProvisioningOperationStatus = z.infer<typeof provisioningOperationStatusSchema>;

/** Publicly safe operation snapshot; provider errors and credentials stay internal. */
export const provisioningOperationV1Schema = z.object({
  schemaVersion: z.literal("1.0.0"),
  operationId: z.string().uuid(),
  correlationId: z.string().uuid(),
  externalOrderId: externalIdSchema,
  status: provisioningOperationStatusSchema,
  currentStep: z.string().trim().regex(/^[a-z][a-z0-9_]{0,79}$/).nullable(),
  tenantId: z.string().uuid().nullable(),
  installationId: z.string().uuid().nullable(),
  failure: z.object({
    code: z.string().trim().regex(/^[A-Z][A-Z0-9_]{0,79}$/),
    retryable: z.boolean(),
  }).strict().nullable(),
  updatedAt: z.iso.datetime(),
}).strict().superRefine((operation, context) => {
  if (operation.status === "ready" && (!operation.tenantId || !operation.installationId)) {
    context.addIssue({
      code: "custom",
      path: ["status"],
      message: "A ready operation must identify its tenant and product installation.",
    });
  }
  if (["failed", "compensation_required"].includes(operation.status) && !operation.failure) {
    context.addIssue({
      code: "custom",
      path: ["failure"],
      message: "A failed or compensation-required operation must provide a stable, non-sensitive error code.",
    });
  }
});

export type ProvisioningOperationV1 = z.infer<typeof provisioningOperationV1Schema>;

export const provisioningStatusEventV1Schema = z.object({
  schemaVersion: z.literal("1.0.0"),
  eventType: z.literal("product.provisioning.status.v1"),
  eventId: z.string().uuid(),
  correlationId: z.string().uuid(),
  occurredAt: z.iso.datetime(),
  source: z.literal("bazion-platform"),
  operation: provisioningOperationV1Schema,
}).strict().superRefine((event, context) => {
  if (event.correlationId !== event.operation.correlationId) {
    context.addIssue({
      code: "custom",
      path: ["operation", "correlationId"],
      message: "The event and operation must share a correlation identifier.",
    });
  }
});

export type ProvisioningStatusEventV1 = z.infer<typeof provisioningStatusEventV1Schema>;
