"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { assertOk, pulse } from "@bazion/ui";
import styles from "./hosting-panel.module.css";

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
  nextReconcileAt: string | null;
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

export type HostingInstallationEligibility = "eligible" | "missing" | "unavailable";

const templates = [
  { id: "wordpress", name: "WordPress", description: "Managed WordPress site" },
  { id: "node-nextjs", name: "Next.js application", description: "Node.js / Next.js web application" },
  { id: "ecommerce", name: "E-commerce", description: "Multi-page commerce storefront" },
] as const;

function stateTone(state: string): string {
  if (state === "running") return styles.stateRunning;
  if (state === "removed" || state === "stopped") return styles.stateInactive;
  if (["provisioning", "ready", "deploying"].includes(state)) return styles.statePending;
  return styles.stateAttention;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
  }).format(date);
}

async function responseData(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({})) as Promise<Record<string, unknown>>;
}

export function TenantHostingPanel({
  tenantId,
  tenantStatus,
  initial,
  status,
  installationEligibility,
}: {
  tenantId: string;
  tenantStatus: "provisioning" | "active" | "suspended" | "closed";
  initial: TenantHostingInventory | null;
  status: number;
  installationEligibility: HostingInstallationEligibility;
}) {
  const router = useRouter();
  const [template, setTemplate] = useState<(typeof templates)[number]["id"]>("node-nextjs");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isRefreshing, startRefresh] = useTransition();
  const baseUrl = `/v1/admin/platform/tenants/${encodeURIComponent(tenantId)}/hosting`;
  const deployments = initial?.deployments ?? [];
  const runningCount = deployments.filter((deployment) => deployment.state === "running").length;
  const attentionCount = deployments.filter(
    (deployment) => ["failed", "unknown"].includes(deployment.state) || deployment.reconcileFailureCount > 0,
  ).length;
  const canProvision = Boolean(
    initial?.providerConfigured &&
    tenantStatus === "active" &&
    installationEligibility === "eligible" &&
    !busy,
  );

  async function operate(
    deployment: Deployment,
    action: "start" | "stop" | "redeploy" | "remove",
  ) {
    if (!initial?.providerConfigured || busy) return;
    const confirmed = await pulse.confirm(
      action === "remove"
        ? {
            title: "Remove hosting provider resource?",
            message: "Permanently remove the stopped provider resource? Persistent volumes are preserved; volume cleanup remains a separate operation.",
            tone: "danger",
            confirmLabel: "Remove resource",
          }
        : action === "redeploy"
          ? {
              title: "Redeploy tenant application?",
              message: "Existing persistent volumes will be preserved during redeployment.",
              tone: "warning",
              confirmLabel: "Redeploy",
            }
          : action === "stop"
            ? {
                title: "Stop tenant application?",
                message: "The application will go offline while its data volumes are preserved.",
                tone: "warning",
                confirmLabel: "Stop app",
              }
            : {
                title: "Start tenant application?",
                message: "Starts the stopped application container for this tenant.",
                tone: "neutral",
                confirmLabel: "Start app",
              },
    );
    if (!confirmed) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await pulse.track<{ state?: string; confirmed?: boolean } | undefined>(
        async () => {
          const response = await fetch(
            `${baseUrl}/deployments/${encodeURIComponent(deployment.id)}/actions`,
            {
              method: "POST",
              credentials: "include",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ action }),
            },
          );
          await assertOk(response);
          const data = await responseData(response);
          return data.deployment as { state?: string; confirmed?: boolean } | undefined;
        },
        {
          title: `Hosting ${action}`,
          pendingDetail: `Contacting hosting provider for ${deployment.template}…`,
          successTitle: (result) =>
            result?.confirmed
              ? `Hosting ${action} complete (${result.state ?? "updated"})`
              : `Hosting ${action} accepted`,
          successDetail: (result) =>
            result?.confirmed
              ? undefined
              : "Provider state is still being verified; check status shortly.",
          group: `hosting:${deployment.id}`,
        },
      );
      setMessage(result?.confirmed
        ? `${action} completed. The provider reports ${result.state ?? "the updated state"}.`
        : `${action} was accepted. Provider state is still being verified; check the deployment status shortly.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Hosting ${action} failed.`);
    } finally {
      setBusy(false);
    }
  }

  async function provision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canProvision) return;
    const selected = templates.find((item) => item.id === template);
    const confirmed = await pulse.confirm({
      title: `Provision ${selected?.name ?? template} hosting?`,
      message: "This contacts the configured hosting provider and may incur infrastructure costs.",
      tone: "warning",
      confirmLabel: "Provision hosting",
    });
    if (!confirmed) return;
    setBusy(true);
    setMessage("");
    try {
      const deployment = await pulse.track<{ state?: string } | undefined>(
        async () => {
          const response = await fetch(`${baseUrl}/provision`, {
            method: "POST",
            credentials: "include",
            headers: {
              "content-type": "application/json",
              "idempotency-key": `host-${crypto.randomUUID()}`,
            },
            body: JSON.stringify({ template }),
          });
          await assertOk(response);
          const data = await responseData(response);
          return data.deployment as { state?: string } | undefined;
        },
        {
          title: `Provisioning ${selected?.name ?? template}`,
          pendingDetail: "Allocating hosting resources…",
          successTitle: (deployment) =>
            deployment?.state === "running" ? "Hosting resource running" : "Hosting resource created",
          successDetail: (deployment) =>
            deployment?.state === "running"
              ? undefined
              : "Deployment is still being checked; review status below.",
          group: `hosting:provision:${tenantId}`,
        },
      );
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

  function renderActions(deployment: Deployment) {
    return <div className={styles.actions}>
      {tenantStatus === "active" && ["stopped", "ready", "failed"].includes(deployment.state) &&
        <button className={styles.secondaryButton} type="button" disabled={busy || !initial?.providerConfigured} onClick={() => void operate(deployment, "start")}>Start</button>}
      {["running", "deploying", "ready", "failed"].includes(deployment.state) &&
        <button className={styles.dangerButton} type="button" disabled={busy || !initial?.providerConfigured} onClick={() => void operate(deployment, "stop")}>Stop</button>}
      {tenantStatus === "active" && ["running", "stopped", "ready", "failed"].includes(deployment.state) &&
        <button className={styles.secondaryButton} type="button" disabled={busy || !initial?.providerConfigured} onClick={() => void operate(deployment, "redeploy")}>Redeploy</button>}
      {tenantStatus === "closed" && deployment.state === "stopped" &&
        <button className={styles.dangerButton} type="button" disabled={busy || !initial?.providerConfigured} onClick={() => void operate(deployment, "remove")}>Remove resource</button>}
      {deployment.state === "removed" && <span className={styles.removedText}>Resource removed</span>}
    </div>;
  }

  return <section className={`panel ${styles.panel}`} aria-labelledby="hosting-title">
    <div className={styles.header}>
      <div className={styles.heading}>
        <p className={styles.eyebrow}>CLIENT HOSTING</p>
        <div className={styles.titleLine}>
          <h2 id="hosting-title">Hosting deployments</h2>
          <span className={`${styles.providerBadge} ${!initial ? styles.providerUnknown : initial.providerConfigured ? styles.providerReady : styles.providerDisabled}`}>
            <span aria-hidden="true" className={styles.providerDot} />
            {!initial ? "Provider status unavailable" : initial.providerConfigured ? "Provider configured" : "Provider not configured"}
          </span>
        </div>
        <p className={styles.subtitle}>Provision and manage tenant applications, monitor deployment health, and review the full operational history.</p>
      </div>
      <button
        className={styles.refreshButton}
        type="button"
        onClick={() => startRefresh(() => router.refresh())}
        disabled={isRefreshing}
      >
        <span aria-hidden="true" className={isRefreshing ? styles.refreshIconSpinning : styles.refreshIcon}>↻</span>
        {isRefreshing ? "Refreshing" : "Refresh status"}
      </button>
    </div>

    {status !== 200 || !initial ? (
      <div className={styles.loadError} role="status">
        <strong>{status === 403 ? "Hosting inventory access is restricted" : "Hosting inventory unavailable"}</strong>
        <span>{status === 403 ? "Your platform role cannot view hosting inventory." : `The hosting service returned HTTP ${status}. Refresh the page or try again shortly.`}</span>
      </div>
    ) : <>
      <div className={styles.summary} aria-label="Hosting summary">
        <article><span>DEPLOYMENTS</span><strong>{deployments.length}</strong><small>Latest records for this tenant</small></article>
        <article><span>RUNNING</span><strong>{runningCount}</strong><small>Provider reports active state</small></article>
        <article className={attentionCount > 0 ? styles.summaryAttention : ""}><span>NEEDS ATTENTION</span><strong>{attentionCount}</strong><small>Failed, unknown, or inspection issues</small></article>
      </div>

      {!initial.providerConfigured && <div className={`${styles.callout} ${styles.calloutWarning}`} role="status">
        <span aria-hidden="true" className={styles.calloutIcon}>!</span>
        <div><strong>Hosting provider is disabled in this API runtime</strong><p>Existing deployment records remain visible. To enable provisioning, set <code>HOSTING_PROVIDER=dokploy</code> and configure <code>DOKPLOY_BASE_URL</code>, <code>DOKPLOY_API_KEY</code>, and <code>DOKPLOY_ENVIRONMENT_ID</code> in the API runtime, then configure the required tenant secrets.</p></div>
      </div>}
      {tenantStatus !== "active" && <div className={`${styles.callout} ${styles.calloutNeutral}`} role="status">
        <span aria-hidden="true" className={styles.calloutIcon}>i</span>
        <div><strong>Tenant must be active to provision</strong><p>Current tenant status: <b>{tenantStatus}</b>. Provisioning becomes available after the tenant is active.</p></div>
      </div>}
      {installationEligibility === "missing" && <div className={`${styles.callout} ${styles.calloutNeutral}`} role="status">
        <span aria-hidden="true" className={styles.calloutIcon}>i</span>
        <div><strong>A dedicated product installation is required</strong><p>This tenant needs a dedicated installation in provisioning or ready state before hosting can be provisioned.</p></div>
      </div>}
      {installationEligibility === "unavailable" && <div className={`${styles.callout} ${styles.calloutWarning}`} role="status">
        <span aria-hidden="true" className={styles.calloutIcon}>!</span>
        <div><strong>Provisioning eligibility could not be verified</strong><p>The product installation service could not be checked. Reload the tenant record before provisioning.</p></div>
      </div>}

      <form className={styles.provisionCard} onSubmit={provision}>
        <div className={styles.provisionIntro}>
          <div><p className={styles.eyebrow}>NEW DEPLOYMENT</p><h3>Provision an application</h3></div>
          <span className={styles.costNote}>May incur infrastructure costs</span>
        </div>
        <div className={styles.provisionControls}>
          <label className={styles.templateLabel} htmlFor="hosting-template">Application template
            <select id="hosting-template" value={template} onChange={(event) => setTemplate(event.target.value as (typeof templates)[number]["id"])}>
              {templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <small>{templates.find((item) => item.id === template)?.description}</small>
          </label>
          <button className={styles.primaryButton} type="submit" disabled={!canProvision}>
            {busy ? "Submitting…" : "Provision hosting"}<span aria-hidden="true">→</span>
          </button>
        </div>
        {!canProvision && !busy && <p className={styles.blockedHint}>Resolve the status above to enable provisioning.</p>}
      </form>
      {message && <p className={styles.feedback} role="status">{message}</p>}

      <div className={styles.sectionHeading}>
        <div><p className={styles.eyebrow}>RESOURCE INVENTORY</p><h3>Deployments</h3></div>
        <span className={styles.count}>{deployments.length} shown · up to 20</span>
      </div>
      {deployments.length === 0 ? (
        <div className={styles.emptyState}>
          <span aria-hidden="true" className={styles.emptyIcon}>↗</span>
          <strong>No hosting deployments yet</strong>
          <p>When a deployment is provisioned, its provider, health and operational controls will appear here.</p>
        </div>
      ) : <div className={styles.deploymentList}>
        {deployments.map((deployment) => <article className={styles.deploymentCard} key={deployment.id}>
          <div className={styles.deploymentTop}>
            <div className={styles.resourceTitle}>
              <span className={styles.templateIcon} aria-hidden="true">{deployment.template === "wordpress" ? "W" : deployment.template === "ecommerce" ? "◇" : "N"}</span>
              <div><h4>{deployment.template}</h4><p>{deployment.provider} <span aria-hidden="true">·</span> v{deployment.templateVersion}</p></div>
            </div>
            <span className={`${styles.stateBadge} ${stateTone(deployment.state)}`}><span aria-hidden="true" />{deployment.state}</span>
          </div>
          <div className={styles.resourceId}>
            <span>PROVIDER RESOURCE</span>
            <code title={deployment.resourceId ?? deployment.id}>{deployment.state === "removed" ? "Resource removed" : deployment.resourceId ?? "Reference unavailable"}</code>
          </div>
          <div className={styles.deploymentMeta}>
            <div><span>ATTEMPTS</span><strong>{deployment.attemptCount}</strong></div>
            <div><span>LAST DEPLOYED</span><strong>{formatDate(deployment.lastDeployedAt)}</strong></div>
            <div><span>LAST CHECKED</span><strong>{deployment.lastInspectedAt ? formatDate(deployment.lastInspectedAt) : "Not checked yet"}</strong>{deployment.reconcileFailureCount > 0 && <small className={styles.inlineWarning}>{deployment.reconcileFailureCount} consecutive inspection failures</small>}</div>
            <div><span>NEXT CHECK</span><strong>{formatDate(deployment.nextReconcileAt)}</strong></div>
          </div>
          {deployment.errorCode && <p className={styles.errorCode}><span>Issue</span><code>{deployment.errorCode}</code></p>}
          <div className={styles.deploymentFooter}>
            <code className={styles.deploymentId} title={deployment.id}>{deployment.id}</code>
            {renderActions(deployment)}
          </div>
        </article>)}
      </div>}

      <div className={styles.sectionHeading}>
        <div><p className={styles.eyebrow}>APPEND-ONLY RECORD</p><h3>Hosting activity</h3><p className={styles.sectionDescription}>Most recent 50 events, including operator actions and provider state changes.</p></div>
        <span className={styles.count}>{initial.events.length} events</span>
      </div>
      <div className={`${styles.eventTableWrap} table-wrap`}>
        <table className={styles.eventTable}>
          <thead><tr><th>WHEN</th><th>EVENT</th><th>STATE CHANGE</th><th>ACTOR</th><th>DETAIL</th></tr></thead>
          <tbody>
            {initial.events.map((item) => (
              <tr key={item.id}>
                <td>{formatDate(item.occurredAt)}</td>
                <td><strong>{item.eventType}</strong><small title={item.deploymentId}>{item.deploymentId}</small></td>
                <td>{item.fromState ?? "—"} <span aria-label="to">→</span> {item.toState ?? "—"}</td>
                <td>{item.actorType}<small title={item.actorId}>{item.actorId}</small></td>
                <td>{Object.entries(item.metadata).map(([key, value]) => `${key}: ${String(value)}`).join(" · ") || "—"}</td>
              </tr>
            ))}
            {initial.events.length === 0 && <tr><td className={styles.eventEmpty} colSpan={5}>No hosting events recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>}
  </section>;
}
