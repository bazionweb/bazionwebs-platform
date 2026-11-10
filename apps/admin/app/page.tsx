import Link from "next/link";
import { platformFetch, requirePlatformOwner, type Tenant } from "@/lib/platform";

type TenantList = { items: Tenant[]; total: number; limit: number; offset: number };

function Status({ value }: { value: Tenant["status"] }) {
  return <span className={`status status-${value}`}>{value}</span>;
}

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  await requirePlatformOwner();
  const params = await searchParams;
  const page = Math.max(0, Number(params.page ?? 0) || 0);
  const query = new URLSearchParams({ limit: "25", offset: String(page * 25) });
  if (["provisioning", "active", "suspended", "closed"].includes(params.status ?? "")) query.set("status", params.status!);
  const result = await platformFetch<TenantList>(`tenants?${query.toString()}`);
  const tenants = result.data?.items ?? [];
  const filtered = params.q?.trim()
    ? tenants.filter((tenant) => [tenant.name, tenant.slug, tenant.id].some((value) => value.toLowerCase().includes(params.q!.trim().toLowerCase())))
    : tenants;

  return <main className="frame">
    <aside className="sidebar">
      <Link className="wordmark" href="/">BAZION<span> / CONTROL</span></Link>
      <p className="side-label">PLATFORM</p>
      <Link className="side-link selected" href="/">◫ <span>Overview & tenants</span></Link>
      <div className="side-bottom"><span className="avatar">B</span><div><strong>Platform operations</strong><small>Secure control plane</small></div></div>
    </aside>
    <section className="content">
      <header className="topbar"><span>Platform / Overview</span><Link href="/login">Sign in / switch account ↗</Link></header>
      <div className="page-head"><div><p className="eyebrow">CONTROL PLANE · TENANT OPERATIONS</p><h1>Platform overview</h1><p className="muted">Monitor client workspaces and their lifecycle from one place.</p></div><span className="live-tag">● LIVE DATA</span></div>
      {result.status === 401 || result.status === 403 ? <section className="notice-card"><h2>Platform access required</h2><p>Your session is not signed in or does not have the platform tenant-list permission.</p><Link className="primary" href="/login">Sign in to platform</Link></section> :
       result.status !== 200 ? <section className="notice-card"><h2>Platform API unavailable</h2><p>Could not load tenant data (HTTP {result.status}). Check API_BASE_URL and API availability.</p></section> :
      <>
        <div className="metric-grid">
          <article><span>REGISTERED WORKSPACES</span><strong>{result.data?.total ?? 0}</strong><small>Across all lifecycle states</small></article>
          <article><span>ACTIVE ON THIS PAGE</span><strong>{tenants.filter(t => t.status === "active").length}</strong><small>Current page · 25 maximum</small></article>
          <article><span>NEEDS ATTENTION</span><strong>{tenants.filter(t => t.status === "provisioning" || t.status === "suspended").length}</strong><small>Provisioning or suspended</small></article>
        </div>
        <section className="panel">
          <div className="panel-head"><div><p className="eyebrow">CUSTOMER DIRECTORY</p><h2>Tenants</h2><p className="muted">Search the currently loaded page by name, slug or tenant ID.</p></div><span className="count">{result.data?.total ?? 0} TOTAL</span></div>
          <form className="filters" action="/" method="get">
            <input name="q" defaultValue={params.q ?? ""} placeholder="Search tenants on this page…" aria-label="Search tenants" />
            <select name="status" defaultValue={params.status ?? ""} aria-label="Filter by status"><option value="">All statuses</option><option value="active">Active</option><option value="provisioning">Provisioning</option><option value="suspended">Suspended</option><option value="closed">Closed</option></select>
            <button type="submit">Filter</button>
          </form>
          <div className="table-wrap"><table><thead><tr><th>WORKSPACE</th><th>SLUG</th><th>CURRENCY</th><th>STATUS</th><th>CREATED</th><th></th></tr></thead>
            <tbody>{filtered.map(tenant => <tr key={tenant.id}><td><strong>{tenant.name}</strong><small>{tenant.id}</small></td><td>{tenant.slug}</td><td>{tenant.default_currency}</td><td><Status value={tenant.status}/></td><td>{new Date(tenant.created_at).toLocaleDateString("en-KE")}</td><td><Link className="row-link" href={`/tenants/${tenant.id}`}>View →</Link></td></tr>)}
              {filtered.length === 0 && <tr><td className="empty" colSpan={6}>No tenants match this page and filter.</td></tr>}</tbody></table></div>
          <div className="pagination"><span>Showing {page * 25 + (tenants.length ? 1 : 0)}–{page * 25 + tenants.length} of {result.data?.total ?? 0}</span><div>{page > 0 && <Link href={`/?page=${page - 1}`}>← Previous</Link>} {page * 25 + 25 < (result.data?.total ?? 0) && <Link href={`/?page=${page + 1}`}>Next →</Link>}</div></div>
        </section>
      </>}
      <footer>BAZION WEB PLATFORM <span>Platform operator access is audited and permission-controlled.</span></footer>
    </section>
  </main>;
}
