import Link from "next/link";
import { notFound } from "next/navigation";
import { platformFetch, type Tenant } from "@/lib/platform";
import { LifecycleActions } from "./lifecycle-actions";

export default async function TenantDetail({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const result = await platformFetch<{ tenant: Tenant }>(`tenants/${encodeURIComponent(tenantId)}`);
  if (result.status === 404) notFound();
  if (!result.data) return <main className="detail-shell"><Link href="/">← Back to tenants</Link><section className="notice-card"><h1>Unable to load tenant</h1><p>Request failed with HTTP {result.status}. You may need platform tenant-read permission.</p></section></main>;
  const tenant = result.data.tenant;
  return <main className="detail-shell"><header className="topbar"><Link href="/">← All tenants</Link><span>Platform / Tenant detail</span></header><p className="eyebrow">WORKSPACE RECORD</p><h1>{tenant.name}</h1><p className="muted">{tenant.slug} · {tenant.id}</p><section className="detail-grid"><article><span>STATUS</span><strong className={`status status-${tenant.status}`}>{tenant.status}</strong></article><article><span>DEFAULT CURRENCY</span><strong>{tenant.default_currency}</strong></article><article><span>CREATED</span><strong>{new Date(tenant.created_at).toLocaleString("en-KE")}</strong></article></section><section className="panel"><p className="eyebrow">LIFECYCLE MANAGEMENT</p><h2>Workspace status</h2><p className="muted">Lifecycle changes are permission-checked and audited by the platform API. Closing a tenant is terminal.</p><LifecycleActions tenantId={tenant.id} status={tenant.status}/></section><p className="security">This view currently exposes registry metadata only. Owner assignment, module entitlements, settings and usage are not yet enabled.</p></main>;
}
