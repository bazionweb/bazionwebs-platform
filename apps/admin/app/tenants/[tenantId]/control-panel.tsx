"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { assertOk, pulse } from "@bazion/ui";
import { getTenantDomainUrl, getTenantStorefrontUrl } from "@/lib/public-urls";

type Candidate = { userId: string; name: string; email: string; emailVerified: boolean; roles: string[] };
type OwnerState = { currentOwners: Candidate[]; candidates: Candidate[]; total: number; limit: number; offset: number };
type ModuleItem = { id: string; name: string; version: string; status: string; tenantModel: string; dependencies: string[]; description: string; enabled: boolean; required: boolean; canManage: boolean };
type Settings = { locale: string; timeZone: string; defaultCurrency: "KES" | "USD" | "EUR" | "GBP"; brandName: string; primaryColor: string; supportEmail: string };
type SettingsState = { settings: Settings; version: number; updatedAt: string | null };
type AuditItem = { id: string; occurred_at: string; actor_type: string; actor_id: string; actor_role: string | null; action: string; resource_type: string; resource_id: string | null; outcome: string };
type Usage = { asOf: string; members: number | null; products: number; activeProducts: number; orders: number; paidOrders: number; pendingOrders: number };
type TenantDomain = { id: string; hostname: string; status: "pending" | "active" | "disabled"; verified_at: string | null; created_at: string; updated_at: string };
type TenantDomains = { items: TenantDomain[] };
type DomainChallenge = { domainId: string; hostname: string; name: string; value: string };

async function responseData(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({})) as Promise<Record<string, unknown>>;
}
function LoadError({ status, label }: { status: number; label: string }) {
  return <p className="muted">{status === 403 ? `Your platform role cannot view ${label}.` : `Could not load ${label} (HTTP ${status}).`}</p>;
}

export function TenantControlPanel(props: {
  tenantId: string;
  tenantSlug?: string;
  ownerInitial: OwnerState | null; ownerStatus: number;
  modulesInitial: { modules: ModuleItem[] } | null; modulesStatus: number;
  settingsInitial: SettingsState | null; settingsStatus: number;
  auditInitial: { items: AuditItem[]; total: number } | null; auditStatus: number;
  usageInitial: Usage | null; usageStatus: number;
  domainsInitial: TenantDomains | null; domainsStatus: number;
}) {
  const router = useRouter();
  const [owners, setOwners] = useState(props.ownerInitial);
  const [modules, setModules] = useState(props.modulesInitial?.modules ?? []);
  const [settings, setSettings] = useState(props.settingsInitial);
  const [draft, setDraft] = useState<Settings>(props.settingsInitial?.settings ?? {
    locale: "en-KE", timeZone: "Africa/Nairobi", defaultCurrency: "KES", brandName: "", primaryColor: "#236b4c", supportEmail: "",
  });
  const audit = props.auditInitial;
  const usage = props.usageInitial;
  const [domains, setDomains] = useState<TenantDomain[]>(props.domainsInitial?.items ?? []);
  const [domainInput, setDomainInput] = useState("");
  const [domainChallenge, setDomainChallenge] = useState<DomainChallenge | null>(null);
  const [search, setSearch] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [busy, setBusy] = useState("");
  const [messages, setMessages] = useState<Record<string, string>>({});
  useEffect(() => {
    setOwners(props.ownerInitial);
    setModules(props.modulesInitial?.modules ?? []);
    setSettings(props.settingsInitial);
    setDomains(props.domainsInitial?.items ?? []);
    if (props.settingsInitial) setDraft(props.settingsInitial.settings);
  }, [props.ownerInitial, props.modulesInitial, props.settingsInitial, props.domainsInitial]);

  const setMessage = (key: string, value: string) => setMessages((current) => ({ ...current, [key]: value }));
  const url = (path: string) => `/v1/admin/platform/tenants/${encodeURIComponent(props.tenantId)}/${path}`;

  async function loadCandidates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("owner-search"); setMessage("owner", "");
    try {
      const query = new URLSearchParams({ limit: "50", offset: "0" });
      if (search.trim()) query.set("q", search.trim());
      const response = await fetch(`${url("owner-candidates")}?${query}`, { credentials: "include", cache: "no-store" });
      const data = await responseData(response);
      if (!response.ok) throw new Error(String(data.message ?? data.error ?? `Request failed (${response.status})`));
      setOwners(data as unknown as OwnerState); setCandidateId("");
    } catch (error) { setMessage("owner", error instanceof Error ? error.message : "Could not load members."); }
    finally { setBusy(""); }
  }

  async function transferOwner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = owners?.candidates.find((item) => item.userId === candidateId && item.emailVerified && !item.roles.includes("owner"));
    if (!target) return;
    const current = owners?.currentOwners[0];
    const confirmed = await pulse.confirm({
      title: current ? `Transfer ownership to ${target.name}?` : `Assign ${target.name} as owner?`,
      message: current
        ? `Transfers ownership from ${current.name} to ${target.name}. The previous owner will become an administrator.`
        : `Assigns ${target.name} as the initial tenant owner.`,
      tone: "warning",
      confirmLabel: current ? "Transfer ownership" : "Assign owner",
    });
    if (!confirmed) return;
    setBusy("owner-transfer"); setMessage("owner", "");
    try {
      await pulse.track(
        async () => {
          const response = await fetch(url("owner"), {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ targetUserId: candidateId }),
          });
          await assertOk(response);
        },
        {
          title: "Updating tenant ownership",
          pendingDetail: `Assigning ${target.name}…`,
          successTitle: "Tenant ownership updated",
          group: `tenant:owner:${props.tenantId}`,
        },
      );
      setMessage("owner", current ? `Ownership transferred to ${target.name}; the former owner is now an administrator.` : `${target.name} is now the tenant owner.`);
      setCandidateId(""); router.refresh();
    } catch (error) { setMessage("owner", error instanceof Error ? error.message : "Ownership transfer failed."); }
    finally { setBusy(""); }
  }

  async function setModule(module: ModuleItem, enabled: boolean) {
    if (!module.canManage) return;
    if (!enabled) {
      const confirmed = await pulse.confirm({
        title: `Disable ${module.name}?`,
        message: "Existing data is retained, but APIs enforcing this entitlement will be blocked.",
        tone: "warning",
        confirmLabel: "Disable module",
      });
      if (!confirmed) return;
    }
    setBusy(`module:${module.id}`); setMessage("modules", "");
    try {
      await pulse.track(
        async () => {
          const response = await fetch(url(`modules/${encodeURIComponent(module.id)}`), {
            method: "PUT", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled }),
          });
          await assertOk(response);
        },
        {
          title: `${enabled ? "Enabling" : "Disabling"} ${module.name}`,
          successTitle: `${module.name} ${enabled ? "enabled" : "disabled"}`,
          group: `tenant:module:${module.id}`,
        },
      );
      setModules((current) => current.map((item) => item.id === module.id ? { ...item, enabled } : item));
      setMessage("modules", `${module.name} ${enabled ? "enabled" : "disabled"} for this tenant.`);
    } catch (error) { setMessage("modules", error instanceof Error ? error.message : "Entitlement update failed."); }
    finally { setBusy(""); }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    setBusy("settings"); setMessage("settings", "");
    try {
      const value = await pulse.track(
        async () => {
          const response = await fetch(url("settings"), {
            method: "PATCH", credentials: "include", headers: { "content-type": "application/json" },
            body: JSON.stringify({ expectedVersion: settings.version, settings: draft }),
          });
          if (response.status === 409) router.refresh();
          await assertOk(response);
          return (await responseData(response)) as unknown as SettingsState;
        },
        {
          title: "Saving workspace settings",
          pendingDetail: `Version ${settings.version}…`,
          successTitle: "Workspace settings saved",
          group: `tenant:settings:${props.tenantId}`,
        },
      );
      setSettings(value); setDraft(value.settings); setMessage("settings", "Workspace settings saved.");
    } catch (error) { setMessage("settings", error instanceof Error ? error.message : "Could not save settings."); }
    finally { setBusy(""); }
  }


  async function addDomain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("domain-create"); setMessage("domains", "");
    try {
      const { domain, challenge } = await pulse.track(
        async () => {
          const response = await fetch(url("domains"), {
            method: "POST", credentials: "include", headers: { "content-type": "application/json" },
            body: JSON.stringify({ hostname: domainInput }),
          });
          await assertOk(response);
          const data = await responseData(response);
          return {
            domain: data.domain as TenantDomain,
            challenge: data.challenge as { type: "TXT"; name: string; value: string },
          };
        },
        {
          title: "Adding custom domain",
          pendingDetail: `Generating DNS TXT challenge for ${domainInput}…`,
          successTitle: "DNS challenge created",
          group: `tenant:domain:add:${props.tenantId}`,
        },
      );
      setDomains((current) => [domain, ...current.filter((item) => item.id !== domain.id)]);
      setDomainChallenge({ domainId: domain.id, hostname: domain.hostname, name: challenge.name, value: challenge.value });
      setDomainInput("");
      setMessage("domains", "DNS challenge created. Add the TXT record, allow DNS to propagate, then verify.");
    } catch (error) { setMessage("domains", error instanceof Error ? error.message : "Could not add the domain."); }
    finally { setBusy(""); }
  }

  async function verifyDomain(domain: TenantDomain) {
    setBusy(`domain-verify:${domain.id}`); setMessage("domains", "");
    try {
      const updated = await pulse.track(
        async () => {
          const response = await fetch(url(`domains/${encodeURIComponent(domain.id)}/verify`), {
            method: "POST", credentials: "include",
          });
          await assertOk(response);
          const data = await responseData(response);
          return data.domain as TenantDomain;
        },
        {
          title: `Verifying ${domain.hostname}`,
          pendingDetail: "Checking DNS TXT record propagation…",
          successTitle: `${domain.hostname} verified`,
          group: `tenant:domain:verify:${domain.id}`,
        },
      );
      setDomains((current) => current.map((item) => item.id === updated.id ? updated : item));
      setDomainChallenge((current) => current?.domainId === updated.id ? null : current);
      setMessage("domains", `${updated.hostname} is verified and active.`);
    } catch (error) { setMessage("domains", error instanceof Error ? error.message : "Domain verification failed."); }
    finally { setBusy(""); }
  }

  async function disableDomain(domain: TenantDomain) {
    const confirmed = await pulse.confirm({
      title: `Disable ${domain.hostname}?`,
      message: "This domain will stop resolving to this tenant.",
      tone: "danger",
      confirmLabel: "Disable domain",
    });
    if (!confirmed) return;
    setBusy(`domain-disable:${domain.id}`); setMessage("domains", "");
    try {
      const updated = await pulse.track(
        async () => {
          const response = await fetch(url(`domains/${encodeURIComponent(domain.id)}/disable`), {
            method: "POST", credentials: "include",
          });
          await assertOk(response);
          const data = await responseData(response);
          return data.domain as TenantDomain;
        },
        {
          title: `Disabling ${domain.hostname}`,
          successTitle: `${domain.hostname} disabled`,
          group: `tenant:domain:disable:${domain.id}`,
        },
      );
      setDomains((current) => current.map((item) => item.id === updated.id ? updated : item));
      if (domainChallenge?.domainId === updated.id) setDomainChallenge(null);
      setMessage("domains", `${updated.hostname} has been disabled.`);
    } catch (error) { setMessage("domains", error instanceof Error ? error.message : "Could not disable the domain."); }
    finally { setBusy(""); }
  }


  const previewUrl = getTenantStorefrontUrl(props.tenantSlug || "tenant-slug");

  return <div className="tenant-controls">
    <section className="panel">
      <div className="panel-head"><div><p className="eyebrow">OWNERSHIP</p><h2>Tenant owner</h2><p className="muted">Platform-owner authority only. New owners must be verified existing tenant members.</p></div></div>
      {props.ownerStatus !== 200 || !owners ? <LoadError status={props.ownerStatus} label="owner candidates"/> : <>
        {owners.currentOwners.length ? <div className="owner-current"><span className="avatar">{owners.currentOwners[0]!.name.slice(0,1).toUpperCase()}</span><div><strong>{owners.currentOwners[0]!.name}</strong><small>{owners.currentOwners[0]!.email} · Current owner</small></div>{owners.currentOwners.length > 1 && <span className="status status-suspended">Multiple owners</span>}</div> : <p className="notice-inline">No owner is assigned. Choose a verified member for the initial assignment.</p>}
        <form className="owner-search" onSubmit={loadCandidates}><label>Find tenant members<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or email"/></label><button className="secondary" disabled={busy === "owner-search"}>{busy === "owner-search" ? "Searching…" : "Search"}</button></form>
        <form className="owner-transfer-form" onSubmit={transferOwner}><label>New owner<select value={candidateId} onChange={(event) => setCandidateId(event.target.value)}><option value="">Choose a verified member</option>{owners.candidates.filter((item) => item.emailVerified && !item.roles.includes("owner")).map((item) => <option key={item.userId} value={item.userId}>{item.name} — {item.email}</option>)}</select></label><button className="primary" disabled={!candidateId || busy === "owner-transfer" || owners.currentOwners.length > 1}>{owners.currentOwners.length > 1 ? "Resolve owner conflict first" : owners.currentOwners.length ? "Transfer ownership" : "Assign owner"}</button></form>
        {owners.total > owners.candidates.length && <p className="muted">Showing {owners.candidates.length} of {owners.total} members. Search to locate another member.</p>}
      </>}
      {messages.owner && <p className="feedback" role="status">{messages.owner}</p>}
    </section>

    <section className="panel"><div className="panel-head"><div><p className="eyebrow">MODULE ACCESS</p><h2>Module catalogue & entitlements</h2><p className="muted">Planned modules are visible but cannot yet be activated. Disabling retains tenant data.</p></div></div>
      {props.modulesStatus !== 200 || !modules.length ? <LoadError status={props.modulesStatus} label="module entitlements"/> : <div className="module-list">{modules.map((module) => <article className="module-row" key={module.id}><div><div className="module-title"><strong>{module.name}</strong><span className={`status status-${module.status === "planned" ? "provisioning" : module.enabled ? "active" : "suspended"}`}>{module.status}</span></div><p>{module.description}</p><small>{module.id} · v{module.version} · {module.tenantModel}</small>{module.dependencies.length > 0 && <small>Requires: {module.dependencies.join(", ")}</small>}</div><label className="switch-label"><span>{module.required ? "Required" : module.enabled ? "Enabled" : "Disabled"}</span><input type="checkbox" checked={module.enabled} disabled={!module.canManage || busy === `module:${module.id}`} onChange={(event) => void setModule(module, event.target.checked)} aria-label={`${module.enabled ? "Disable" : "Enable"} ${module.name}`}/></label></article>)}</div>}
      {messages.modules && <p className="feedback" role="status">{messages.modules}</p>}
    </section>

    <section className="panel"><div className="panel-head"><div><p className="eyebrow">TENANT CONFIGURATION</p><h2>Workspace settings</h2><p className="muted">Optimistic versioning prevents one operator overwriting another's changes.</p></div></div>
      {props.settingsStatus !== 200 || !settings ? <LoadError status={props.settingsStatus} label="tenant configuration"/> : <form className="control-form settings-form" onSubmit={saveSettings}>
        <label>Locale<input value={draft.locale} maxLength={16} onChange={(event) => setDraft((v) => ({ ...v, locale: event.target.value }))}/></label>
        <label>Time zone<input value={draft.timeZone} maxLength={64} onChange={(event) => setDraft((v) => ({ ...v, timeZone: event.target.value }))}/></label>
        <label>Default currency<select value={draft.defaultCurrency} onChange={(event) => setDraft((v) => ({ ...v, defaultCurrency: event.target.value as Settings["defaultCurrency"] }))}><option value="KES">KES — Kenyan shilling</option><option value="USD">USD — US dollar</option><option value="EUR">EUR — Euro</option><option value="GBP">GBP — Pound sterling</option></select></label>
        <label>Brand / display name<input value={draft.brandName} maxLength={100} onChange={(event) => setDraft((v) => ({ ...v, brandName: event.target.value }))}/></label>
        <label>Support email<input type="email" value={draft.supportEmail} maxLength={254} onChange={(event) => setDraft((v) => ({ ...v, supportEmail: event.target.value }))}/></label>
        <label>Primary brand color<input value={draft.primaryColor} pattern="#[0-9a-fA-F]{6}" onChange={(event) => setDraft((v) => ({ ...v, primaryColor: event.target.value }))}/></label>
        <div className="settings-footer"><small>Version {settings.version}{settings.updatedAt ? ` · Updated ${new Date(settings.updatedAt).toLocaleString("en-KE")}` : " · Defaults"}</small><button className="primary" disabled={busy === "settings"}>{busy === "settings" ? "Saving…" : "Save settings"}</button></div>
      </form>}
      {messages.settings && <p className="feedback" role="status">{messages.settings}</p>}
    </section>


    <section className="panel">
      <div className="panel-head"><div><p className="eyebrow">CUSTOM DOMAINS</p><h2>Tenant domains</h2><p className="muted">Verify domain ownership with a DNS TXT record before the hostname becomes active.</p><p className="muted" style={{ fontSize: 12, marginTop: 4 }}>💡 Before a custom DNS domain is verified, this storefront is automatically live on its server preview subdomain: <a href={previewUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "underline" }}><code>{previewUrl}</code> ↗</a></p></div><span className="count">{domains.length} DOMAINS</span></div>
      {props.domainsStatus !== 200 && !props.domainsInitial ? <LoadError status={props.domainsStatus} label="custom domains"/> : <>
        <form className="owner-search" onSubmit={addDomain}>
          <label>Hostname<input value={domainInput} onChange={(event) => setDomainInput(event.target.value)} placeholder="shop.example.com" maxLength={253}/></label>
          <button className="primary" disabled={!domainInput.trim() || busy === "domain-create"}>{busy === "domain-create" ? "Creating…" : "Add domain"}</button>
        </form>
        {domainChallenge && <div className="notice-inline domain-challenge" role="status">
          <strong>Publish this DNS TXT record</strong>
          <p>Add the record below at your DNS provider. The challenge value is shown only when generated; it expires after seven days. Add the same hostname again to rotate it if it is lost.</p>
          <p><strong>Type:</strong> TXT<br/><strong>Name / Host:</strong> <code>{domainChallenge.name}</code><br/><strong>Value:</strong> <code>{domainChallenge.value}</code></p>
          <p>After the DNS record has propagated, select Verify. The platform checks the TXT record before enabling the hostname.</p>
        </div>}
        <div className="table-wrap">
          <table><thead><tr><th>HOSTNAME</th><th>STATUS</th><th>VERIFIED</th><th>ACTIONS</th></tr></thead>
            <tbody>{domains.map((domain) => <tr key={domain.id}>
              <td>
                <strong>{domain.hostname}</strong>
                <small>{domain.id}</small>
                {domain.status === "active" && (
                  <div style={{ marginTop: 4 }}>
                    <a
                      href={getTenantDomainUrl(domain.hostname)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 11, color: "var(--accent)", textDecoration: "underline" }}
                    >
                      Open storefront ↗
                    </a>
                  </div>
                )}
              </td>
              <td><span className={`status status-${domain.status === "active" ? "active" : domain.status === "pending" ? "provisioning" : "suspended"}`}>{domain.status}</span></td>
              <td>{domain.verified_at ? new Date(domain.verified_at).toLocaleString("en-KE") : "—"}</td>
              <td>{domain.status === "pending" ? <button className="secondary" disabled={busy === `domain-verify:${domain.id}`} onClick={() => void verifyDomain(domain)}>{busy === `domain-verify:${domain.id}` ? "Checking…" : "Verify"}</button> : null}
                {domain.status !== "disabled" ? <button className="danger" style={{ marginLeft: 8 }} disabled={busy === `domain-disable:${domain.id}`} onClick={() => void disableDomain(domain)}>Disable</button> : "—"}</td>
            </tr>)}{domains.length === 0 && <tr><td className="empty" colSpan={4}>No custom domains registered for this tenant.</td></tr>}</tbody>
          </table>
        </div>
      </>}
      {messages.domains && <p className="feedback" role="status">{messages.domains}</p>}
    </section>

    <section className="panel"><div className="panel-head"><div><p className="eyebrow">PLATFORM TELEMETRY</p><h2>Usage reporting</h2><p className="muted">Live counts from tenant membership, products and orders.</p></div></div>
      {props.usageStatus !== 200 || !usage ? <LoadError status={props.usageStatus} label="usage metrics"/> : <><div className="usage-grid"><article><span>MEMBERS</span><strong>{usage.members ?? "—"}</strong></article><article><span>PRODUCTS</span><strong>{usage.products}</strong><small>{usage.activeProducts} active</small></article><article><span>ORDERS</span><strong>{usage.orders}</strong><small>{usage.paidOrders} paid · {usage.pendingOrders} pending</small></article></div><p className="muted">Snapshot: {new Date(usage.asOf).toLocaleString("en-KE")}. Storage, bandwidth and API-request usage are not yet metered.</p></>}
    </section>

    <section className="panel"><div className="panel-head"><div><p className="eyebrow">SECURITY RECORD</p><h2>Audit history</h2><p className="muted">Append-only privileged actions associated with this tenant.</p></div><span className="count">{audit?.total ?? 0} EVENTS</span></div>
      {props.auditStatus !== 200 || !audit ? <LoadError status={props.auditStatus} label="audit history"/> : <div className="table-wrap"><table><thead><tr><th>WHEN</th><th>ACTION</th><th>ACTOR</th><th>RESULT</th></tr></thead><tbody>{audit.items.map((item) => <tr key={item.id}><td>{new Date(item.occurred_at).toLocaleString("en-KE")}</td><td><strong>{item.action}</strong><small>{item.resource_type}{item.resource_id ? ` · ${item.resource_id}` : ""}</small></td><td><strong>{item.actor_role ?? item.actor_type}</strong><small>{item.actor_id}</small></td><td><span className={`status status-${item.outcome === "succeeded" ? "active" : "suspended"}`}>{item.outcome}</span></td></tr>)}{audit.items.length === 0 && <tr><td className="empty" colSpan={4}>No tenant-scoped audit events have been recorded.</td></tr>}</tbody></table></div>}
    </section>
  </div>;
}
