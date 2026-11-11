"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Deployment = {
  id: string;
  provider: string;
  template: string;
  templateVersion: string;
  resourceId: string | null;
  state: string;
  attemptCount: number;
  errorCode: string | null;
  lastDeployedAt: string | null;
  lastInspectedAt: string | null;
  reconcileFailureCount: number;
  createdAt: string | null;
  updatedAt: string | null;
};
type HostingEvent = {
  id: string;
  deploymentId: string;
  eventType: string;
  fromState: string | null;
  toState: string | null;
  actorType: string;
  actorId: string;
  occurredAt: string | null;
  metadata: Record<string, string | number | boolean | null>;
};
export type TenantHostingInventory = {
  providerConfigured: boolean;
  deployments: Deployment[];
  events: HostingEvent[];
};

const templates = [
  { id: "wordpress", name: "WordPress", description: "Managed WordPress site" },
  { id: "node-nextjs", name: "Next.js application", description: "Node.js / Next.js web application" },
  { id: "ecommerce", name: "E-commerce", description: "Multi-page commerce storefront" },
] as const;

function statusClass(state: string): string {
  if (state === "running") return "status-active";
  if (["provisioning", "ready", "deploying"].includes(state)) return "status-provisioning";
  return "status-suspended";
}

async function responseData(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({})) as Promise<Record<string, unknown>>;
}

export function TenantHostingPanel({
  tenantId,
  tenantStatus,
  initial,
  status,
}: {
  tenantId: string;
  tenantStatus: "provisioning" | "active" | "suspended" | "closed";
  initial: TenantHostingInventory | null;
  status: number;
}) {
  const router = useRouter();
  const [template, setTemplate] = useState<(typeof templates)[number]["id"]>("node-nextjs");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const baseUrl = `/v1/admin/platform/tenants/${encodeURIComponent(tenantId)}/hosting`;

  async function provision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!initial?.providerConfigured || tenantStatus !== "active" || busy) return;
    const selected = templates.find((item) => item.id === template);
    if (!window.confirm(`Create a ${selected?.name ?? template} hosting resource for this tenant? This contacts the configured hosting provider and may incur infrastructure costs.`)) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${baseUrl}/provision`, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `host-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({ template }),
      });
      const data = await responseData(response);
      if (!response.ok) throw new Error(String(data.message ?? data.error ?? `Request failed (${response.status})`));
      const deployment = data.deployment as { state?: string } | undefined;
      setMessage(deployment?.state === "running"
        ? "Hosting resource was created and its running state was confirmed."
        : "Hosting resource was created. Deployment is still being checked; review its status below.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Hosting provisioning could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel">
    <div className="panel-head">
      <div>
        <p className="eyebrow">CLIENT HOSTING</p>
        <h2>Hosting deployments</h2>
        <p className="muted">Provider resources, deployment state and immutable operational history for this tenant.</p>
      </div>
      <span className="count">{initial?.deployments.length ?? 0} RECENT</span>
    </div>

    {status !== 200 || !initial ? (
      <p className="muted">{status === 403 ? "Your platform role cannot view hosting inventory." : `Could not load hosting inventory (HTTP ${status}).`}</p>
    ) : <>
      {!initial.providerConfigured && <p className="notice-inline">Hosting provider is disabled in this API runtime. Existing deployment records remain visible, but provisioning is unavailable until Dokploy and the required tenant secrets are configured.</p>}
      {tenantStatus !== "active" && <p className="notice-inline">Provisioning is available only for active tenants. Current tenant status: {tenantStatus}.</p>}
      <form className="owner-search" onSubmit={provision}>
        <label>Provision a template
          <select value={template} onChange={(event) => setTemplate(event.target.value as (typeof templates)[number]["id"])}>
            {templates.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.description}</option>)}
          </select>
        </label>
        <button className="primary" disabled={!initial.providerConfigured || tenantStatus !== "active" || busy}>
          {busy ? "Submitting…" : "Provision hosting"}
        </button>
      </form>
      {message && <p className="feedback" role="status">{message}</p>}

      <div className="table-wrap">
        <table>
          <thead><tr><th>TEMPLATE / RESOURCE</th><th>PROVIDER</th><th>STATE</th><th>ATTEMPTS</th><th>LAST DEPLOYED</th><th>LAST CHECKED</th></tr></thead>
          <tbody>
            {initial.deployments.map((deployment) => <tr key={deployment.id}>
              <td>
                <strong>{deployment.template}</strong>
                <small>{deployment.resourceId ?? "Provider resource reference unavailable"}</small>
                <small>{deployment.id}</small>
              </td>
              <td>{deployment.provider}</td>
              <td>
                <span className={`status ${statusClass(deployment.state)}`}>{deployment.state}</span>
                {deployment.errorCode && <small>{deployment.errorCode}</small>}
              </td>
              <td>{deployment.attemptCount}</td>
              <td>{deployment.lastDeployedAt ? new Date(deployment.lastDeployedAt).toLocaleString("en-KE") : "—"}</td>
              <td>
                {deployment.lastInspectedAt ? new Date(deployment.lastInspectedAt).toLocaleString("en-KE") : "Not checked yet"}
                {deployment.reconcileFailureCount > 0 && <small>{deployment.reconcileFailureCount} consecutive inspection failures</small>}
              </td>
            </tr>)}
            {initial.deployments.length === 0 && <tr><td className="empty" colSpan={6}>No hosting deployments have been provisioned for this tenant.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="panel-head" style={{ marginTop: 24 }}>
        <div><p className="eyebrow">DEPLOYMENT EVENTS</p><h2>Hosting activity</h2><p className="muted">Most recent 50 events. Event records are append-only.</p></div>
        <span className="count">{initial.events.length} EVENTS</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>WHEN</th><th>EVENT</th><th>STATE CHANGE</th><th>ACTOR</th><th>DETAIL</th></tr></thead>
          <tbody>
            {initial.events.map((item) => (
              <tr key={item.id}>
                <td>{item.occurredAt ? new Date(item.occurredAt).toLocaleString("en-KE") : "—"}</td>
                <td><strong>{item.eventType}</strong><small>{item.deploymentId}</small></td>
                <td>{item.fromState ?? "—"} → {item.toState ?? "—"}</td>
                <td>{item.actorType}<small>{item.actorId}</small></td>
                <td>{Object.entries(item.metadata).map(([key, value]) => `${key}: ${String(value)}`).join(" · ") || "—"}</td>
              </tr>
            ))}
            {initial.events.length === 0 && <tr><td className="empty" colSpan={5}>No hosting events recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>}
  </section>;
}
