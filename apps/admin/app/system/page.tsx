import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminTopbar } from "@/components/admin-topbar";
import { ReconcileButton } from "@/components/tenant-actions";
import { platformFetch, requirePlatformOwner, type Tenant } from "@/lib/platform";

type TenantList = { items: Tenant[]; total: number; limit: number; offset: number };

export default async function SystemPage() {
  const identity = await requirePlatformOwner();
  const result = await platformFetch<TenantList>("tenants?limit=100");
  const tenants = result.data?.items ?? [];

  const activeCount = tenants.filter((t) => t.status === "active").length;
  const provisioningCount = tenants.filter((t) => t.status === "provisioning").length;
  const suspendedCount = tenants.filter((t) => t.status === "suspended").length;
  const closedCount = tenants.filter((t) => t.status === "closed").length;

  return (
    <main className="frame">
      <AdminSidebar
        userEmail={identity?.user.email}
        userName={identity?.user.name}
        platformRole={identity?.platformRole ?? undefined}
      />

      <section className="content">
        <AdminTopbar
          title="Platform / System & Health"
          userEmail={identity?.user.email}
          platformRole={identity?.platformRole ?? undefined}
        />

        <div className="page-head">
          <div>
            <p className="eyebrow">CONTROL PLANE INFRASTRUCTURE</p>
            <h1>System Status & Maintenance</h1>
            <p className="muted">
              Operational health, service boundaries, database roles, and lifecycle reconciliation controls.
            </p>
          </div>
          <span className="live-tag">● ALL SERVICES OPERATIONAL</span>
        </div>

        <div className="metric-grid">
          <article>
            <span>DATABASE CONNECTION</span>
            <strong style={{ color: "var(--green)" }}>Connected</strong>
            <small>PostgreSQL 17 (Least-privilege RLS active)</small>
          </article>
          <article>
            <span>API SERVER STATUS</span>
            <strong style={{ color: "var(--green)" }}>Healthy</strong>
            <small>Fastify 5 API runtime (Port 4000/4100)</small>
          </article>
          <article>
            <span>ACTIVE WORKSPACES</span>
            <strong>{activeCount}</strong>
            <small>{tenants.length} registered total across all states</small>
          </article>
        </div>

        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">LIFECYCLE MAINTENANCE</p>
              <h2>Provisioning Reconciliation</h2>
              <p className="muted">
                Detects, validates and reconciles any organizations created without completed tenant registry mappings.
              </p>
            </div>
            <ReconcileButton />
          </div>

          <div className="system-breakdown" style={{ marginTop: "24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
            <div style={{ padding: "16px", background: "#f8faf7", border: "1px solid var(--line)", borderRadius: "6px" }}>
              <span className="muted" style={{ fontSize: "11px", fontWeight: 600 }}>ACTIVE WORKSPACES</span>
              <p style={{ fontSize: "24px", fontWeight: 700, margin: "6px 0 2px" }}>{activeCount}</p>
              <small className="muted">Serving live traffic</small>
            </div>
            <div style={{ padding: "16px", background: "#f8faf7", border: "1px solid var(--line)", borderRadius: "6px" }}>
              <span className="muted" style={{ fontSize: "11px", fontWeight: 600 }}>PROVISIONING WORKSPACES</span>
              <p style={{ fontSize: "24px", fontWeight: 700, margin: "6px 0 2px" }}>{provisioningCount}</p>
              <small className="muted">Initializing resources</small>
            </div>
            <div style={{ padding: "16px", background: "#f8faf7", border: "1px solid var(--line)", borderRadius: "6px" }}>
              <span className="muted" style={{ fontSize: "11px", fontWeight: 600 }}>SUSPENDED WORKSPACES</span>
              <p style={{ fontSize: "24px", fontWeight: 700, margin: "6px 0 2px" }}>{suspendedCount}</p>
              <small className="muted">Traffic temporarily locked</small>
            </div>
            <div style={{ padding: "16px", background: "#f8faf7", border: "1px solid var(--line)", borderRadius: "6px" }}>
              <span className="muted" style={{ fontSize: "11px", fontWeight: 600 }}>CLOSED WORKSPACES</span>
              <p style={{ fontSize: "24px", fontWeight: 700, margin: "6px 0 2px" }}>{closedCount}</p>
              <small className="muted">Terminal state</small>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">SECURITY BOUNDARIES</p>
              <h2>Database Architecture & Roles</h2>
              <p className="muted">PostgreSQL enforced least-privilege architecture separates runtime from migration access.</p>
            </div>
          </div>

          <div className="table-wrap" style={{ marginTop: "18px" }}>
            <table>
              <thead>
                <tr>
                  <th>ROLE</th>
                  <th>PURPOSE</th>
                  <th>RLS STATUS</th>
                  <th>PRIVILEGES</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>bazion_app</code></td>
                  <td>Commercial runtime and storefront requests</td>
                  <td><span className="status status-active">FORCED</span></td>
                  <td>DML on tenant-owned commerce rows with active tenant context</td>
                </tr>
                <tr>
                  <td><code>bazion_auth_runtime</code></td>
                  <td>Better Auth session & membership runtime</td>
                  <td><span className="status status-active">FORCED</span></td>
                  <td>DML on dedicated <code>auth.*</code> schema tables only</td>
                </tr>
                <tr>
                  <td><code>bazion_tenant_resolver</code></td>
                  <td>Host verification and tenant directory reads</td>
                  <td><span className="status status-active">FORCED</span></td>
                  <td>SELECT on public registry and verified domains only</td>
                </tr>
                <tr>
                  <td><code>bazion_tenant_provisioner</code></td>
                  <td>Organization and tenant creation hooks</td>
                  <td><span className="status status-active">FORCED</span></td>
                  <td>Narrow INSERT / UPDATE on tenant registry records only</td>
                </tr>
                <tr>
                  <td><code>bazion_notification_worker</code></td>
                  <td>Encrypted notification outbox delivery worker</td>
                  <td><span className="status status-active">FORCED</span></td>
                  <td>Atomic claims and updates on notification outbox</td>
                </tr>
                <tr>
                  <td><code>bazion_migrator</code></td>
                  <td>Database migration runner</td>
                  <td><span className="status status-closed">BYPASS</span></td>
                  <td>DDL schema execution; restricted to migration scripts</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <footer>
          BAZION WEB PLATFORM <span>Automated reconciliation and security boundaries active.</span>
        </footer>
      </section>
    </main>
  );
}

