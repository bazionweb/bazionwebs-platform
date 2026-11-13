"use client";

import { useState } from "react";
import { assertOk, pulse } from "@bazion/ui";

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
      const msg = "Provide an offboarding reason of at least 8 characters.";
      setFeedback({ kind: "error", text: msg });
      pulse.warning(msg);
      return;
    }
    if (!confirmDestructive) {
      const msg = "Confirm destructive offboarding archive export before proceeding.";
      setFeedback({ kind: "error", text: msg });
      pulse.warning(msg);
      return;
    }
    const ok = await pulse.confirm({
      title: `Offboard installation ${installationId}?`,
      message: "Exports a 30-day recovery archive and suspends the active installation.",
      tone: "danger",
      confirmLabel: "Offboard & archive",
    });
    if (!ok) return;
    setBusy(`offboard:${installationId}`);
    setFeedback(null);
    try {
      const body = await pulse.track(
        async () => {
          const res = await fetch(
            `/v1/admin/platform/tenants/${encodeURIComponent(props.tenantId)}/installations/${encodeURIComponent(installationId)}/offboard`,
            {
              method: "POST",
              credentials: "include",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ reason: reason.trim(), confirmDestructive: true }),
            },
          );
          await assertOk(res);
          return (await res.json()) as { archive: { retentionExpiresAt: string } };
        },
        {
          title: "Offboarding installation",
          pendingDetail: "Creating 30-day recovery archive…",
          successTitle: "Installation archived",
          successDetail: (b) =>
            `30-day retention until ${new Date(b.archive.retentionExpiresAt).toLocaleDateString("en-KE")}`,
          group: `install:offboard:${installationId}`,
        },
      );
      setReason("");
      setConfirmDestructive(false);
      setFeedback({
        kind: "success",
        text: `Installation ${installationId} archived (30-day retention until ${new Date(body.archive.retentionExpiresAt).toLocaleDateString("en-KE")}).`,
      });
      await reload();
    } catch (err) {
      setFeedback({ kind: "error", text: err instanceof Error ? err.message : "Offboard failed." });
    } finally {
      setBusy(null);
    }
  }

  async function restore(installationId: string) {
    if (reason.trim().length < 8) {
      const msg = "Provide a restore reason of at least 8 characters.";
      setFeedback({ kind: "error", text: msg });
      pulse.warning(msg);
      return;
    }
    setBusy(`restore:${installationId}`);
    setFeedback(null);
    try {
      const body = await pulse.track(
        async () => {
          const res = await fetch(
            `/v1/admin/platform/tenants/${encodeURIComponent(props.tenantId)}/installations/${encodeURIComponent(installationId)}/restore`,
            {
              method: "POST",
              credentials: "include",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ reason: reason.trim() }),
            },
          );
          await assertOk(res);
          return (await res.json()) as { status: string };
        },
        {
          title: "Restoring installation",
          pendingDetail: "Recovering configuration from archive…",
          successTitle: "Installation restored",
          successDetail: (b) => `Status: ${b.status}`,
          group: `install:restore:${installationId}`,
        },
      );
      setReason("");
      setFeedback({ kind: "success", text: `Installation ${installationId} restored cleanly (${body.status}).` });
      await reload();
    } catch (err) {
      setFeedback({ kind: "error", text: err instanceof Error ? err.message : "Restore failed." });
    } finally {
      setBusy(null);
    }
  }

  async function purgeExpired() {
    const ok = await pulse.confirm({
      title: "Purge expired offboarding archives?",
      message: "Permanently deletes archives past their 30-day retention window.",
      tone: "danger",
      confirmLabel: "Purge expired",
    });
    if (!ok) return;
    setBusy("purge");
    setFeedback(null);
    try {
      const body = await pulse.track(
        async () => {
          const res = await fetch(
            `/v1/admin/platform/tenants/${encodeURIComponent(props.tenantId)}/offboarding-archives/purge-expired`,
            {
              method: "POST",
              credentials: "include",
            },
          );
          await assertOk(res);
          return (await res.json()) as {
            archivesScanned: number;
            archivesDeleted: number;
            configurationsDeleted: number;
          };
        },
        {
          title: "Purging expired archives",
          pendingDetail: "Scanning retention windows…",
          successTitle: "Archive purge complete",
          successDetail: (b) =>
            `Deleted ${b.archivesDeleted} expired archives (${b.configurationsDeleted} config rows)`,
          group: `install:purge:${props.tenantId}`,
        },
      );
      setFeedback({
        kind: "success",
        text: `Purge complete: scanned ${body.archivesScanned}, deleted ${body.archivesDeleted} expired archives and ${body.configurationsDeleted} configuration rows.`,
      });
      await reload();
    } catch (err) {
      setFeedback({ kind: "error", text: err instanceof Error ? err.message : "Purge failed." });
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

