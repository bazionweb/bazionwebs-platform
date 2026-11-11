import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminTopbar } from "@/components/admin-topbar";
import { TroubleshootingPanel } from "@/components/troubleshooting-panel";
import { platformFetch, requirePlatformOwner, type Tenant } from "@/lib/platform";

type TenantList = { items: Tenant[]; total: number; limit: number; offset: number };

export default async function TroubleshootingPage({
  searchParams,
}: {
  searchParams?: Promise<{ tenantId?: string }>;
}) {
  const identity = await requirePlatformOwner().catch(() => null);
  const result = await platformFetch<TenantList>("tenants?limit=100");
  const tenants = result.data?.items ?? [];
  const params = await searchParams;

  return (
    <main className="frame">
      <AdminSidebar
        userEmail={identity?.user.email}
        userName={identity?.user.name}
        platformRole={identity?.platformRole ?? undefined}
      />

      <section className="content">
        <AdminTopbar
          title="Platform / Troubleshooting & Diagnostics"
          userEmail={identity?.user.email}
          platformRole={identity?.platformRole ?? undefined}
        />

        <div className="page-head">
          <div>
            <p className="eyebrow">CONTROL PLANE RECOVERY & DIAGNOSTIC TOOLING</p>
            <h1>Platform Troubleshooting Hub</h1>
            <p className="muted">
              Diagnose, triage, and remediate customer issues across notifications, Daraja payments, custom domain DNS, user account lockouts, and workspace state.
            </p>
          </div>
          <span className="live-tag">● DIAGNOSTIC ENGINE READY</span>
        </div>

        <TroubleshootingPanel
          initialTenants={tenants}
          defaultTenantId={params?.tenantId}
        />

        <footer>
          BAZION WEB PLATFORM <span>Superadmin Diagnostics, Audit & Recovery Console.</span>
        </footer>
      </section>
    </main>
  );
}
