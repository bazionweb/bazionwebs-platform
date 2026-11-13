"use client";

import { useEffect, useState } from "react";
import { assertOk, pulse } from "@bazion/ui";

interface IdentityCollisionRow {
  id: string;
  collisionType: string;
  issuer: string | null;
  subject: string | null;
  existingUserId: string | null;
  conflictingUserId: string | null;
  externalReference: string | null;
  status: string;
  resolutionNote: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function IdentityCollisionsPanel() {
  const [items, setItems] = useState<IdentityCollisionRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved_linked" | "resolved_rejected" | "all">("open");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [targetsById, setTargetsById] = useState<Record<string, string>>({});

  async function loadCollisions(nextStatus = statusFilter) {
    setLoading(true);
    setError("");
    try {
      const q = nextStatus === "all" ? "" : `?status=${encodeURIComponent(nextStatus)}`;
      const res = await fetch(`/v1/admin/platform/identity/collisions${q}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(
          res.status === 403
            ? "Your platform role does not allow inspecting identity collisions."
            : body.message ?? `Could not load identity collisions (HTTP ${res.status}).`,
        );
      }
      const body = await res.json() as { items?: IdentityCollisionRow[] };
      setItems(body.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load identity collisions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCollisions(statusFilter);
  }, [statusFilter]);

  async function resolveCollision(item: IdentityCollisionRow, action: "resolve_link" | "reject") {
    const note = (notesById[item.id] ?? "").trim();
    const targetUserId = (targetsById[item.id] ?? item.existingUserId ?? "").trim();
    if (note.length < 3) {
      const msg = "Enter a short audit resolution note (at least 3 characters) before resolving.";
      setError(msg);
      pulse.warning(msg);
      return;
    }
    if (action === "resolve_link" && !targetUserId) {
      const msg = "Enter a verified target user ID before linking a federated subject.";
      setError(msg);
      pulse.warning(msg);
      return;
    }

    setBusyId(item.id);
    setError("");
    setNotice("");
    try {
      await pulse.track(
        async () => {
          const res = await fetch(`/v1/admin/platform/identity/collisions/${encodeURIComponent(item.id)}/resolve`, {
            method: "POST",
            credentials: "include",
            cache: "no-store",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              action,
              ...(action === "resolve_link" ? { targetUserId } : {}),
              note,
            }),
          });
          await assertOk(res);
        },
        {
          title: action === "resolve_link" ? "Linking identity subject" : "Rejecting identity collision",
          pendingDetail: `Collision ${item.id}…`,
          successTitle: action === "resolve_link" ? "Identity subject linked" : "Collision rejected",
          group: `id:collision:${item.id}`,
        },
      );
      setNotice(`Collision ${item.id} marked as ${action === "resolve_link" ? "resolved_linked" : "resolved_rejected"}.`);
      await loadCollisions(statusFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resolve identity collision.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="panel" style={{ marginTop: 20 }}>
      <div className="panel-head">
        <div>
          <p className="eyebrow">IDENTITY GOVERNANCE</p>
          <h2>Federated Identity &amp; Account Collisions</h2>
          <p className="muted">
            Explicitly triage blocked email-based auto-merges, email-change conflicts, and disputed order claims. Silent account merging is permanently disabled.
          </p>
        </div>
        <span className="count">{items.length} COLLISIONS</span>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          >
            <option value="open">Open</option>
            <option value="resolved_linked">Resolved (Linked)</option>
            <option value="resolved_rejected">Resolved (Rejected)</option>
            <option value="all">All</option>
          </select>
        </label>
        <button className="secondary" type="button" onClick={() => void loadCollisions(statusFilter)} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {notice && <p className="feedback" role="status">{notice}</p>}
      {error && <p className="notice-inline error-notice" role="alert">{error}</p>}

      {items.length === 0 && !loading ? (
        <p className="muted">No {statusFilter === "all" ? "" : `${statusFilter} `}identity collisions recorded.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>TYPE / STATUS</th>
                <th>FEDERATED / REF</th>
                <th>ACCOUNTS</th>
                <th>RESOLUTION</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const canLink = item.status === "open" && Boolean(item.issuer && item.subject);
                const noteValue = notesById[item.id] ?? "";
                const targetValue = targetsById[item.id] ?? item.existingUserId ?? "";
                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.collisionType}</strong>
                      <small className="mono-id">{item.id}</small>
                      <div style={{ marginTop: 4 }}>
                        <span className={`status status-${item.status === "open" ? "provisioning" : "active"}`}>
                          {item.status}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
                        {item.issuer && <span><strong>Issuer:</strong> <code>{item.issuer}</code></span>}
                        {item.subject && <span><strong>Subject:</strong> <code>{item.subject}</code></span>}
                        {item.externalReference && <span><strong>Ref:</strong> <code>{item.externalReference}</code></span>}
                        <span className="muted">{new Date(item.createdAt).toLocaleString("en-KE")}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
                        <span><strong>Existing:</strong> <code>{item.existingUserId ?? "—"}</code></span>
                        <span><strong>Conflicting:</strong> <code>{item.conflictingUserId ?? "—"}</code></span>
                      </div>
                    </td>
                    <td>
                      {item.status === "open" ? (
                        <div style={{ display: "grid", gap: 6, minWidth: 240 }}>
                          {canLink && (
                            <input
                              type="text"
                              placeholder="Verified target userId"
                              value={targetValue}
                              onChange={(event) => setTargetsById((prev) => ({ ...prev, [item.id]: event.target.value }))}
                              disabled={busyId === item.id}
                            />
                          )}
                          <input
                            type="text"
                            placeholder="Support audit note (required)"
                            value={noteValue}
                            onChange={(event) => setNotesById((prev) => ({ ...prev, [item.id]: event.target.value }))}
                            disabled={busyId === item.id}
                          />
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {canLink && (
                              <button
                                type="button"
                                className="primary"
                                disabled={busyId === item.id}
                                onClick={() => void resolveCollision(item, "resolve_link")}
                              >
                                {busyId === item.id ? "Saving…" : "Link subject"}
                              </button>
                            )}
                            <button
                              type="button"
                              className="secondary"
                              disabled={busyId === item.id}
                              onClick={() => void resolveCollision(item, "reject")}
                            >
                              {busyId === item.id ? "Saving…" : "Reject collision"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
                          <span>{item.resolutionNote ?? "—"}</span>
                          <small className="muted">
                            {item.resolvedBy ? `By ${item.resolvedBy}` : ""}
                            {item.resolvedAt ? ` · ${new Date(item.resolvedAt).toLocaleString("en-KE")}` : ""}
                          </small>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

