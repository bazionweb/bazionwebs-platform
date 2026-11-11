import Link from "next/link";
import { notFound } from "next/navigation";
import { platformFetch, requirePlatformOwner, type Tenant } from "@/lib/platform";
import { LifecycleActions } from "./lifecycle-actions";
import { TenantControlPanel } from "./control-panel";

type OwnerCandidate = { userId: string; name: string; email: string; emailVerified: boolean; roles: string[] };
type ModuleItem = {
  id: string; name: string; version: string; status: string; tenantModel: string; dependencies: string[];
  description: string; enabled: boolean; defaultEnabled: boolean; required: boolean;
  tenantAssignable: boolean; isOverride: boolean; updatedAt: string | null; canManage: boolean;
};
type TenantSettings = {
  settings: { locale: string; timeZone: string; defaultCurrency: "KES" | "USD" | "EUR" | "GBP"; brandName: string; primaryColor: string; supportEmail: string };
  version: number; updatedAt: string | null;
};
type AuditItem = {
  id: string; occurred_at: string; actor_type: string; actor_id: string; actor_role: string | null;
  action: string; resource_type: string; resource_id: string | null; outcome: string;
  request_id: string | null; metadata: Record<string, string | number | boolean | null>;
};
type Usage = {
  tenantId: string; asOf: string; members: number | null; products: number; activeProducts: number;
  orders: number; paidOrders: number; pendingOrders: number;
};
type TenantDomain = { id: string; hostname: string; status: "pending" | "active" | "disabled"; verified_at: string | null; created_at: string; updated_at: string };
type TenantDomains = { items: TenantDomain[] };

export default async function TenantDetail({ params }: { params: Promise<{ tenantId: string }> }) {
  await requirePlatformOwner();
  const { tenantId } = await params;
  const result = await platformFetch<{ tenant: Tenant }>(`tenants/${encodeURIComponent(tenantId)}`);
  if (result.status === 404) notFound();
  if (!result.data) return <main className="detail-shell"><Link href="/">← Back to tenants</Link><section className="notice-card"><h1>Unable to load tenant</h1><p>Request failed with HTTP {result.status}. You may need platform tenant-read permission.</p></section></main>;
  const tenant = result.data.tenant;

  const [owner, modules, settings, audit, usage, domains] = await Promise.all([
    platformFetch<{ currentOwners: OwnerCandidate[]; candidates: OwnerCandidate[]; total: number; limit: number; offset: number }>(
      `tenants/${encodeURIComponent(tenantId)}/owner-candidates?limit=50`,
    ),
    platformFetch<{ modules: ModuleItem[] }>(`tenants/${encodeURIComponent(tenantId)}/modules`),
    platformFetch<TenantSettings>(`tenants/${encodeURIComponent(tenantId)}/settings`),
    platformFetch<{ items: AuditItem[]; total: number; limit: number; offset: number }>(
      `tenants/${encodeURIComponent(tenantId)}/audit?limit=10`,
    ),
    platformFetch<Usage>(`tenants/${encodeURIComponent(tenantId)}/usage`),
    platformFetch<TenantDomains>(`tenants/${encodeURIComponent(tenantId)}/domains`),
  ]);

  return <main className="detail-shell">
    <header className="topbar"><Link href="/">← All tenants</Link><span>Platform / Tenant detail</span></header>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
      <div>
        <p className="eyebrow">WORKSPACE RECORD</p>
        <h1>{tenant.name}</h1>
        <p className="muted">{tenant.slug} · {tenant.id}</p>
      </div>
      <div style={{ display: "flex", gap: "10px", marginTop: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <Link href={`/troubleshoot?tenantId=${tenant.id}`} className="secondary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          🛠️ Troubleshoot Workspace
        </Link>
        <a
          href={`http://localhost:3100/?tenant=${tenant.slug}`}
          target="_blank"
          rel="noreferrer"
          className="secondary"
          title={`Visit ${tenant.name} public website`}
        >
          Open Storefront ↗
        </a>
        <a
          href={`http://localhost:3100/workspace?select=${tenant.auth_organization_id ?? ""}&workspace=${tenant.slug}&redirect=/admin`}
          target="_blank"
          rel="noreferrer"
          className="primary"
          title={`Open ${tenant.name} tenant administration desk`}
        >
          Open Tenant Desk ↗
        </a>
      </div>
    </div>
    <section className="detail-grid">
      <article><span>STATUS</span><strong className={`status status-${tenant.status}`}>{tenant.status}</strong></article>
      <article><span>DEFAULT CURRENCY</span><strong>{tenant.default_currency}</strong></article>
      <article><span>CREATED</span><strong>{new Date(tenant.created_at).toLocaleString("en-KE")}</strong></article>
    </section>
    <section className="panel"><p className="eyebrow">LIFECYCLE MANAGEMENT</p><h2>Workspace status</h2><p className="muted">Lifecycle changes are permission-checked and audited by the platform API. Closing a tenant is terminal.</p><LifecycleActions tenantId={tenant.id} status={tenant.status}/></section>
    <TenantControlPanel
      tenantId={tenant.id}
      ownerInitial={owner.data}
      ownerStatus={owner.status}
      modulesInitial={modules.data}
      modulesStatus={modules.status}
      settingsInitial={settings.data}
      settingsStatus={settings.status}
      auditInitial={audit.data}
      auditStatus={audit.status}
      usageInitial={usage.data}
      usageStatus={usage.status}
      domainsInitial={domains.data}
      domainsStatus={domains.status}
    />
    <p className="security">Control-plane access is enforced by platform permissions on every API request. Tenant identifiers are never treated as authorization. Audit records are append-only; usage metrics currently cover member, product and order counts.</p>
  </main>;
}
