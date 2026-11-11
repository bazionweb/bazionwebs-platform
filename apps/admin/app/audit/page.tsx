import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminTopbar } from "@/components/admin-topbar";
import { AuditPanel } from "@/components/audit-panel";
import { platformFetch, requirePlatformOwner, type Tenant } from "@/lib/platform";

type TenantList = { items: Tenant[]; total: number; limit: number; offset: number };

export default async function AuditPage() {
  const identity = await requirePlatformOwner().catch(() => null);
  const result = await platformFetch<TenantList>("tenants?limit=100");
  const tenants = result.data?.items ?? [];

  return (
    <main className="frame">
      <AdminSidebar
        userEmail={identity?.user.email}
        userName={identity?.user.name}
        platformRole={identity?.platformRole ?? undefined}
      />

      <section className="content">
        <AdminTopbar
          title="Platform / Security & Audit Trail"
          userEmail={identity?.user.email}
          platformRole={identity?.platformRole ?? undefined}
        />

        <div className="page-head">
          <div>
            <p className="eyebrow">CONTROL PLANE SECURITY</p>
            <h1>Global Audit Trail & Security Logs</h1>
            <p className="muted">
              Complete, immutable chronological log of administrative operations, troubleshooting overrides, lifecycle changes, and financial reconciliations.
            </p>
          </div>
          <span className="live-tag">● AUDIT SYSTEM ACTIVE</span>
        </div>

        <AuditPanel tenants={tenants} />

        <footer>
          BAZION WEB PLATFORM <span>Append-only security audit events.</span>
        </footer>
      </section>
    </main>
  );
}
