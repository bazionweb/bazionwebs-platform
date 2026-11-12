import { PostgresAuditEventWriter } from "@bazion/audit";
import type {
  CutoverGateResultV1,
  CutoverReadinessReportV1,
  OperationalDrillType,
  PilotCohortPolicyV1,
  PilotMode,
  ProvisioningOfferCatalogV1,
  ProvisionProductRequestV1,
  RecordOperationalDrillRequestV1,
} from "@bazion/api-contracts";
import {
  cutoverReadinessReportV1Schema,
  pilotCohortPolicyV1Schema,
  provisioningOfferCatalogV1Schema,
} from "@bazion/api-contracts";
import type { AuditSqlExecutor } from "@bazion/audit";
import {
  getProvisioningOfferCatalogV1,
  platformProvisioningOfferBindings,
  ProvisioningOfferResolutionError,
  type ProvisioningOfferBinding,
} from "./offer-resolution.js";
import type { ProvisioningSloService } from "./observability.js";
import type { CrossEntityReconciliationService } from "./reconciliation-service.js";
import { CommercialProvisioningError } from "./service.js";

/**
 * Validated non-production staging pilot binding: one real commercial offer (`website-launch`),
 * one real buildable release triad (`church-ministry` v1.0.0), shared-managed only (no Dokploy).
 * Production `platformProvisioningOfferBindings` stays closed (`[]`) until manifests reach `stable`.
 */
export const stagingPilotOfferBindings: readonly ProvisioningOfferBinding[] = [
  {
    offer: { id: "website-launch", version: "1.0.0" },
    composition: {
      product: { id: "church-ministry", version: "1.0.0" },
      solution: { id: "church-ministry", version: "1.0.0" },
      template: { id: "church-ministry", version: "1.0.0" },
    },
    requiredModules: [
      { id: "platform-identity", version: "1.0.0" },
      { id: "church-ministry", version: "1.0.0" },
      { id: "media-storage", version: "1.0.0" },
    ],
    optionalModules: [],
    distributionMode: "shared-managed",
    availability: "active",
    releaseState: {
      product: "partial",
      solution: "partial",
      solutionReadiness: "buildable",
      template: "partial",
    },
  },
];

export interface PilotPolicyInput {
  pilotMode: PilotMode;
  nodeEnv: string;
  hostingMutationsEnabled: boolean;
  legacyFallbackEnabled: boolean;
  dualReadReconciliationEnabled: boolean;
  allowedCustomerIds?: readonly string[];
  allowedOffers?: readonly string[];
}

function parseOfferRule(entry: string): { offerId: string; offerVersion: string; distributionMode: "shared-managed" } | null {
  const trimmed = entry.trim();
  if (!trimmed) return null;
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === trimmed.length - 1) {
    throw new Error(`Invalid canary offer rule "${trimmed}". Expected "<offerId>@<offerVersion>".`);
  }
  return {
    offerId: trimmed.slice(0, atIndex).trim(),
    offerVersion: trimmed.slice(atIndex + 1).trim(),
    distributionMode: "shared-managed",
  };
}

/** Resolve and validate the runtime pilot / canary cohort policy. */
export function resolvePilotCohortPolicy(input: PilotPolicyInput): PilotCohortPolicyV1 {
  const isProd = input.nodeEnv === "production";
  if (isProd && input.pilotMode === "staging_pilot") {
    throw new Error("Production startup blocked: COMMERCIAL_PROVISIONING_PILOT_MODE=staging_pilot is forbidden in production.");
  }

  const parsedCustomers = (input.allowedCustomerIds ?? [])
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  const parsedOffers = (input.allowedOffers ?? [])
    .map(parseOfferRule)
    .filter((rule): rule is NonNullable<typeof rule> => rule !== null);

  if (isProd && input.pilotMode === "canary" && parsedCustomers.length === 0) {
    throw new Error("Production canary mode requires an explicit COMMERCIAL_PROVISIONING_CANARY_CUSTOMERS cohort.");
  }

  const bindings = getEffectiveOfferBindingsForMode(input.pilotMode, parsedOffers);
  const effectiveOffers =
    input.pilotMode === "staging_pilot" && parsedOffers.length === 0
      ? stagingPilotOfferBindings.map((b) => ({
          offerId: b.offer.id,
          offerVersion: b.offer.version,
          distributionMode: "shared-managed" as const,
        }))
      : parsedOffers.length > 0
        ? parsedOffers
        : bindings.map((b) => ({
            offerId: b.offer.id,
            offerVersion: b.offer.version,
            distributionMode: "shared-managed" as const,
          }));

  return pilotCohortPolicyV1Schema.parse({
    schemaVersion: "1.0.0",
    pilotMode: input.pilotMode,
    environment: input.nodeEnv,
    productionAllowlistClosed: platformProvisioningOfferBindings.length === 0,
    hostingMutationsEnabled: input.hostingMutationsEnabled,
    legacyFallbackEnabled: input.legacyFallbackEnabled,
    dualReadReconciliationEnabled: input.dualReadReconciliationEnabled,
    allowedOffers: effectiveOffers,
    allowedCustomerIds: parsedCustomers,
  });
}

/** Return the offer bindings allowed by the configured pilot/canary mode. */
export function getEffectiveOfferBindingsForMode(
  pilotMode: PilotMode,
  allowedOffers: readonly { offerId: string; offerVersion: string }[] = [],
  baseProdBindings: readonly ProvisioningOfferBinding[] = platformProvisioningOfferBindings,
): readonly ProvisioningOfferBinding[] {
  if (pilotMode === "disabled") {
    return baseProdBindings;
  }

  const pool = pilotMode === "staging_pilot"
    ? [...baseProdBindings, ...stagingPilotOfferBindings]
    : baseProdBindings.filter(
        (b) => b.releaseState.product === "stable"
          && b.releaseState.solution === "stable"
          && b.releaseState.solutionReadiness === "buildable"
          && b.releaseState.template === "stable",
      );

  if (allowedOffers.length === 0) {
    return pool;
  }

  return pool.filter((binding) =>
    allowedOffers.some((rule) => rule.offerId === binding.offer.id && rule.offerVersion === binding.offer.version),
  );
}

/** Build the catalog response aligned with the current pilot/canary policy. */
export function getProvisioningCatalogForPolicy(policy: PilotCohortPolicyV1): ProvisioningOfferCatalogV1 {
  if (policy.pilotMode === "disabled") {
    return getProvisioningOfferCatalogV1();
  }
  const activeBindings = getEffectiveOfferBindingsForMode(policy.pilotMode, policy.allowedOffers)
    .filter((b) => b.availability === "active" && b.distributionMode === "shared-managed")
    .map(({ offer, composition, requiredModules, optionalModules, distributionMode }) => ({
      offer,
      composition,
      requiredModules,
      optionalModules,
      distributionMode,
    }));

  return provisioningOfferCatalogV1Schema.parse({
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    bindings: activeBindings,
  });
}

/** Enforce cohort customer allowlist and shared-managed pilot invariants on inbound commands. */
export function assertCommandAllowedByCohortPolicy(
  request: ProvisionProductRequestV1,
  policy: PilotCohortPolicyV1,
): void {
  if (policy.pilotMode === "disabled") {
    return;
  }
  if (policy.allowedCustomerIds.length > 0 && !policy.allowedCustomerIds.includes(request.customer.externalCustomerId)) {
    throw new CommercialProvisioningError(
      422,
      "PROVISIONING_CUSTOMER_NOT_IN_PILOT_COHORT",
      "Customer is not enrolled in the active provisioning pilot/canary cohort.",
    );
  }
  if (
    policy.allowedOffers.length > 0
    && !policy.allowedOffers.some((o) => o.offerId === request.order.offerId && o.offerVersion === request.order.offerVersion)
  ) {
    throw new ProvisioningOfferResolutionError("PROVISIONING_OFFER_NOT_BOUND");
  }
}

const ALL_DRILL_ACTIONS: readonly OperationalDrillType[] = [
  "database_restore",
  "archive_restore",
  "rollback_window",
  "staging_pilot_signoff",
  "canary_cohort_signoff",
];

interface AuditDrillRow {
  action: string;
  occurred_at: Date | string;
}

/** Records verification drills and evaluates canary / cutover / legacy-removal readiness gates. */
export class CutoverReadinessService {
  constructor(
    private readonly policy: PilotCohortPolicyV1,
    private readonly sloService: Pick<ProvisioningSloService, "evaluate">,
    private readonly reconciliationService: Pick<CrossEntityReconciliationService, "reconcile">,
    private readonly auditExecutor: (AuditSqlExecutor & {
      query<T = Record<string, unknown>>(statement: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
    }) | null,
  ) {}

  async recordDrill(input: {
    actorId: string;
    actorRole: string;
    requestId: string;
    payload: RecordOperationalDrillRequestV1;
  }): Promise<void> {
    if (!this.auditExecutor) {
      throw new CommercialProvisioningError(503, "AUDIT_STORAGE_UNAVAILABLE", "Audit storage is required to record verification drills.");
    }
    const writer = new PostgresAuditEventWriter(this.auditExecutor);
    await writer.append({
      actorType: "user",
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: `commercial_provisioning.drill.${input.payload.drillType}`,
      resourceType: "commercial_cutover_gate",
      resourceId: input.payload.evidenceRef,
      outcome: "succeeded",
      requestId: input.requestId,
      metadata: {
        drillType: input.payload.drillType,
        summary: input.payload.summary,
      },
    });
  }

  async evaluate(correlationId?: string): Promise<CutoverReadinessReportV1> {
    const [sloSnapshot, reconciliation, drillTimestamps] = await Promise.all([
      this.sloService.evaluate(correlationId),
      this.reconciliationService.reconcile([], correlationId),
      this.loadLatestDrillTimestamps(),
    ]);

    const cutoffMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const isFreshDrill = (type: OperationalDrillType): string | null => {
      const ts = drillTimestamps.get(type) ?? null;
      if (!ts) return null;
      return Date.parse(ts) >= cutoffMs ? ts : null;
    };

    const stagingTs = isFreshDrill("staging_pilot_signoff");
    const dbDrillTs = isFreshDrill("database_restore");
    const archiveDrillTs = isFreshDrill("archive_restore");
    const canaryTs = isFreshDrill("canary_cohort_signoff");
    const rollbackTs = isFreshDrill("rollback_window");

    const gates: CutoverGateResultV1[] = [
      {
        id: "production_allowlist_invariant",
        name: "Production offer allowlist remains safe/explicit",
        passed: platformProvisioningOfferBindings.length === 0
          || platformProvisioningOfferBindings.every(
            (b) => b.releaseState.product === "stable"
              && b.releaseState.solution === "stable"
              && b.releaseState.solutionReadiness === "buildable"
              && b.releaseState.template === "stable",
          ),
        blocking: true,
        owner: "platform_ops",
        detail: platformProvisioningOfferBindings.length === 0
          ? "Production allowlist is safely closed until stable platform releases are promoted."
          : "All bound production offers reference buildable stable releases.",
        lastVerifiedAt: null,
      },
      {
        id: "shared_managed_non_dokploy",
        name: "Hosting mutations remain disabled during shared-managed pilot",
        passed: !this.policy.hostingMutationsEnabled,
        blocking: true,
        owner: "hosting_control",
        detail: !this.policy.hostingMutationsEnabled
          ? "Hosting provider mutations are disabled for the shared-managed pilot."
          : "Hosting mutations are enabled; verify dedicated mode approval before cutover.",
        lastVerifiedAt: null,
      },
      {
        id: "zero_reconciliation_drift",
        name: "Zero unresolved cross-entity reconciliation drift",
        passed: reconciliation.summary.unresolvedDriftCount === 0,
        blocking: true,
        owner: "platform_ops",
        detail: `${reconciliation.summary.unresolvedDriftCount} unresolved reconciliation exception(s) detected.`,
        lastVerifiedAt: reconciliation.generatedAt,
      },
      {
        id: "zero_compensation_and_dlq_backlog",
        name: "Zero compensation_required and dead-letter outbox backlog",
        passed: sloSnapshot.metrics.compensationRequiredCount === 0 && sloSnapshot.metrics.deadLetterCount === 0,
        blocking: true,
        owner: "platform_ops",
        detail: `compensation_required=${sloSnapshot.metrics.compensationRequiredCount}, dead_letters=${sloSnapshot.metrics.deadLetterCount}.`,
        lastVerifiedAt: sloSnapshot.generatedAt,
      },
      {
        id: "slo_health_green",
        name: "Provisioning SLOs healthy",
        passed: sloSnapshot.status === "healthy",
        blocking: true,
        owner: "platform_ops",
        detail: `SLO status=${sloSnapshot.status} with ${sloSnapshot.alerts.length} active alert(s).`,
        lastVerifiedAt: sloSnapshot.generatedAt,
      },
      {
        id: "staging_pilot_verified",
        name: "Staging pilot sign-off recorded within 30 days",
        passed: Boolean(stagingTs),
        blocking: true,
        owner: "platform_ops",
        detail: stagingTs ? `Verified at ${stagingTs}.` : "No recent staging_pilot_signoff drill event recorded.",
        lastVerifiedAt: stagingTs,
      },
      {
        id: "database_restore_drill_verified",
        name: "Database backup & restore drill verified within 30 days",
        passed: Boolean(dbDrillTs),
        blocking: true,
        owner: "platform_ops",
        detail: dbDrillTs ? `Verified at ${dbDrillTs}.` : "No recent database_restore drill event recorded.",
        lastVerifiedAt: dbDrillTs,
      },
      {
        id: "archive_restore_drill_verified",
        name: "30-day archive restore drill verified within 30 days",
        passed: Boolean(archiveDrillTs),
        blocking: true,
        owner: "platform_ops",
        detail: archiveDrillTs ? `Verified at ${archiveDrillTs}.` : "No recent archive_restore drill event recorded.",
        lastVerifiedAt: archiveDrillTs,
      },
      {
        id: "canary_and_rollback_window_verified",
        name: "Paid canary cohort & rollback window sign-off recorded",
        passed: Boolean(canaryTs && rollbackTs),
        blocking: true,
        owner: "commercial_billing",
        detail: canaryTs && rollbackTs
          ? `Canary verified ${canaryTs}; rollback window verified ${rollbackTs}.`
          : "Requires both canary_cohort_signoff and rollback_window drill events.",
        lastVerifiedAt: rollbackTs ?? canaryTs,
      },
    ];

    const byId = new Map(gates.map((g) => [g.id, g.passed]));
    const readyForStagingPilot = Boolean(
      byId.get("production_allowlist_invariant")
      && byId.get("shared_managed_non_dokploy")
      && byId.get("zero_reconciliation_drift")
      && byId.get("zero_compensation_and_dlq_backlog"),
    );
    const readyForCanary = Boolean(
      readyForStagingPilot
      && byId.get("slo_health_green")
      && byId.get("staging_pilot_verified")
      && byId.get("database_restore_drill_verified")
      && byId.get("archive_restore_drill_verified"),
    );
    const readyToRemoveLegacyProvisioning = gates.every((g) => !g.blocking || g.passed);

    return cutoverReadinessReportV1Schema.parse({
      schemaVersion: "1.0.0",
      evaluatedAt: new Date().toISOString(),
      pilotPolicy: this.policy,
      readyForStagingPilot,
      readyForCanary,
      readyToRemoveLegacyProvisioning,
      gates,
    });
  }

  private async loadLatestDrillTimestamps(): Promise<Map<OperationalDrillType, string>> {
    const map = new Map<OperationalDrillType, string>();
    if (!this.auditExecutor) {
      return map;
    }
    const actions = ALL_DRILL_ACTIONS.map((type) => `commercial_provisioning.drill.${type}`);
    const result = await this.auditExecutor.query<AuditDrillRow>(
      `SELECT action, max(occurred_at) AS occurred_at
         FROM public.platform_audit_events
        WHERE action = ANY($1::text[])
          AND outcome = 'succeeded'
        GROUP BY action`,
      [actions],
    ).catch(() => ({ rows: [] as AuditDrillRow[], rowCount: 0 }));

    for (const row of result.rows) {
      const drillType = row.action.replace("commercial_provisioning.drill.", "") as OperationalDrillType;
      const date = row.occurred_at instanceof Date ? row.occurred_at : new Date(row.occurred_at);
      if (!Number.isNaN(date.getTime())) {
        map.set(drillType, date.toISOString());
      }
    }
    return map;
  }
}

