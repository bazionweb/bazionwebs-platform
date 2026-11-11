"use client";

import { useEffect, useState } from "react";
import type { Tenant } from "@/lib/platform";

interface AuditRow {
  id: string;
  tenant_id: string | null;
  tenant_name: string | null;
  actor_type: string;
  actor_id: string;
  actor_role: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  outcome: string;
  request_id: string | null;
  metadata: unknown;
  occurred_at: string;
}

export function AuditPanel({ tenants }: { tenants: Tenant[] }) {
  const [items, setItems] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [tenantFilter, setTenantFilter] = useState("");
  const [search, setSearch] = useState("");
  const [inspectItem, setInspectItem] = useState<AuditRow | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  async function loadAuditLogs(targetOffset = 0) {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (actionFilter) q.set("action", actionFilter);
      if (outcomeFilter !== "all") q.set("outcome", outcomeFilter);
      if (tenantFilter) q.set("tenantId", tenantFilter);
      if (search) q.set("search", search);
      q.set("limit", String(limit));
      q.set("offset", String(targetOffset));

      const res = await fetch(`/v1/admin/platform/audit?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setTotal(data.total || 0);
        setOffset(targetOffset);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAuditLogs(0);
  }, []);

  return (
    <div>
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">IMMUTABLE SECURITY & OPERATIONAL TRAIL</p>
            <h2>Platform Audit Events</h2>
            <p className="muted">
              Trace all administrative actions, lifecycle transitions, payment reconciliations, and troubleshooting overrides.
            </p>
          </div>
          <button className="secondary" onClick={() => loadAuditLogs(0)} style={{ fontSize: "11px", padding: "8px 14px" }}>
            ↻ Refresh Logs
          </button>
        </div>

        <div className="filters" style={{ flexWrap: "wrap" }}>
          <select value={tenantFilter} onChange={(e) => setTenantFilter(e.target.value)}>
            <option value="">All Workspaces</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <select value={outcomeFilter} onChange={(e) => setOutcomeFilter(e.target.value)}>
            <option value="all">All Outcomes</option>
            <option value="succeeded">Succeeded</option>
            <option value="failed">Failed</option>
          </select>

          <input
            type="search"
            placeholder="Search action, actor ID, or resource type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button className="primary" onClick={() => loadAuditLogs(0)}>Filter Logs</button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>TIMESTAMP</th>
                <th>OPERATOR / ACTOR</th>
                <th>ACTION</th>
                <th>RESOURCE</th>
                <th>WORKSPACE</th>
                <th>OUTCOME</th>
                <th>METADATA</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="empty">Loading platform audit events...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="empty">No audit events found matching filters.</td></tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <small style={{ fontWeight: 600 }}>{new Date(row.occurred_at).toLocaleDateString()}</small>
                      <small className="muted">{new Date(row.occurred_at).toLocaleTimeString()}</small>
                    </td>
                    <td>
                      <strong>{row.actor_id}</strong>
                      <small className="muted">{row.actor_role || row.actor_type}</small>
                    </td>
                    <td>
                      <code style={{ fontSize: "11px", color: "var(--ink)", fontWeight: 600 }}>{row.action}</code>
                    </td>
                    <td>
                      <span>{row.resource_type}</span>
                      {row.resource_id && <small className="mono-id">{row.resource_id.slice(0, 14)}...</small>}
                    </td>
                    <td>
                      {row.tenant_name ? (
                        <strong>{row.tenant_name}</strong>
                      ) : (
                        <span className="muted">Global Platform</span>
                      )}
                    </td>
                    <td>
                      <span className={`status ${row.outcome === "succeeded" ? "status-active" : "status-closed"}`}>
                        {row.outcome}
                      </span>
                    </td>
                    <td>
                      <button
                        className="secondary-btn-sm"
                        onClick={() => setInspectItem(row)}
                        title="View event payload metadata"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <span>Showing {items.length} of {total} events</span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="secondary"
              disabled={offset <= 0 || loading}
              onClick={() => loadAuditLogs(Math.max(offset - limit, 0))}
              style={{ fontSize: "11px", padding: "6px 12px" }}
            >
              ← Previous
            </button>
            <button
              className="secondary"
              disabled={offset + limit >= total || loading}
              onClick={() => loadAuditLogs(offset + limit)}
              style={{ fontSize: "11px", padding: "6px 12px" }}
            >
              Next →
            </button>
          </div>
        </div>
      </section>

      {/* Modal: Inspect Audit Event */}
      {inspectItem && (
        <div className="modal-backdrop" onClick={() => setInspectItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">AUDIT RECORD INSPECTOR</p>
                <h2>Event: {inspectItem.action}</h2>
              </div>
              <button className="modal-close" onClick={() => setInspectItem(null)}>✕</button>
            </div>
            <div style={{ marginTop: "16px", display: "grid", gap: "10px", fontSize: "12px" }}>
              <div><strong>Event ID:</strong> <span className="mono-id">{inspectItem.id}</span></div>
              <div><strong>Occurred At:</strong> {new Date(inspectItem.occurred_at).toLocaleString()}</div>
              <div><strong>Actor:</strong> {inspectItem.actor_id} ({inspectItem.actor_role || inspectItem.actor_type})</div>
              <div><strong>Request ID:</strong> <span className="mono-id">{inspectItem.request_id || "—"}</span></div>
              <div><strong>Resource:</strong> {inspectItem.resource_type} {inspectItem.resource_id ? `(${inspectItem.resource_id})` : ""}</div>
              <div>
                <strong>Metadata Payload:</strong>
                <pre className="code-preview" style={{ marginTop: "6px", maxHeight: "300px" }}>
                  {JSON.stringify(inspectItem.metadata, null, 2)}
                </pre>
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: "18px" }}>
              <button className="primary" onClick={() => setInspectItem(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
