import { z } from "zod";

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

export const subscriptionLifecycleInstallationStatusSchema = z.enum([
  "requested",
  "provisioning",
  "ready",
  "suspended",
  "failed",
  "offboarding",
  "offboarded",
]);

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

export const installationOffboardRequestSchema = z.object({
  reason: z.string().trim().min(8).max(500),
  confirmDestructive: z.literal(true),
}).strict();

export const installationRestoreRequestSchema = z.object({
  reason: z.string().trim().min(8).max(500),
}).strict();

