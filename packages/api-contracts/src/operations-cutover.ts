import { z } from "zod";

const nonEmptyId = (max = 128) => z.string().trim().min(1).max(max);
const uuidSchema = z.string().uuid();
const isoDatetimeSchema = z.string().datetime({ offset: true });
const noEmailOrSecretString = (max = 160) =>
  z.string().trim().min(1).max(max).refine((value) => !value.includes("@"), {
    message: "Operational identifiers must be opaque IDs, not email addresses.",
  });

export const pilotModeSchema = z.enum(["disabled", "staging_pilot", "canary"]);
export type PilotMode = z.infer<typeof pilotModeSchema>;

export const pilotCohortOfferRuleV1Schema = z.object({
  offerId: nonEmptyId(120),
  offerVersion: nonEmptyId(64),
  distributionMode: z.literal("shared-managed"),
}).strict();

export const pilotCohortPolicyV1Schema = z.object({
  schemaVersion: z.literal("1.0.0"),
  pilotMode: pilotModeSchema,
  environment: z.string().trim().min(1).max(32),
  productionAllowlistClosed: z.boolean(),
  hostingMutationsEnabled: z.boolean(),
  legacyFallbackEnabled: z.boolean(),
  dualReadReconciliationEnabled: z.boolean(),
  allowedOffers: z.array(pilotCohortOfferRuleV1Schema).max(50),
  allowedCustomerIds: z.array(noEmailOrSecretString(120)).max(200),
}).strict();

export type PilotCohortPolicyV1 = z.infer<typeof pilotCohortPolicyV1Schema>;

export const commercialPaidOrderSnapshotV1Schema = z.object({
  externalOrderId: noEmailOrSecretString(120),
  externalCustomerId: noEmailOrSecretString(120),
  offerId: nonEmptyId(120),
  offerVersion: nonEmptyId(64),
  paymentStatus: z.enum(["paid", "refunded", "canceled"]),
  paidAt: isoDatetimeSchema,
  operationId: uuidSchema.nullable().optional(),
  tenantId: uuidSchema.nullable().optional(),
  installationId: uuidSchema.nullable().optional(),
  provisioningStatus: z.enum([
    "pending",
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
  ]),
  legacyFallbackUsed: z.boolean().default(false),
  legacyTenantId: uuidSchema.nullable().optional(),
}).strict();

export type CommercialPaidOrderSnapshotV1 = z.infer<typeof commercialPaidOrderSnapshotV1Schema>;

export const crossEntityReconciliationRequestV1Schema = z.object({
  schemaVersion: z.literal("1.0.0"),
  correlationId: uuidSchema.optional(),
  paidOrders: z.array(commercialPaidOrderSnapshotV1Schema).max(1000).default([]),
}).strict();

export type CrossEntityReconciliationRequestV1 = z.infer<typeof crossEntityReconciliationRequestV1Schema>;

export const reconciliationMismatchTypeSchema = z.enum([
  "paid_order_missing_operation",
  "operation_missing_paid_order",
  "operation_order_status_drift",
  "operation_inbox_mismatch",
  "ready_operation_missing_installation",
  "installation_status_drift",
  "installation_missing_module_entitlements",
  "entitlement_mismatch",
  "shared_managed_unexpected_hosting_deployment",
  "dedicated_installation_missing_hosting_deployment",
  "hosting_deployment_state_drift",
  "stale_operation_lease",
  "compensation_required_pending",
  "outbox_dead_letter",
  "lifecycle_outbox_dead_letter",
  "offboarded_installation_missing_archive",
  "tenant_status_drift",
  "dual_read_legacy_mismatch",
]);

export type ReconciliationMismatchType = z.infer<typeof reconciliationMismatchTypeSchema>;

export const operationalOwnerSchema = z.enum([
  "platform_ops",
  "commercial_billing",
  "hosting_control",
  "customer_support",
]);

export type OperationalOwner = z.infer<typeof operationalOwnerSchema>;

export const reconciliationExceptionV1Schema = z.object({
  id: nonEmptyId(200),
  mismatchType: reconciliationMismatchTypeSchema,
  severity: z.enum(["critical", "high", "medium", "low"]),
  owner: operationalOwnerSchema,
  ageSeconds: z.number().int().min(0),
  detectedAt: isoDatetimeSchema,
  entityRefs: z.object({
    externalOrderId: noEmailOrSecretString(120).nullable().optional(),
    operationId: uuidSchema.nullable().optional(),
    tenantId: uuidSchema.nullable().optional(),
    installationId: uuidSchema.nullable().optional(),
    deploymentId: uuidSchema.nullable().optional(),
    outboxId: uuidSchema.nullable().optional(),
    moduleId: nonEmptyId(64).nullable().optional(),
  }).strict(),
  summary: nonEmptyId(320),
  recommendedAction: nonEmptyId(320),
}).strict();

export type ReconciliationExceptionV1 = z.infer<typeof reconciliationExceptionV1Schema>;

export const crossEntityReconciliationReportV1Schema = z.object({
  schemaVersion: z.literal("1.0.0"),
  generatedAt: isoDatetimeSchema,
  scope: z.enum(["platform_only", "cross_repo_five_way"]),
  correlationId: uuidSchema,
  summary: z.object({
    ordersChecked: z.number().int().min(0),
    operationsChecked: z.number().int().min(0),
    installationsChecked: z.number().int().min(0),
    entitlementsChecked: z.number().int().min(0),
    deploymentsChecked: z.number().int().min(0),
    totalExceptions: z.number().int().min(0),
    criticalExceptions: z.number().int().min(0),
    unresolvedDriftCount: z.number().int().min(0),
  }).strict(),
  exceptions: z.array(reconciliationExceptionV1Schema),
}).strict();

export type CrossEntityReconciliationReportV1 = z.infer<typeof crossEntityReconciliationReportV1Schema>;

export const provisioningSloThresholdsV1Schema = z.object({
  commandAcceptanceSuccessRateMin: z.number().min(0).max(1),
  commandAcceptanceP95MsMax: z.number().positive(),
  provisionReadyP95SecondsMax: z.number().positive(),
  callbackMaxLagSecondsMax: z.number().nonnegative(),
  deadLetterCountMax: z.number().int().min(0),
  deadLetterMaxAgeSecondsMax: z.number().nonnegative(),
  operationLeaseAgeSecondsMax: z.number().nonnegative(),
  compensationRequiredCountMax: z.number().int().min(0),
  reconciliationDriftCountMax: z.number().int().min(0),
}).strict();

export type ProvisioningSloThresholdsV1 = z.infer<typeof provisioningSloThresholdsV1Schema>;

export const provisioningSloAlertV1Schema = z.object({
  id: nonEmptyId(120),
  metric: nonEmptyId(80),
  severity: z.enum(["warning", "critical"]),
  owner: operationalOwnerSchema,
  observedValue: z.number().finite(),
  thresholdValue: z.number().finite(),
  message: nonEmptyId(320),
  runbookSection: nonEmptyId(120),
}).strict();

export type ProvisioningSloAlertV1 = z.infer<typeof provisioningSloAlertV1Schema>;

export const provisioningSloSnapshotV1Schema = z.object({
  schemaVersion: z.literal("1.0.0"),
  generatedAt: isoDatetimeSchema,
  status: z.enum(["healthy", "degraded", "critical"]),
  metrics: z.object({
    commandAcceptanceCount: z.number().int().min(0),
    commandAcceptanceSuccessRate: z.number().min(0).max(1),
    commandAcceptanceP95Ms: z.number().min(0),
    provisionReadyCount: z.number().int().min(0),
    provisionReadyP95Seconds: z.number().min(0),
    provisionReadyMaxSeconds: z.number().min(0),
    callbackPendingCount: z.number().int().min(0),
    callbackOverdueCount: z.number().int().min(0),
    callbackMaxLagSeconds: z.number().min(0),
    deadLetterCount: z.number().int().min(0),
    deadLetterMaxAgeSeconds: z.number().min(0),
    activeOperationLeaseCount: z.number().int().min(0),
    maxOperationLeaseAgeSeconds: z.number().min(0),
    compensationRequiredCount: z.number().int().min(0),
    reconciliationDriftCount: z.number().int().min(0),
  }).strict(),
  thresholds: provisioningSloThresholdsV1Schema,
  alerts: z.array(provisioningSloAlertV1Schema),
}).strict();

export type ProvisioningSloSnapshotV1 = z.infer<typeof provisioningSloSnapshotV1Schema>;

export const operationalDrillTypeSchema = z.enum([
  "database_restore",
  "archive_restore",
  "rollback_window",
  "staging_pilot_signoff",
  "canary_cohort_signoff",
]);

export type OperationalDrillType = z.infer<typeof operationalDrillTypeSchema>;

export const recordOperationalDrillRequestV1Schema = z.object({
  drillType: operationalDrillTypeSchema,
  summary: nonEmptyId(240),
  evidenceRef: noEmailOrSecretString(128),
}).strict();

export type RecordOperationalDrillRequestV1 = z.infer<typeof recordOperationalDrillRequestV1Schema>;

export const cutoverGateResultV1Schema = z.object({
  id: nonEmptyId(80),
  name: nonEmptyId(160),
  passed: z.boolean(),
  blocking: z.boolean(),
  owner: operationalOwnerSchema,
  detail: nonEmptyId(320),
  lastVerifiedAt: isoDatetimeSchema.nullable(),
}).strict();

export type CutoverGateResultV1 = z.infer<typeof cutoverGateResultV1Schema>;

export const cutoverReadinessReportV1Schema = z.object({
  schemaVersion: z.literal("1.0.0"),
  evaluatedAt: isoDatetimeSchema,
  pilotPolicy: pilotCohortPolicyV1Schema,
  readyForStagingPilot: z.boolean(),
  readyForCanary: z.boolean(),
  readyToRemoveLegacyProvisioning: z.boolean(),
  gates: z.array(cutoverGateResultV1Schema),
}).strict();

export type CutoverReadinessReportV1 = z.infer<typeof cutoverReadinessReportV1Schema>;

