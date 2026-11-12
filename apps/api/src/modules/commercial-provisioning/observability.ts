import { randomUUID } from "node:crypto";
import type {
  ProvisioningSloAlertV1,
  ProvisioningSloSnapshotV1,
  ProvisioningSloThresholdsV1,
} from "@bazion/api-contracts";
import { provisioningSloSnapshotV1Schema } from "@bazion/api-contracts";
import type { CommercialSqlPool } from "./service.js";
import type { CrossEntityReconciliationService } from "./reconciliation-service.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sensitiveKeyPattern =
  /(password|secret|token|cookie|authorization|credential|email|phone|contact|claims|payload|payment|signature|databaseurl|dsn|connectionstring|primarycontact|rawprovider)/i;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const bearerPattern = /\bBearer\s+[A-Za-z0-9._-]{8,}/gi;
const postgresUrlPattern = /\bpostgres(?:ql)?:\/\/[^\s"']+/gi;
const jwtPattern = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;

export const defaultProvisioningSloThresholds: ProvisioningSloThresholdsV1 = {
  commandAcceptanceSuccessRateMin: 0.99,
  commandAcceptanceP95MsMax: 1_500,
  provisionReadyP95SecondsMax: 300,
  callbackMaxLagSecondsMax: 120,
  deadLetterCountMax: 0,
  deadLetterMaxAgeSecondsMax: 300,
  operationLeaseAgeSecondsMax: 180,
  compensationRequiredCountMax: 0,
  reconciliationDriftCountMax: 0,
};

export const fastifySensitiveRedactionPaths = [
  "req.url",
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['x-cart-token']",
  "req.headers['x-dev-secret']",
  "req.headers['x-donation-status-token']",
  "req.headers['x-payment-status-token']",
  "req.headers['x-provisioning-signature']",
  "req.headers['x-webhook-signature']",
  "req.headers['set-cookie']",
  "req.body.customer.primaryContact",
  "req.body.customer.displayName",
  "req.body.payment",
  "req.body.credentials",
  "req.body.secrets",
  "res.headers['set-cookie']",
] as const;

/** Normalize or mint a valid UUID correlation identifier for request and worker propagation. */
export function resolveCorrelationId(candidate?: unknown): string {
  if (typeof candidate === "string") {
    const trimmed = candidate.trim();
    if (uuidPattern.test(trimmed)) {
      return trimmed.toLowerCase();
    }
  }
  return randomUUID();
}

/** Redact secrets, tokens, connection strings, and email PII from strings. */
export function redactSensitiveString(value: string): string {
  return value
    .replace(postgresUrlPattern, "[REDACTED_DSN]")
    .replace(bearerPattern, "Bearer [REDACTED]")
    .replace(jwtPattern, "[REDACTED_JWT]")
    .replace(emailPattern, "[REDACTED_EMAIL]");
}

/** Recursively sanitize structured telemetry/log payloads before emitting logs or alerts. */
export function redactStructuredContext(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactSensitiveString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (depth >= 5) return "[TRUNCATED]";
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redactStructuredContext(item, depth + 1));
  }
  if (typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if (sensitiveKeyPattern.test(key)) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = redactStructuredContext(raw, depth + 1);
      }
    }
    return sanitized;
  }
  return String(value);
}

/** Emit a structured single-line JSON log record with mandatory correlationId and strict redaction. */
export function emitStructuredProvisioningLog(
  level: "info" | "warn" | "error",
  event: string,
  correlationId: string,
  details: Readonly<Record<string, unknown>> = {},
): void {
  const safeCorrelationId = resolveCorrelationId(correlationId);
  const entry = {
    ts: new Date().toISOString(),
    level,
    component: "commercial-provisioning",
    event,
    correlationId: safeCorrelationId,
    ...(redactStructuredContext(details) as Record<string, unknown>),
  };
  const line = `${JSON.stringify(entry)}\n`;
  if (level === "error") {
    process.stderr.write(line);
  } else {
    process.stdout.write(line);
  }
}

interface AcceptanceSample {
  durationMs: number;
  succeeded: boolean;
}

function computeP95(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.95) - 1));
  return Number((sorted[index] ?? 0).toFixed(2));
}

/** Bounded in-memory telemetry tracker for request acceptance latency and worker outcomes. */
export class CommercialProvisioningTelemetry {
  private readonly acceptanceSamples: AcceptanceSample[] = [];
  private readonly maxSamples: number;

  constructor(maxSamples = 500) {
    this.maxSamples = Math.max(10, Math.min(5_000, maxSamples));
  }

  recordCommandAcceptance(input: { durationMs: number; succeeded: boolean }): void {
    if (this.acceptanceSamples.length >= this.maxSamples) {
      this.acceptanceSamples.shift();
    }
    this.acceptanceSamples.push({
      durationMs: Math.max(0, Number.isFinite(input.durationMs) ? input.durationMs : 0),
      succeeded: input.succeeded,
    });
  }

  getCommandAcceptanceStats(): { count: number; successRate: number; p95Ms: number } {
    const count = this.acceptanceSamples.length;
    if (count === 0) {
      return { count: 0, successRate: 1, p95Ms: 0 };
    }
    const succeededCount = this.acceptanceSamples.filter((s) => s.succeeded).length;
    return {
      count,
      successRate: Number((succeededCount / count).toFixed(4)),
      p95Ms: computeP95(this.acceptanceSamples.map((s) => s.durationMs)),
    };
  }
}

interface SloSqlRow {
  ready_count: number;
  ready_p95_seconds: number | null;
  ready_max_seconds: number | null;
  callback_pending_count: number;
  callback_overdue_count: number;
  callback_max_lag_seconds: number | null;
  dead_letter_count: number;
  dead_letter_max_age_seconds: number | null;
  active_lease_count: number;
  max_lease_age_seconds: number | null;
  compensation_required_count: number;
}

/** Evaluates live SLOs and alert thresholds from control-plane SQL state, reconciliation, and telemetry. */
export class ProvisioningSloService {
  constructor(
    private readonly provisionerPool: CommercialSqlPool,
    private readonly reconciliationService: Pick<CrossEntityReconciliationService, "reconcile">,
    private readonly telemetry: CommercialProvisioningTelemetry = new CommercialProvisioningTelemetry(),
    private readonly thresholds: ProvisioningSloThresholdsV1 = defaultProvisioningSloThresholds,
  ) {}

  async evaluate(correlationId?: string): Promise<ProvisioningSloSnapshotV1> {
    const resolvedCorrelationId = resolveCorrelationId(correlationId);
    const [sqlResult, reconReport] = await Promise.all([
      this.provisionerPool.query<SloSqlRow>(
        `WITH ready_ops AS (
           SELECT EXTRACT(EPOCH FROM (finished_at - accepted_at)) AS duration_seconds
             FROM public.product_provisioning_operations
            WHERE status = 'ready'
              AND finished_at IS NOT NULL
         ),
         pending_outboxes AS (
           SELECT status, next_attempt_at, lease_expires_at, created_at
             FROM public.product_provisioning_status_outbox
            WHERE status IN ('pending', 'processing')
           UNION ALL
           SELECT status, next_attempt_at, lease_expires_at, created_at
             FROM public.product_subscription_lifecycle_outbox
            WHERE status IN ('pending', 'processing')
         ),
         dead_outboxes AS (
           SELECT dead_lettered_at, updated_at
             FROM public.product_provisioning_status_outbox
            WHERE status = 'dead'
           UNION ALL
           SELECT dead_lettered_at, updated_at
             FROM public.product_subscription_lifecycle_outbox
            WHERE status = 'dead'
         )
         SELECT
           (SELECT count(*)::int FROM ready_ops) AS ready_count,
           (SELECT COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_seconds), 0)::float8 FROM ready_ops) AS ready_p95_seconds,
           (SELECT COALESCE(MAX(duration_seconds), 0)::float8 FROM ready_ops) AS ready_max_seconds,
           (SELECT count(*)::int FROM pending_outboxes) AS callback_pending_count,
           (SELECT count(*)::int FROM pending_outboxes
             WHERE (status = 'pending' AND next_attempt_at <= now() - interval '60 seconds')
                OR (status = 'processing' AND lease_expires_at <= now())) AS callback_overdue_count,
           (SELECT COALESCE(MAX(GREATEST(0, EXTRACT(EPOCH FROM (now() - created_at)))), 0)::float8 FROM pending_outboxes) AS callback_max_lag_seconds,
           (SELECT count(*)::int FROM dead_outboxes) AS dead_letter_count,
           (SELECT COALESCE(MAX(GREATEST(0, EXTRACT(EPOCH FROM (now() - COALESCE(dead_lettered_at, updated_at))))), 0)::float8 FROM dead_outboxes) AS dead_letter_max_age_seconds,
           (SELECT count(*)::int FROM public.product_provisioning_operations
             WHERE status IN ('accepted', 'validating', 'provisioning_tenant', 'configuring_installation', 'provisioning_hosting', 'compensating')
                OR (lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)) AS active_lease_count,
           (SELECT COALESCE(MAX(GREATEST(0, EXTRACT(EPOCH FROM (now() - updated_at)))), 0)::float8
              FROM public.product_provisioning_operations
             WHERE status IN ('accepted', 'validating', 'provisioning_tenant', 'configuring_installation', 'provisioning_hosting', 'compensating')
                OR (lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)) AS max_lease_age_seconds,
           (SELECT count(*)::int FROM public.product_provisioning_operations WHERE status = 'compensation_required') AS compensation_required_count`,
      ),
      this.reconciliationService.reconcile([], resolvedCorrelationId),
    ]);

    const row = sqlResult.rows[0] ?? {
      ready_count: 0,
      ready_p95_seconds: 0,
      ready_max_seconds: 0,
      callback_pending_count: 0,
      callback_overdue_count: 0,
      callback_max_lag_seconds: 0,
      dead_letter_count: 0,
      dead_letter_max_age_seconds: 0,
      active_lease_count: 0,
      max_lease_age_seconds: 0,
      compensation_required_count: 0,
    };

    const acceptance = this.telemetry.getCommandAcceptanceStats();
    const metrics = {
      commandAcceptanceCount: acceptance.count,
      commandAcceptanceSuccessRate: acceptance.successRate,
      commandAcceptanceP95Ms: acceptance.p95Ms,
      provisionReadyCount: row.ready_count,
      provisionReadyP95Seconds: Number((row.ready_p95_seconds ?? 0).toFixed(2)),
      provisionReadyMaxSeconds: Number((row.ready_max_seconds ?? 0).toFixed(2)),
      callbackPendingCount: row.callback_pending_count,
      callbackOverdueCount: row.callback_overdue_count,
      callbackMaxLagSeconds: Number((row.callback_max_lag_seconds ?? 0).toFixed(2)),
      deadLetterCount: row.dead_letter_count,
      deadLetterMaxAgeSeconds: Number((row.dead_letter_max_age_seconds ?? 0).toFixed(2)),
      activeOperationLeaseCount: row.active_lease_count,
      maxOperationLeaseAgeSeconds: Number((row.max_lease_age_seconds ?? 0).toFixed(2)),
      compensationRequiredCount: row.compensation_required_count,
      reconciliationDriftCount: reconReport.summary.unresolvedDriftCount,
    };

    const alerts = evaluateSloAlerts(metrics, this.thresholds);
    const hasCritical = alerts.some((a) => a.severity === "critical");
    const status = hasCritical ? "critical" : alerts.length > 0 ? "degraded" : "healthy";

    return provisioningSloSnapshotV1Schema.parse({
      schemaVersion: "1.0.0",
      generatedAt: new Date().toISOString(),
      status,
      metrics,
      thresholds: this.thresholds,
      alerts,
    });
  }
}

/** Deterministic alert rule evaluation from computed SLO metrics and thresholds. */
export function evaluateSloAlerts(
  metrics: ProvisioningSloSnapshotV1["metrics"],
  thresholds: ProvisioningSloThresholdsV1,
): ProvisioningSloAlertV1[] {
  const alerts: ProvisioningSloAlertV1[] = [];

  if (metrics.commandAcceptanceCount > 0 && metrics.commandAcceptanceSuccessRate < thresholds.commandAcceptanceSuccessRateMin) {
    alerts.push({
      id: "command_acceptance_success_rate",
      metric: "commandAcceptanceSuccessRate",
      severity: "critical",
      owner: "platform_ops",
      observedValue: metrics.commandAcceptanceSuccessRate,
      thresholdValue: thresholds.commandAcceptanceSuccessRateMin,
      message: "Commercial provisioning command acceptance success rate fell below SLO threshold.",
      runbookSection: "command-acceptance-failures",
    });
  }

  if (metrics.commandAcceptanceP95Ms > thresholds.commandAcceptanceP95MsMax) {
    alerts.push({
      id: "command_acceptance_latency_p95",
      metric: "commandAcceptanceP95Ms",
      severity: "warning",
      owner: "platform_ops",
      observedValue: metrics.commandAcceptanceP95Ms,
      thresholdValue: thresholds.commandAcceptanceP95MsMax,
      message: "Command acceptance p95 latency exceeds SLO target.",
      runbookSection: "command-acceptance-latency",
    });
  }

  if (metrics.provisionReadyP95Seconds > thresholds.provisionReadyP95SecondsMax) {
    alerts.push({
      id: "provision_ready_latency_p95",
      metric: "provisionReadyP95Seconds",
      severity: "warning",
      owner: "platform_ops",
      observedValue: metrics.provisionReadyP95Seconds,
      thresholdValue: thresholds.provisionReadyP95SecondsMax,
      message: "Provisioning time-to-ready p95 exceeds SLO target.",
      runbookSection: "saga-recovery-and-resume",
    });
  }

  if (metrics.callbackMaxLagSeconds > thresholds.callbackMaxLagSecondsMax) {
    alerts.push({
      id: "callback_outbox_lag",
      metric: "callbackMaxLagSeconds",
      severity: metrics.callbackMaxLagSeconds > thresholds.callbackMaxLagSecondsMax * 5 ? "critical" : "warning",
      owner: "platform_ops",
      observedValue: metrics.callbackMaxLagSeconds,
      thresholdValue: thresholds.callbackMaxLagSecondsMax,
      message: "Pending commercial webhook status/lifecycle callback lag exceeds SLO target.",
      runbookSection: "outbox-replay",
    });
  }

  if (
    metrics.deadLetterCount > thresholds.deadLetterCountMax
    || metrics.deadLetterMaxAgeSeconds > thresholds.deadLetterMaxAgeSecondsMax
  ) {
    alerts.push({
      id: "outbox_dead_letter_backlog",
      metric: "deadLetterCount",
      severity: "critical",
      owner: "platform_ops",
      observedValue: metrics.deadLetterCount,
      thresholdValue: thresholds.deadLetterCountMax,
      message: "Dead-lettered commercial status or lifecycle callback messages require operator replay.",
      runbookSection: "outbox-replay",
    });
  }

  if (metrics.maxOperationLeaseAgeSeconds > thresholds.operationLeaseAgeSecondsMax) {
    alerts.push({
      id: "operation_lease_age",
      metric: "maxOperationLeaseAgeSeconds",
      severity: metrics.maxOperationLeaseAgeSeconds > thresholds.operationLeaseAgeSecondsMax * 2 ? "critical" : "warning",
      owner: "platform_ops",
      observedValue: metrics.maxOperationLeaseAgeSeconds,
      thresholdValue: thresholds.operationLeaseAgeSecondsMax,
      message: "Active provisioning operation age exceeds lease expectation.",
      runbookSection: "saga-recovery-and-resume",
    });
  }

  if (metrics.compensationRequiredCount > thresholds.compensationRequiredCountMax) {
    alerts.push({
      id: "compensation_required_backlog",
      metric: "compensationRequiredCount",
      severity: "critical",
      owner: "platform_ops",
      observedValue: metrics.compensationRequiredCount,
      thresholdValue: thresholds.compensationRequiredCountMax,
      message: "Provisioning operations halted in compensation_required need manual review.",
      runbookSection: "safe-compensation",
    });
  }

  if (metrics.reconciliationDriftCount > thresholds.reconciliationDriftCountMax) {
    alerts.push({
      id: "reconciliation_drift_detected",
      metric: "reconciliationDriftCount",
      severity: "critical",
      owner: "platform_ops",
      observedValue: metrics.reconciliationDriftCount,
      thresholdValue: thresholds.reconciliationDriftCountMax,
      message: "Cross-entity reconciliation drift detected across orders, operations, installations, entitlements, or hosting.",
      runbookSection: "reconciliation-exceptions",
    });
  }

  return alerts;
}
