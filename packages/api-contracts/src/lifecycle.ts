import { z } from "zod";
import { installationStatusSchema } from "./shared-enums.js";

const externalIdSchema = z.string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, "Use a stable external identifier.");

const reasonCodeSchema = z.string()
  .trim()
  .regex(/^[A-Z][A-Z0-9_]{1,79}$/, "Use an uppercase reason code.");

const semverSchema = z.string().trim().max(40).regex(/^\d+\.\d+\.\d+$/);

export const subscriptionLifecycleActions = [
  "activate",
  "grace",
  "suspend",
  "reactivate",
  "cancel",
] as const;

export const subscriptionLifecycleActionSchema = z.enum(subscriptionLifecycleActions);
export type SubscriptionLifecycleAction = z.infer<typeof subscriptionLifecycleActionSchema>;

/**
 * Signed versioned subscription lifecycle command from Bazionweb to Bazion Platform.
 * Commercial billing/dunning policy runs in Bazionweb; the platform applies the
 * entitlement/installation state change idempotently without deleting tenant data.
 */
export const subscriptionLifecycleCommandV1Schema = z.object({
  schemaVersion: z.literal("1.0.0"),
  eventId: z.string().uuid(),
  correlationId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(16).max(200),
  occurredAt: z.iso.datetime(),
  effectiveAt: z.iso.datetime(),
  source: z.literal("bazionweb"),
  action: subscriptionLifecycleActionSchema,
  subscriptionId: externalIdSchema,
  externalCustomerId: externalIdSchema,
  externalOrderId: externalIdSchema,
  installationId: z.string().uuid().optional(),
  reasonCode: reasonCodeSchema,
  graceEndsAt: z.iso.datetime().nullable().optional(),
  targetConfigurationSchemaVersion: semverSchema.optional(),
}).strict().superRefine((command, context) => {
  if (command.action === "grace" && !command.graceEndsAt) {
    context.addIssue({
      code: "custom",
      path: ["graceEndsAt"],
      message: "Grace lifecycle commands must specify graceEndsAt.",
    });
  }
});

export type SubscriptionLifecycleCommandV1 = z.infer<typeof subscriptionLifecycleCommandV1Schema>;

export const subscriptionLifecycleInstallationStatusSchema = installationStatusSchema;

export const subscriptionLifecycleStatusEventV1Schema = z.object({
  schemaVersion: z.literal("1.0.0"),
  eventType: z.literal("product.subscription.lifecycle.status.v1"),
  eventId: z.string().uuid(),
  correlationId: z.string().uuid(),
  occurredAt: z.iso.datetime(),
  source: z.literal("bazion-platform"),
  lifecycle: z.object({
    schemaVersion: z.literal("1.0.0"),
    commandId: z.string().uuid(),
    action: subscriptionLifecycleActionSchema,
    subscriptionId: externalIdSchema,
    externalOrderId: externalIdSchema,
    tenantId: z.string().uuid().nullable(),
    installationId: z.string().uuid().nullable(),
    installationStatus: subscriptionLifecycleInstallationStatusSchema.nullable(),
    applied: z.boolean(),
    reasonCode: reasonCodeSchema,
    effectiveAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  }).strict(),
}).strict();

export type SubscriptionLifecycleStatusEventV1 = z.infer<typeof subscriptionLifecycleStatusEventV1Schema>;

/** Machine-readable subscription lifecycle command schema sent from Bazionweb to Bazion Platform. */
export function getSubscriptionLifecycleCommandV1JsonSchema() {
  return {
    ...z.toJSONSchema(subscriptionLifecycleCommandV1Schema, { target: "draft-2020-12" }),
    $id: "https://schemas.bazionweb.com/platform/subscription-lifecycle-command/1.0.0",
    title: "Bazion subscription lifecycle command v1",
    description: "Signed lifecycle transition command (activate, grace, suspend, reactivate, cancel) emitted from Bazionweb billing/dunning to Bazion Platform.",
    allOf: [
      {
        if: {
          properties: { action: { const: "grace" } },
          required: ["action"],
        },
        then: {
          properties: {
            graceEndsAt: { not: { type: "null" } },
          },
          required: ["graceEndsAt"],
        },
      },
    ],
  };
}

/** Machine-readable signed lifecycle callback schema emitted from Bazion Platform to Bazionweb. */
export function getSubscriptionLifecycleStatusEventV1JsonSchema() {
  return {
    ...z.toJSONSchema(subscriptionLifecycleStatusEventV1Schema, { target: "draft-2020-12" }),
    $id: "https://schemas.bazionweb.com/platform/subscription-lifecycle-status-event/1.0.0",
    title: "Bazion subscription lifecycle status event v1",
    description: "Signed callback event from Bazion Platform confirming installation status transitions applied for a commercial subscription lifecycle command.",
  };
}

export const installationOffboardRequestSchema = z.object({
  reason: z.string().trim().min(8).max(500),
  confirmDestructive: z.literal(true),
}).strict();

export const installationRestoreRequestSchema = z.object({
  reason: z.string().trim().min(8).max(500),
}).strict();

