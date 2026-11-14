"use client";

import { useState, type FormEvent } from "react";
import { assertOk, pulse } from "@bazion/ui";

export type OperationalDrillType =
  | "database_restore"
  | "archive_restore"
  | "rollback_window"
  | "staging_pilot_signoff"
  | "canary_cohort_signoff";

export interface ProvisioningSloSnapshot {
  schemaVersion: string;
  generatedAt: string;
  status: "healthy" | "degraded" | "critical";
  metrics: {
    commandAcceptanceCount: number;
    commandAcceptanceSuccessRate: number;
    commandAcceptanceP95Ms: number;
    provisionReadyCount: number;
    provisionReadyP95Seconds: number;
    provisionReadyMaxSeconds: number;
    callbackPendingCount: number;
    callbackOverdueCount: number;
    callbackMaxLagSeconds: number;
    deadLetterCount: number;
    deadLetterMaxAgeSeconds: number;
    activeOperationLeaseCount: number;
    maxOperationLeaseAgeSeconds: number;
    compensationRequiredCount: number;
    reconciliationDriftCount: number;
  };
  alerts: Array<{
    id: string;
    metric: string;
    severity: "warning" | "critical";
    owner: string;
    observedValue: number;
    thresholdValue: number;
    message: string;
    runbookSection: string;
  }>;
}

export interface CrossEntityReconciliationReport {
  schemaVersion: string;
  generatedAt: string;
  scope: "platform_only" | "cross_repo_five_way";
  correlationId: string;
  summary: {
    ordersChecked: number;
    operationsChecked: number;
    installationsChecked: number;
    entitlementsChecked: number;
    deploymentsChecked: number;
    totalExceptions: number;
    criticalExceptions: number;
    unresolvedDriftCount: number;
  };
  exceptions: Array<{
    id: string;
    mismatchType: string;
    severity: "critical" | "high" | "medium" | "low";
    owner: string;
    ageSeconds: number;
    detectedAt: string;
    entityRefs: Record<string, string | null | undefined>;
    summary: string;
    recommendedAction: string;
  }>;
}

export interface CutoverReadinessReport {
  schemaVersion: string;
  evaluatedAt: string;
  pilotPolicy: {
    pilotMode: string;
    productionAllowlistClosed: boolean;
    hostingMutationsEnabled: boolean;
    legacyFallbackEnabled: boolean;
    dualReadReconciliationEnabled: boolean;
  };
  readyForStagingPilot: boolean;
  readyForCanary: boolean;
  readyToRemoveLegacyProvisioning: boolean;
  gates: Array<{
    id: string;
    name: string;
    passed: boolean;
    blocking: boolean;
    owner: string;
    detail: string;
    lastVerifiedAt: string | null;
  }>;
}

interface CutoverSloPanelProps {
  initialSlo: ProvisioningSloSnapshot | null;
  initialReconciliation: CrossEntityReconciliationReport | null;
  initialCutover: CutoverReadinessReport | null;
  initialErrorStatus: number | null;
  platformRole: "platform_owner" | "platform_admin" | "platform_support" | null;
}

function statusPillClass(status: string): string {
  if (status === "healthy" || status === "passed" || status === "ok") return "ok";
  if (status === "degraded" || status === "warning" || status === "high" || status === "medium") return "warn";
  return "bad";
}

function formatAgeSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export function CutoverSloPanel({
  initialSlo,
  initialReconciliation,
  initialCutover,
  initialErrorStatus,
  platformRole,
}: CutoverSloPanelProps) {
  const [slo, setSlo] = useState<ProvisioningSloSnapshot | null>(initialSlo);
  const [reconciliation, setReconciliation] = useState<CrossEntityReconciliationReport | null>(initialReconciliation);
  const [cutover, setCutover] = useState<CutoverReadinessReport | null>(initialCutover);
  const [refreshing, setRefreshing] = useState(false);
  const [drillType, setDrillType] = useState<OperationalDrillType>("database_restore");
  const [evidenceRef, setEvidenceRef] = useState("");
  const [summary, setSummary] = useState("");
  const [submittingDrill, setSubmittingDrill] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const isOwner = platformRole === "platform_owner";

  async function refreshAll() {
    setRefreshing(true);
    setFeedback(null);
    try {
      const [sloRes, reconRes, cutoverRes] = await Promise.all([
        fetch("/v1/admin/platform/commercial-provisioning/slo-alerts", { credentials: "include", cache: "no-store" }),
        fetch("/v1/admin/platform/commercial-provisioning/reconciliation-exceptions", { credentials: "include", cache: "no-store" }),
        fetch("/v1/admin/platform/commercial-provisioning/cutover-readiness", { credentials: "include", cache: "no-store" }),
      ]);
      if (sloRes.ok) setSlo(await sloRes.json() as ProvisioningSloSnapshot);
      if (reconRes.ok) setReconciliation(await reconRes.json() as CrossEntityReconciliationReport);
      if (cutoverRes.ok) setCutover(await cutoverRes.json() as CutoverReadinessReport);
      if (!sloRes.ok || !reconRes.ok || !cutoverRes.ok) {
        setFeedback({ kind: "error", text: "One or more operational telemetry endpoints returned a non-200 status." });
      }
    } catch {
      setFeedback({ kind: "error", text: "Failed to refresh Phase 7 SLO and reconciliation snapshots." });
    } finally {
      setRefreshing(false);
    }
  }

  async function recordDrill(event: FormEvent) {
    event.preventDefault();
    if (!isOwner) return;
    if (evidenceRef.trim().length < 2 || summary.trim().length < 4) {
      const msg = "Provide an evidence reference and summary for the verification drill.";
      setFeedback({ kind: "error", text: msg });
      pulse.warning(msg);
      return;
    }
    setSubmittingDrill(true);
    setFeedback(null);
    try {
      const payload = await pulse.track(
        async () => {
          const res = await fetch("/v1/admin/platform/commercial-provisioning/drills", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              drillType,
              evidenceRef: evidenceRef.trim(),
              summary: summary.trim(),
            }),
          });
          await assertOk(res);
          return (await res.json()) as CutoverReadinessReport & { message?: string };
        },
        {
          title: `Recording operational drill (${drillType})`,
          pendingDetail: "Validating drill evidence against cutover gates…",
          successTitle: "Operational drill recorded",
          group: "cutover:drill",
        },
      );
      setCutover(payload);
      setEvidenceRef("");
      setSummary("");
      setFeedback({ kind: "ok", text: `Recorded verified operational drill (${drillType}) and updated cutover gates.` });
    } catch (err) {
      setFeedback({ kind: "error", text: err instanceof Error ? err.message : "Failed to record verification drill." });
    } finally {
      setSubmittingDrill(false);
    }
  }

  if (initialErrorStatus === 503 && !slo && !reconciliation && !cutover) {
    return (
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">PHASE 7 TELEMETRY UNAVAILABLE</p>
            <h2>Commercial provisioning runtime not configured (503)</h2>
            <p className="muted">
              Set <code>COMMERCIAL_PROVISIONING_ENABLED=true</code> and <code>PRODUCT_PROVISIONER_DATABASE_URL</code> to enable SLOs, cross-entity reconciliation, and cutover readiness evaluation.
            </p>
          </div>
          <span className="status warn">UNCONFIGURED</span>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">SERVICE LEVEL OBJECTIVES &amp; ALERTS</p>
            <h2>Live Provisioning SLOs</h2>
            <p className="muted">Command acceptance latency/success, provision-ready timing, callback lag, DLQ age, and active lease safety.</p>
          </div>
          <div className="actions" style={{ gap: 10 }}>
            {slo && <span className={`status ${statusPillClass(slo.status)}`}>{slo.status.toUpperCase()}</span>}
            <button className="secondary" type="button" disabled={refreshing} onClick={() => void refreshAll()}>
              {refreshing ? "Refreshing..." : "Refresh All"}
            </button>
          </div>
        </div>

        {feedback && (
          <p className={`notice-inline ${feedback.kind === "error" ? "error-notice" : "success-notice"}`}>
            {feedback.text}
          </p>
        )}

        {slo && (
          <>
            <div className="metric-grid">
              <div className="metric">
                <span>Cmd Accept Success</span>
                <strong>{(slo.metrics.commandAcceptanceSuccessRate * 100).toFixed(2)}%</strong>
              </div>
              <div className="metric">
                <span>Cmd Accept p95</span>
                <strong>{slo.metrics.commandAcceptanceP95Ms} ms</strong>
              </div>
              <div className="metric">
                <span>Provision Ready p95</span>
                <strong>{slo.metrics.provisionReadyP95Seconds} s</strong>
              </div>
              <div className="metric">
                <span>Callback Max Lag</span>
                <strong>{formatAgeSeconds(Math.round(slo.metrics.callbackMaxLagSeconds))}</strong>
              </div>
              <div className="metric">
                <span>Dead-Letter Backlog</span>
                <strong>{slo.metrics.deadLetterCount}</strong>
              </div>
              <div className="metric">
                <span>Compensation Required</span>
                <strong>{slo.metrics.compensationRequiredCount}</strong>
              </div>
              <div className="metric">
                <span>Max Lease Age</span>
                <strong>{formatAgeSeconds(Math.round(slo.metrics.maxOperationLeaseAgeSeconds))}</strong>
              </div>
              <div className="metric">
                <span>Reconciliation Drift</span>
                <strong>{slo.metrics.reconciliationDriftCount}</strong>
              </div>
            </div>

            <div className="table-wrap" style={{ marginTop: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>ALERT</th>
                    <th>SEVERITY</th>
                    <th>OWNER</th>
                    <th>OBSERVED vs THRESHOLD</th>
                    <th>RUNBOOK SECTION</th>
                  </tr>
                </thead>
                <tbody>
                  {slo.alerts.map((alert) => (
                    <tr key={alert.id}>
                      <td>
                        <strong>{alert.id}</strong>
                        <small>{alert.message}</small>
                      </td>
                      <td><span className={`badge ${statusPillClass(alert.severity)}`}>{alert.severity}</span></td>
                      <td>{alert.owner}</td>
                      <td>{alert.observedValue} / {alert.thresholdValue}</td>
                      <td><code>{alert.runbookSection}</code></td>
                    </tr>
                  ))}
                  {slo.alerts.length === 0 && (
                    <tr><td className="empty" colSpan={5}>All SLO thresholds are green; zero active alerts.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">FIVE-WAY CROSS-ENTITY RECONCILIATION</p>
            <h2>Orders, Operations, Installations, Entitlements &amp; Hosting</h2>
            <p className="muted">PII-free exception report routing every mismatch to its operational owner with elapsed age.</p>
          </div>
          {reconciliation && (
            <span className={`status ${reconciliation.summary.unresolvedDriftCount === 0 ? "ok" : "bad"}`}>
              {reconciliation.summary.unresolvedDriftCount} EXCEPTIONS
            </span>
          )}
        </div>

        {reconciliation && (
          <>
            <div className="metric-grid">
              <div className="metric"><span>Paid Orders</span><strong>{reconciliation.summary.ordersChecked}</strong></div>
              <div className="metric"><span>Operations</span><strong>{reconciliation.summary.operationsChecked}</strong></div>
              <div className="metric"><span>Installations</span><strong>{reconciliation.summary.installationsChecked}</strong></div>
              <div className="metric"><span>Entitlements</span><strong>{reconciliation.summary.entitlementsChecked}</strong></div>
              <div className="metric"><span>Hosting Deployments</span><strong>{reconciliation.summary.deploymentsChecked}</strong></div>
            </div>

            <div className="table-wrap" style={{ marginTop: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>MISMATCH TYPE</th>
                    <th>SEVERITY</th>
                    <th>OWNER</th>
                    <th>AGE</th>
                    <th>ENTITY REFS</th>
                    <th>RECOMMENDED ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliation.exceptions.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.mismatchType}</strong>
                        <small>{item.summary}</small>
                      </td>
                      <td><span className={`badge ${statusPillClass(item.severity)}`}>{item.severity}</span></td>
                      <td>{item.owner}</td>
                      <td>{formatAgeSeconds(item.ageSeconds)}</td>
                      <td><code className="code-preview">{JSON.stringify(item.entityRefs)}</code></td>
                      <td>{item.recommendedAction}</td>
                    </tr>
                  ))}
                  {reconciliation.exceptions.length === 0 && (
                    <tr><td className="empty" colSpan={6}>Zero cross-entity reconciliation exceptions detected.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">PILOT COHORT &amp; CUTOVER GOVERNANCE</p>
            <h2>Canary, Rollback &amp; Legacy Removal Readiness</h2>
            <p className="muted">
              Tracks staging pilot isolation, DB &amp; 30-day archive restore drills, rollback window sign-off, and legacy decommission gates.
            </p>
          </div>
          {cutover && (
            <span className={`status ${cutover.readyToRemoveLegacyProvisioning ? "ok" : "warn"}`}>
              PILOT: {cutover.pilotPolicy.pilotMode.toUpperCase()}
            </span>
          )}
        </div>

        {cutover && (
          <>
            <div className="metric-grid">
              <div className="metric">
                <span>Prod Allowlist</span>
                <strong>{cutover.pilotPolicy.productionAllowlistClosed ? "CLOSED" : "OPEN"}</strong>
              </div>
              <div className="metric">
                <span>Hosting Mutations</span>
                <strong>{cutover.pilotPolicy.hostingMutationsEnabled ? "ENABLED" : "DISABLED"}</strong>
              </div>
              <div className="metric">
                <span>Staging Pilot Ready</span>
                <strong>{cutover.readyForStagingPilot ? "YES" : "NO"}</strong>
              </div>
              <div className="metric">
                <span>Canary Cohort Ready</span>
                <strong>{cutover.readyForCanary ? "YES" : "NO"}</strong>
              </div>
              <div className="metric">
                <span>Legacy Removal Ready</span>
                <strong>{cutover.readyToRemoveLegacyProvisioning ? "YES" : "BLOCKED"}</strong>
              </div>
            </div>

            <div className="table-wrap" style={{ marginTop: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>GATE</th>
                    <th>STATUS</th>
                    <th>OWNER</th>
                    <th>DETAIL</th>
                    <th>VERIFIED AT</th>
                  </tr>
                </thead>
                <tbody>
                  {cutover.gates.map((gate) => (
                    <tr key={gate.id}>
                      <td><strong>{gate.name}</strong><small>{gate.id}</small></td>
                      <td><span className={`badge ${gate.passed ? "ok" : "bad"}`}>{gate.passed ? "PASS" : "BLOCKED"}</span></td>
                      <td>{gate.owner}</td>
                      <td>{gate.detail}</td>
                      <td>{gate.lastVerifiedAt ? new Date(gate.lastVerifiedAt).toLocaleString("en-KE") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {isOwner && (
              <form className="filters" style={{ marginTop: 18 }} onSubmit={recordDrill}>
                <select value={drillType} onChange={(e) => setDrillType(e.target.value as OperationalDrillType)}>
                  <option value="staging_pilot_signoff">Staging Pilot Sign-off</option>
                  <option value="database_restore">Database Backup &amp; Restore Drill</option>
                  <option value="archive_restore">30-Day Archive Restore Drill</option>
                  <option value="canary_cohort_signoff">Paid Canary Cohort Sign-off</option>
                  <option value="rollback_window">Dual-Read Rollback Window Sign-off</option>
                </select>
                <input
                  placeholder="Evidence ID (e.g. drill-2026-11-12-01)"
                  value={evidenceRef}
                  onChange={(e) => setEvidenceRef(e.target.value)}
                />
                <input
                  placeholder="Verification summary (no PII)..."
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                />
                <button className="primary" type="submit" disabled={submittingDrill}>
                  {submittingDrill ? "Recording..." : "Record Verified Drill"}
                </button>
              </form>
            )}
          </>
        )}
      </section>
    </>
  );
}
