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

const productReferenceSchema = z.object({
  id: catalogIdSchema,
  version: versionSchema,
}).strict();

export const installationChangeTypes = [
  "addon_grant",
  "addon_revoke",
  "plan_upgrade",
  "rollback",
] as const;

export const installationChangeTypeSchema = z.enum(installationChangeTypes);
export type InstallationChangeType = z.infer<typeof installationChangeTypeSchema>;

/**
 * Versioned target-installation change & add-on entitlement command.
 * Targets an existing installation without mutating its original pinned base composition.
 */
export const installationChangeCommandV1Schema = z.object({
  schemaVersion: z.literal("1.0.0"),
  eventId: z.string().uuid(),
  correlationId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(16).max(200),
  occurredAt: z.iso.datetime(),
  source: z.literal("bazionweb"),
  target: z.object({
    externalCustomerId: externalIdSchema,
    installationId: z.string().uuid(),
    tenantId: z.string().uuid().optional(),
    expectedBaseComposition: z.object({
      product: productReferenceSchema,
      solution: productReferenceSchema,
      template: productReferenceSchema,
    }).strict(),
  }).strict(),
  commercial: z.object({
    externalOrderId: externalIdSchema,
    orderLineId: externalIdSchema,
    invoiceId: externalIdSchema,
    subscriptionId: externalIdSchema.nullable(),
  }).strict(),
  change: z.object({
    changeType: installationChangeTypeSchema,
    preservePinnedBaseComposition: z.literal(true),
    enableModules: z.array(catalogIdSchema).max(32),
    disableModules: z.array(catalogIdSchema).max(32),
    entitlementOverrides: z.record(
      catalogIdSchema,
      z.union([z.string().max(120), z.number(), z.boolean()]),
    ),
    rollbackOfEventId: z.string().uuid().nullable(),
  }).strict(),
}).strict().superRefine((cmd, ctx) => {
  const enableSet = new Set(cmd.change.enableModules);
  for (const mod of cmd.change.disableModules) {
    if (enableSet.has(mod)) {
      ctx.addIssue({
        code: "custom",
        path: ["change", "disableModules"],
        message: "enableModules and disableModules must not overlap.",
      });
      break;
    }
  }
  if (cmd.change.changeType === "rollback" && !cmd.change.rollbackOfEventId) {
    ctx.addIssue({
      code: "custom",
      path: ["change", "rollbackOfEventId"],
      message: "rollback commands must identify rollbackOfEventId.",
    });
  }
  if (cmd.change.changeType !== "rollback" && cmd.change.rollbackOfEventId !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["change", "rollbackOfEventId"],
      message: "Non-rollback installation changes must set rollbackOfEventId to null.",
    });
  }
  if (
    cmd.change.changeType !== "rollback"
    && cmd.change.enableModules.length === 0
    && cmd.change.disableModules.length === 0
    && Object.keys(cmd.change.entitlementOverrides).length === 0
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["change"],
      message: "Installation change must enable, disable, or override at least one entitlement.",
    });
  }
});

export type InstallationChangeCommandV1 = z.infer<typeof installationChangeCommandV1Schema>;

export function getInstallationChangeCommandV1JsonSchema() {
  return {
    ...z.toJSONSchema(installationChangeCommandV1Schema, { target: "draft-2020-12" }),
    $id: "https://schemas.bazionweb.com/platform/installation-change-command/1.0.0",
    title: "Bazion installation change command v1",
    description: "Versioned target-installation add-on/entitlement change or rollback command preserving pinned base composition.",
  };
}

export const installationChangeResultV1Schema = z.object({
  schemaVersion: z.literal("1.0.0"),
  changeId: z.string().uuid(),
  eventId: z.string().uuid(),
  installationId: z.string().uuid(),
  idempotentReplay: z.boolean(),
  changeType: installationChangeTypeSchema,
  preservedBaseComposition: z.object({
    product: productReferenceSchema,
    solution: productReferenceSchema,
    template: productReferenceSchema,
  }).strict(),
  previousModules: z.array(catalogIdSchema),
  resultingModules: z.array(catalogIdSchema),
  appliedAt: z.iso.datetime(),
}).strict();

export type InstallationChangeResultV1 = z.infer<typeof installationChangeResultV1Schema>;

