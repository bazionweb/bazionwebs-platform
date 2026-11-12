"use client";

import { useState } from "react";

export interface OperationSummaryItem {
  operation: {
    operationId: string;
    correlationId: string;
    externalOrderId: string;
    status: string;
    currentStep: string | null;
    tenantId: string | null;
    installationId: string | null;
    failure: { code: string; retryable: boolean } | null;
    updatedAt: string;
  };
  offerId: string;
  offerVersion: string;
  failureDisposition: string | null;
  holderWorkerId: string | null;
  fencingToken: number;
  leaseExpiresAt: string | null;
  attemptCount: number;
  retryAfterAt: string | null;
  acceptedAt: string;
  finishedAt: string | null;
}

export interface OperationDetail {
  operation: {
    operationId: string;
    correlationId: string;
    externalOrderId: string;
    status: string;
    currentStep: string | null;
    tenantId: string | null;
    installationId: string | null;
    failure: { code: string; retryable: boolean } | null;
    updatedAt: string;
  };
  source: string;
  externalCustomerId: string;
  offerId: string;
  offerVersion: string;
  requestedDomain: string | null;
  lease: {
    holderWorkerId: string | null;
    fencingToken: number;
    leaseExpiresAt: string | null;
    attemptCount: number;
    retryAfterAt: string | null;
  };
  failureDisposition: string | null;
  manualReviewNote: string | null;
  lastOperatorActorId: string | null;
  acceptedAt: string;
  finishedAt: string | null;
  stepAttempts: Array<{
    id: string;
    stepName: string;
    direction: "forward" | "compensate";
    attemptNumber: number;
    status: "running" | "succeeded" | "failed" | "unknown";
    fencingToken: number;
    correlationId: string | null;
    effectRefs: Record<string, string>;
    errorCode: string | null;
    retryable: boolean | null;
    failureDisposition: string | null;
    startedAt: string;
    finishedAt: string | null;
  }>;
  events: Array<{
    id: string;
    eventType: string;
    status: string;
    currentStep: string | null;
    failureCode: string | null;
    occurredAt: string;
  }>;
}

const OPERATION_STATUSES = [
  "all",
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
] as const;

function opStatusClass(status: string): string {
  if (status === "ready") return "status-active";
  if (status === "failed" || status === "compensation_required" || status === "compensated") return "status-closed";
  if (status === "compensating") return "status-suspended";
  return "status-provisioning";
}

function stepBadgeClass(status: string): string {
  if (status === "succeeded") return "badge-sent";
  if (status === "failed" || status === "unknown") return "badge-dead";
  if (status === "running") return "badge-processing";
  return "badge-pending";
}

export function ProvisioningOperationsPanel(props: {
  initialItems: OperationSummaryItem[];
  initialStatus: number;
  platformRole?: string | null;
}) {
  const [items, setItems] = useState<OperationSummaryItem[]>(props.initialItems);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [tenantFilter, setTenantFilter] = useState("");
  const [loadingList, setLoadingList] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(props.initialItems[0]?.operation.operationId ?? null);
  const [detail, setDetail] = useState<OperationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [actionReason, setActionReason] = useState("");
  const [confirmDestructive, setConfirmDestructive] = useState(false);
  const [reviewResolution, setReviewResolution] = useState<"resume_forward" | "mark_failed" | "trigger_compensate">("resume_forward");
  const [reviewNote, setReviewNote] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const isOwner = props.platformRole === "platform_owner";

  async function refreshList(nextStatus = statusFilter, nextOrder = orderSearch, nextTenant = tenantFilter) {
    setLoadingList(true);
    setFeedback(null);
    try {
      const q = new URLSearchParams({ limit: "50" });
      if (nextStatus !== "all") q.set("status", nextStatus);
      if (nextOrder.trim()) q.set("externalOrderId", nextOrder.trim());
      if (nextTenant.trim()) q.set("tenantId", nextTenant.trim());
      const res = await fetch(`/v1/admin/platform/commercial-provisioning/operations?${q.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setFeedback({ kind: "error", text: body?.message ?? `Failed to load operations (HTTP ${res.status}).` });
        return;
      }
      setItems(body?.items ?? []);
    } finally {
      setLoadingList(false);
    }
  }

  async function loadDetail(operationId: string) {
    setSelectedId(operationId);
    setLoadingDetail(true);
    setFeedback(null);
    try {
      const res = await fetch(`/v1/admin/platform/commercial-provisioning/operations/${encodeURIComponent(operationId)}`, {
        credentials: "include",
        cache: "no-store",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setFeedback({ kind: "error", text: body?.message ?? `Failed to load operation ${operationId}.` });
        return;
      }
      setDetail(body);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function runOperatorAction(action: "retry" | "resume" | "reconcile" | "compensate") {
    if (!detail) return;
    if (actionReason.trim().length < 8) {
      setFeedback({ kind: "error", text: "Provide an operator reason of at least 8 characters." });
      return;
    }
    if (action === "compensate" && !confirmDestructive) {
      setFeedback({ kind: "error", text: "Confirm destructive rollback before executing compensation." });
      return;
    }
    setBusyAction(action);
    setFeedback(null);
    try {
      const res = await fetch(
        `/v1/admin/platform/commercial-provisioning/operations/${encodeURIComponent(detail.operation.operationId)}/${action}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            reason: actionReason.trim(),
            ...(action === "compensate" ? { confirmDestructive: true } : {}),
          }),
        },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setFeedback({ kind: "error", text: body?.message ?? `${action} failed (HTTP ${res.status}).` });
        return;
      }
      setDetail(body);
      setActionReason("");
      setConfirmDestructive(false);
      setFeedback({ kind: "success", text: `Operator action '${action}' executed (${body.operation?.status ?? "updated"}).` });
      await refreshList();
    } finally {
      setBusyAction(null);
    }
  }

  async function submitManualReview(event: React.FormEvent) {
    event.preventDefault();
    if (!detail) return;
    if (actionReason.trim().length < 8 || reviewNote.trim().length < 4) {
      setFeedback({ kind: "error", text: "Manual review requires a reason (8+ chars) and note (4+ chars)." });
      return;
    }
    if (reviewResolution === "trigger_compensate" && !confirmDestructive) {
      setFeedback({ kind: "error", text: "Confirm destructive compensation before triggering manual rollback." });
      return;
    }
    setBusyAction("manual-review");
    setFeedback(null);
    try {
      const res = await fetch(
        `/v1/admin/platform/commercial-provisioning/operations/${encodeURIComponent(detail.operation.operationId)}/complete-manual-review`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            resolution: reviewResolution,
            note: reviewNote.trim(),
            reason: actionReason.trim(),
            ...(reviewResolution === "trigger_compensate" ? { confirmDestructive: true } : {}),
          }),
        },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setFeedback({ kind: "error", text: body?.message ?? `Manual review failed (HTTP ${res.status}).` });
        return;
      }
      setDetail(body);
      setActionReason("");
      setReviewNote("");
      setConfirmDestructive(false);
      setFeedback({ kind: "success", text: `Manual review completed with resolution '${reviewResolution}'.` });
      await refreshList();
    } finally {
      setBusyAction(null);
    }
  }

  const counts = {
    total: items.length,
    ready: items.filter((item) => item.operation.status === "ready").length,
    attention: items.filter((item) => ["failed", "compensation_required", "compensating"].includes(item.operation.status)).length,
    inFlight: items.filter((item) => ["accepted", "validating", "provisioning_tenant", "configuring_installation", "provisioning_hosting"].includes(item.operation.status)).length,
  };

  if (props.initialStatus === 401 || props.initialStatus === 403) {
    return (
      <section className="panel">
        <p className="error">Platform operator authentication is required to inspect provisioning sagas (HTTP {props.initialStatus}).</p>
      </section>
    );
  }

  return (
    <>
      <section className="metric-grid">
        <div className="metric"><span>Listed sagas</span><strong>{counts.total}</strong></div>
        <div className="metric"><span>Ready installations</span><strong>{counts.ready}</strong></div>
        <div className="metric"><span>Needs operator review</span><strong>{counts.attention}</strong></div>
        <div className="metric"><span>In-flight leased</span><strong>{counts.inFlight}</strong></div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">DURABLE SAGA QUEUE</p>
            <h2>Commercial provisioning operations</h2>
            <p className="muted">Fenced multi-step provisioning executions received from Bazionweb.</p>
          </div>
          <span className="live-tag">{loadingList ? "REFRESHING..." : `${items.length} OPERATIONS`}</span>
        </div>

        <form
          className="filters"
          onSubmit={(e) => {
            e.preventDefault();
            void refreshList();
          }}
        >
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); void refreshList(e.target.value, orderSearch, tenantFilter); }}>
            {OPERATION_STATUSES.map((status) => (
              <option key={status} value={status}>{status === "all" ? "All statuses" : status}</option>
            ))}
          </select>
          <input
            placeholder="Filter external order ID..."
            value={orderSearch}
            onChange={(e) => setOrderSearch(e.target.value)}
          />
          <input
            placeholder="Filter tenant UUID..."
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.target.value)}
          />
          <button className="primary" type="submit" disabled={loadingList}>Apply filters</button>
        </form>

        {feedback && (
          <p className={`notice-inline ${feedback.kind === "error" ? "error-notice" : "success-notice"}`}>
            {feedback.text}
          </p>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ORDER / OPERATION</th>
                <th>OFFER</th>
                <th>STATUS / STEP</th>
                <th>FAILURE</th>
                <th>LEASE / FENCE</th>
                <th>UPDATED</th>
                <th>INSPECT</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.operation.operationId}>
                  <td>
                    <strong>{item.operation.externalOrderId}</strong>
                    <small className="mono-id">{item.operation.operationId}</small>
                    {item.operation.tenantId && <small className="mono-id">Tenant: {item.operation.tenantId}</small>}
                  </td>
                  <td>
                    <strong>{item.offerId}</strong>
                    <small>v{item.offerVersion}</small>
                  </td>
                  <td>
                    <span className={`status ${opStatusClass(item.operation.status)}`}>{item.operation.status}</span>
                    {item.operation.currentStep && <small>Step: {item.operation.currentStep}</small>}
                  </td>
                  <td>
                    {item.operation.failure ? (
                      <>
                        <strong>{item.operation.failure.code}</strong>
                        <small>{item.failureDisposition ?? (item.operation.failure.retryable ? "retryable" : "terminal")}</small>
                      </>
                    ) : "—"}
                  </td>
                  <td>
                    <span>Fence #{item.fencingToken} · Att #{item.attemptCount}</span>
                    <small>{item.holderWorkerId ? `Worker: ${item.holderWorkerId}` : "Unleased"}</small>
                  </td>
                  <td>{new Date(item.operation.updatedAt).toLocaleString("en-KE")}</td>
                  <td>
                    <button
                      className={selectedId === item.operation.operationId ? "primary" : "secondary"}
                      type="button"
                      onClick={() => void loadDetail(item.operation.operationId)}
                    >
                      {loadingDetail && selectedId === item.operation.operationId ? "Loading..." : "Inspect"}
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td className="empty" colSpan={7}>No commercial provisioning operations matched these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {detail && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">OPERATION DETAIL &amp; SAGA TIMELINE</p>
              <h2>{detail.operation.externalOrderId}</h2>
              <p className="muted">
                Operation <span className="mono-id">{detail.operation.operationId}</span> · Customer {detail.externalCustomerId}
                {detail.requestedDomain ? ` · Domain ${detail.requestedDomain}` : ""}
              </p>
            </div>
            <span className={`status ${opStatusClass(detail.operation.status)}`}>{detail.operation.status}</span>
          </div>

          <div className="metric-grid">
            <div className="metric"><span>Fencing token</span><strong>#{detail.lease.fencingToken}</strong></div>
            <div className="metric"><span>Attempts</span><strong>{detail.lease.attemptCount}</strong></div>
            <div className="metric"><span>Holder worker</span><strong>{detail.lease.holderWorkerId ?? "None"}</strong></div>
            <div className="metric"><span>Failure disposition</span><strong>{detail.failureDisposition ?? "None"}</strong></div>
          </div>

          {detail.manualReviewNote && (
            <p className="notice-inline">
              <strong>Last manual review ({detail.lastOperatorActorId ?? "operator"}):</strong> {detail.manualReviewNote}
            </p>
          )}

          <div className="panel-head" style={{ marginTop: 18 }}>
            <div>
              <p className="eyebrow">STEP ATTEMPTS JOURNAL</p>
              <h3>Ordered forward &amp; compensation steps</h3>
            </div>
            <span className="count">{detail.stepAttempts.length} ATTEMPTS</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>STEP</th>
                  <th>PHASE</th>
                  <th>STATE</th>
                  <th>FENCE</th>
                  <th>ERROR / DISPOSITION</th>
                  <th>SAFE EFFECT REFS</th>
                </tr>
              </thead>
              <tbody>
                {detail.stepAttempts.map((attempt) => (
                  <tr key={attempt.id}>
                    <td>{attempt.attemptNumber}</td>
                    <td><strong>{attempt.stepName}</strong></td>
                    <td>{attempt.direction}</td>
                    <td><span className={`badge ${stepBadgeClass(attempt.status)}`}>{attempt.status}</span></td>
                    <td>#{attempt.fencingToken}</td>
                    <td>
                      {attempt.errorCode ? (
                        <>
                          <strong>{attempt.errorCode}</strong>
                          <small>{attempt.failureDisposition ?? "—"}</small>
                        </>
                      ) : "—"}
                    </td>
                    <td>
                      {Object.keys(attempt.effectRefs).length > 0 ? (
                        <code className="code-preview">{JSON.stringify(attempt.effectRefs)}</code>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
                {detail.stepAttempts.length === 0 && (
                  <tr><td className="empty" colSpan={7}>No step attempts recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="panel-head" style={{ marginTop: 24 }}>
            <div>
              <p className="eyebrow">AUDITED OPERATOR RECOVERY</p>
              <h3>Saga controls &amp; manual review</h3>
              <p className="muted">All controls require an audited reason. Destructive compensation requires platform_owner role and confirmation.</p>
            </div>
          </div>

          <div className="actions" style={{ flexWrap: "wrap", gap: 12 }}>
            <input
              style={{ minWidth: 320, flex: 1 }}
              placeholder="Audited operator reason (minimum 8 characters)..."
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={confirmDestructive}
                onChange={(e) => setConfirmDestructive(e.target.checked)}
                disabled={!isOwner}
              />
              <span>Confirm destructive compensation (owner only)</span>
            </label>
          </div>

          <div className="actions" style={{ marginTop: 12, flexWrap: "wrap", gap: 10 }}>
            <button className="secondary" type="button" disabled={busyAction !== null} onClick={() => void runOperatorAction("retry")}>
              {busyAction === "retry" ? "Retrying..." : "Retry"}
            </button>
            <button className="primary" type="button" disabled={busyAction !== null} onClick={() => void runOperatorAction("resume")}>
              {busyAction === "resume" ? "Resuming..." : "Resume"}
            </button>
            <button className="secondary" type="button" disabled={busyAction !== null} onClick={() => void runOperatorAction("reconcile")}>
              {busyAction === "reconcile" ? "Reconciling..." : "Reconcile"}
            </button>
            <button
              className="danger"
              type="button"
              disabled={!isOwner || !confirmDestructive || busyAction !== null}
              onClick={() => void runOperatorAction("compensate")}
            >
              {busyAction === "compensate" ? "Compensating..." : "Compensate (Rollback)"}
            </button>
          </div>

          <form className="filters" style={{ marginTop: 16 }} onSubmit={submitManualReview}>
            <select value={reviewResolution} onChange={(e) => setReviewResolution(e.target.value as any)}>
              <option value="resume_forward">Manual review: Resume forward</option>
              <option value="mark_failed">Manual review: Mark failed</option>
              <option value="trigger_compensate" disabled={!isOwner}>Manual review: Trigger compensate (owner)</option>
            </select>
            <input
              placeholder="Verification note (minimum 4 chars)..."
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
            />
            <button className="secondary" type="submit" disabled={busyAction !== null}>
              {busyAction === "manual-review" ? "Submitting..." : "Complete Manual Review"}
            </button>
          </form>

          <div className="panel-head" style={{ marginTop: 24 }}>
            <div>
              <p className="eyebrow">STATE MACHINE HISTORY</p>
              <h3>Operation events</h3>
            </div>
            <span className="count">{detail.events.length} EVENTS</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>EVENT</th><th>STATUS</th><th>STEP</th><th>ERROR</th><th>OCCURRED</th></tr>
              </thead>
              <tbody>
                {detail.events.map((ev) => (
                  <tr key={ev.id}>
                    <td>{ev.eventType}</td>
                    <td>{ev.status}</td>
                    <td>{ev.currentStep ?? "—"}</td>
                    <td>{ev.failureCode ?? "—"}</td>
                    <td>{new Date(ev.occurredAt).toLocaleString("en-KE")}</td>
                  </tr>
                ))}
                {detail.events.length === 0 && (
                  <tr><td className="empty" colSpan={5}>No events recorded.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

