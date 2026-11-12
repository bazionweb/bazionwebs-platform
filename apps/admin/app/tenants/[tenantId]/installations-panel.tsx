"use client";

import { useState } from "react";

export interface TenantInstallationItem {
  id: string;
  productId: string;
  productVersion: string;
  solutionId: string;
  templateId: string;
  distributionMode: string;
  status: string;
  suspendedReason: string | null;
  currentConfigurationVersion: number;
  externalOrderId: string | null;
  createdAt: string;
  readyAt: string | null;
  offboardedAt: string | null;
  archive: {
    id: string;
    retentionExpiresAt: string;
    recoveredAt: string | null;
    archivePurgedAt: string | null;
  } | null;
}

function installationStatusClass(status: string): string {
  if (status === "ready") return "status-active";
  if (status === "suspended" || status === "offboarding") return "status-suspended";
  if (status === "failed" || status === "offboarded") return "status-closed";
  return "status-provisioning";
}

export function TenantInstallationsPanel(props: {
  tenantId: string;
  initialItems: TenantInstallationItem[];
  status: number;
  platformRole?: string | null;
}) {
  const [items, setItems] = useState<TenantInstallationItem[]>(props.initialItems);
  const [reason, setReason] = useState("");
  const [confirmDestructive, setConfirmDestructive] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const isOwner = props.platformRole === "platform_owner";

  async function reload() {
    const res = await fetch(`/v1/admin/platform/tenants/${encodeURIComponent(props.tenantId)}/installations`, {
      credentials: "include",
      cache: "no-store",
    });
    const body = await res.json().catch(() => null);
    if (res.ok && body?.items) {
      setItems(body.items);
    }
  }

  async function offboard(installationId: string) {
    if (reason.trim().length < 8) {
      setFeedback({ kind: "error", text: "Provide an offboarding reason of at least 8 characters." });
      return;
    }
    if (!confirmDestructive) {
      setFeedback({ kind: "error", text: "Confirm destructive offboarding archive export before proceeding." });
      return;
    }
    setBusy(`offboard:${installationId}`);
    setFeedback(null);
    try {
      const res = await fetch(
        `/v1/admin/platform/tenants/${encodeURIComponent(props.tenantId)}/installations/${encodeURIComponent(installationId)}/offboard`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason: reason.trim(), confirmDestructive: true }),
        },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setFeedback({ kind: "error", text: body?.message ?? `Offboard failed (HTTP ${res.status}).` });
        return;
      }
      setReason("");
      setConfirmDestructive(false);
      setFeedback({
        kind: "success",
        text: `Installation ${installationId} archived (30-day retention until ${new Date(body.archive.retentionExpiresAt).toLocaleDateString("en-KE")}).`,
      });
      await reload();
    } finally {
      setBusy(null);
    }
  }

  async function restore(installationId: string) {
    if (reason.trim().length < 8) {
      setFeedback({ kind: "error", text: "Provide a restore reason of at least 8 characters." });
      return;
    }
    setBusy(`restore:${installationId}`);
    setFeedback(null);
    try {
      const res = await fetch(
        `/v1/admin/platform/tenants/${encodeURIComponent(props.tenantId)}/installations/${encodeURIComponent(installationId)}/restore`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() }),
        },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setFeedback({ kind: "error", text: body?.message ?? `Restore failed (HTTP ${res.status}).` });
        return;
      }
      setReason("");
      setFeedback({ kind: "success", text: `Installation ${installationId} restored cleanly (${body.status}).` });
      await reload();
    } finally {
      setBusy(null);
    }
  }

  async function purgeExpired() {
    setBusy("purge");
    setFeedback(null);
    try {
      const res = await fetch(
        `/v1/admin/platform/tenants/${encodeURIComponent(props.tenantId)}/offboarding-archives/purge-expired`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setFeedback({ kind: "error", text: body?.message ?? `Purge failed (HTTP ${res.status}).` });
        return;
      }
      setFeedback({
        kind: "success",
        text: `Purge complete: scanned ${body.archivesScanned}, deleted ${body.archivesDeleted} expired archives and ${body.configurationsDeleted} configuration rows.`,
      });
      await reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">COMMERCIAL PRODUCT INSTALLATIONS</p>
          <h2>Product installations &amp; 30-day recovery archives</h2>
          <p className="muted">
            Version-pinned product installations, suspension state, and private 30-day offboarding archive lifecycle.
          </p>
        </div>
        <span className="count">{items.length} INSTALLATIONS</span>
      </div>

      {props.status !== 200 ? (
        <p className="muted">
          {props.status === 403
            ? "Your platform role cannot inspect commercial product installations."
            : `Could not load commercial product installations (HTTP ${props.status}).`}
        </p>
      ) : (
        <>
          <div className="actions" style={{ flexWrap: "wrap", gap: 10 }}>
            <input
              style={{ minWidth: 280, flex: 1 }}
              placeholder="Audited reason (minimum 8 chars) for offboard / restore..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={confirmDestructive}
                onChange={(e) => setConfirmDestructive(e.target.checked)}
                disabled={!isOwner}
              />
              <span>Confirm offboard archival (owner only)</span>
            </label>
            {isOwner && (
              <button className="secondary" type="button" disabled={busy !== null} onClick={() => void purgeExpired()}>
                {busy === "purge" ? "Purging..." : "Purge Expired Archives"}
              </button>
            )}
          </div>

          {feedback && (
            <p className={`notice-inline ${feedback.kind === "error" ? "error-notice" : "success-notice"}`}>
              {feedback.text}
            </p>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>PRODUCT / COMPOSITION</th>
                  <th>MODE / CONFIG</th>
                  <th>STATUS</th>
                  <th>RECOVERY ARCHIVE</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {items.map((inst) => (
                  <tr key={inst.id}>
                    <td>
                      <strong>{inst.productId} ({inst.productVersion})</strong>
                      <small>{inst.solutionId} · {inst.templateId}</small>
                      {inst.externalOrderId && <small className="mono-id">Order: {inst.externalOrderId}</small>}
                    </td>
                    <td>
                      <strong>{inst.distributionMode}</strong>
                      <small>Config v{inst.currentConfigurationVersion}</small>
                    </td>
                    <td>
                      <span className={`status ${installationStatusClass(inst.status)}`}>{inst.status}</span>
                      {inst.suspendedReason && <small>{inst.suspendedReason}</small>}
                    </td>
                    <td>
                      {inst.archive ? (
                        <>
                          <small className="mono-id">Archive {inst.archive.id}</small>
                          <small>
                            {inst.archive.archivePurgedAt
                              ? `Purged ${new Date(inst.archive.archivePurgedAt).toLocaleDateString("en-KE")}`
                              : `Retention until ${new Date(inst.archive.retentionExpiresAt).toLocaleDateString("en-KE")}`}
                          </small>
                        </>
                      ) : "—"}
                    </td>
                    <td>
                      <div className="actions" style={{ gap: 8 }}>
                        {inst.status === "offboarding" && !inst.archive?.archivePurgedAt && (
                          <button
                            className="primary"
                            type="button"
                            disabled={busy !== null}
                            onClick={() => void restore(inst.id)}
                          >
                            {busy === `restore:${inst.id}` ? "Restoring..." : "Restore"}
                          </button>
                        )}
                        {isOwner && ["ready", "suspended", "failed"].includes(inst.status) && (
                          <button
                            className="danger"
                            type="button"
                            disabled={!confirmDestructive || busy !== null}
                            onClick={() => void offboard(inst.id)}
                          >
                            {busy === `offboard:${inst.id}` ? "Archiving..." : "Offboard (30d Archive)"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td className="empty" colSpan={5}>No commercial product installations recorded for this tenant.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

