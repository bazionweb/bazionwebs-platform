import Link from "next/link";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminTopbar } from "@/components/admin-topbar";
import { CreateTenantModal, ReconcileButton } from "@/components/tenant-actions";
import { platformFetch, requirePlatformOwner, type Tenant } from "@/lib/platform";
import { getTenantStorefrontUrl, getTenantWorkspacePickerUrl } from "@/lib/public-urls";

type TenantList = { items: Tenant[]; total: number; limit: number; offset: number };

function Status({ value }: { value: Tenant["status"] }) {
  return <span className={`status status-${value}`}>{value}</span>;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const identity = await requirePlatformOwner();
  const params = await searchParams;
  const page = Math.max(0, Number(params.page ?? 0) || 0);
  const query = new URLSearchParams({ limit: "25", offset: String(page * 25) });
  if (["provisioning", "active", "suspended", "closed"].includes(params.status ?? "")) {
    query.set("status", params.status!);
  }

  const result = await platformFetch<TenantList>(`tenants?${query.toString()}`);
  const tenants = result.data?.items ?? [];
  const filtered = params.q?.trim()
    ? tenants.filter((tenant) =>
        [tenant.name, tenant.slug, tenant.id].some((value) =>
          value.toLowerCase().includes(params.q!.trim().toLowerCase()),
        ),
      )
    : tenants;

  const totalRegistered = result.data?.total ?? 0;
  const activeCount = tenants.filter((t) => t.status === "active").length;
  const attentionCount = tenants.filter(
    (t) => t.status === "provisioning" || t.status === "suspended",
  ).length;

  return (
    <main className="frame">
      <AdminSidebar
        userEmail={identity?.user.email}
        userName={identity?.user.name}
        platformRole={identity?.platformRole ?? undefined}
      />

      <section className="content">
        <AdminTopbar
          title="Platform / Overview"
          userEmail={identity?.user.email}
          platformRole={identity?.platformRole ?? undefined}
        />

        <div className="page-head">
          <div>
            <p className="eyebrow">CONTROL PLANE · TENANT OPERATIONS</p>
            <h1>Platform Overview</h1>
            <p className="muted">
              Monitor client workspaces, lifecycle states, entitlements and domain configurations from one place.
            </p>
          </div>
          <div className="page-head-actions">
            <span className="live-tag">● LIVE PLATFORM DATA</span>
          </div>
        </div>

        {result.status === 401 || result.status === 403 ? (
          <section className="notice-card">
            <h2>Platform access required</h2>
            <p>Your session is not signed in or does not have the platform tenant-list permission.</p>
            <Link className="primary" href="/login">
              Sign in to platform
            </Link>
          </section>
        ) : result.status !== 200 ? (
          <section className="notice-card">
            <h2>Platform API unavailable</h2>
            <p>
              Could not load tenant data (HTTP {result.status}). Ensure the Fastify API backend is running
              on port 4100 (or 4000) and that <code>API_BASE_URL</code> is reachable.
            </p>
            <div style={{ marginTop: 14 }}>
              <Link className="primary" href="/">
                Retry Connection ↻
              </Link>
            </div>
          </section>
        ) : (
          <>
            <div className="metric-grid">
              <Link href="/" className="metric-card-link">
                <article>
                  <span>REGISTERED WORKSPACES</span>
                  <strong>{totalRegistered}</strong>
                  <small>Across all lifecycle states</small>
                </article>
              </Link>
              <Link href="/?status=active" className="metric-card-link">
                <article>
                  <span>ACTIVE ON THIS PAGE</span>
                  <strong style={{ color: "var(--green)" }}>{activeCount}</strong>
                  <small>Live client environments</small>
                </article>
              </Link>
              <Link href="/?status=suspended" className="metric-card-link">
                <article>
                  <span>NEEDS ATTENTION</span>
                  <strong style={{ color: attentionCount > 0 ? "var(--red)" : "inherit" }}>
                    {attentionCount}
                  </strong>
                  <small>Provisioning or suspended</small>
                </article>
              </Link>
            </div>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">CUSTOMER DIRECTORY</p>
                  <h2>Client Workspaces</h2>
                  <p className="muted">
                    Provision new tenants, search existing workspaces, or manage tenant lifecycle and domain bindings.
                  </p>
                </div>
                <div className="panel-actions">
                  <ReconcileButton />
                  <CreateTenantModal />
                </div>
              </div>

              <form className="filters" action="/" method="get">
                <input
                  name="q"
                  defaultValue={params.q ?? ""}
                  placeholder="Search workspaces by name, slug or ID…"
                  aria-label="Search tenants"
                />
                <select name="status" defaultValue={params.status ?? ""} aria-label="Filter by status">
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="provisioning">Provisioning</option>
                  <option value="suspended">Suspended</option>
                  <option value="closed">Closed</option>
                </select>
                <button type="submit" className="primary">
                  Filter
                </button>
                {(params.q || params.status) && (
                  <Link href="/" className="secondary" style={{ display: "inline-flex", alignItems: "center" }}>
                    Clear
                  </Link>
                )}
              </form>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>WORKSPACE</th>
                      <th>SLUG</th>
                      <th>CURRENCY</th>
                      <th>STATUS</th>
                      <th>CREATED</th>
                      <th style={{ textAlign: "right" }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((tenant) => {
                      const clientUrl = getTenantStorefrontUrl(tenant.slug);
                      const adminUrl = getTenantWorkspacePickerUrl({
                        slug: tenant.slug,
                        authOrganizationId: tenant.auth_organization_id,
                      }, "/admin");

                      return (
                        <tr key={tenant.id}>
                          <td>
                            <strong>{tenant.name}</strong>
                            <small className="mono-id">{tenant.id}</small>
                          </td>
                          <td>
                            <code>{tenant.slug}</code>
                          </td>
                          <td>
                            <span>{tenant.default_currency}</span>
                          </td>
                          <td>
                            <Status value={tenant.status} />
                          </td>
                          <td>
                            <span>{new Date(tenant.created_at).toLocaleDateString("en-KE")}</span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", alignItems: "center" }}>
                              {clientUrl && (
                                <a
                                  href={clientUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="secondary-btn-sm"
                                  title="Open public website in a new tab"
                                >
                                  Site ↗
                                </a>
                              )}
                              {adminUrl && (
                                <a
                                  href={adminUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="secondary-btn-sm"
                                  title="Open tenant administration in a new tab"
                                >
                                  Desk ↗
                                </a>
                              )}
                              <Link className="row-link-primary" href={`/tenants/${tenant.id}`}>
                                Manage →
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td className="empty" colSpan={6}>
                          No client workspaces match this page and filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <span>
                  Showing {page * 25 + (tenants.length ? 1 : 0)}–{page * 25 + tenants.length} of {totalRegistered}
                </span>
                <div>
                  {page > 0 && <Link href={`/?page=${page - 1}`}>← Previous</Link>}{" "}
                  {page * 25 + 25 < totalRegistered && <Link href={`/?page=${page + 1}`}>Next →</Link>}
                </div>
              </div>
            </section>
          </>
        )}

        <footer>
          BAZION WEB PLATFORM <span>Platform operator access is audited and permission-controlled.</span>
        </footer>
      </section>
    </main>
  );
}
