import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminTopbar } from "@/components/admin-topbar";
import {
  ProvisioningOperationsPanel,
  type OperationSummaryItem,
} from "@/components/provisioning-operations-panel";
import { platformFetch, requirePlatformOwner } from "@/lib/platform";

export default async function ProvisioningOperationsPage() {
  const identity = await requirePlatformOwner();
  const opsRes = await platformFetch<{ items: OperationSummaryItem[] }>(
    "commercial-provisioning/operations?limit=50",
  );

  return (
    <main className="frame">
      <AdminSidebar
        userEmail={identity.user.email}
        userName={identity.user.name}
        platformRole={identity.platformRole ?? undefined}
      />

      <section className="content">
        <AdminTopbar
          title="Platform / Provisioning Sagas"
          userEmail={identity.user.email}
          platformRole={identity.platformRole ?? undefined}
        />

        <div className="page-head">
          <div>
            <p className="eyebrow">COMMERCIAL CONTROL PLANE</p>
            <h1>Provisioning Sagas &amp; Lifecycle Operations</h1>
            <p className="muted">
              Inspect fenced multi-step provisioning execution, external state inspection attempts, and audited operator recovery actions.
            </p>
          </div>
          <span className="live-tag">DURABLE SAGA JOURNAL</span>
        </div>

        <ProvisioningOperationsPanel
          initialItems={opsRes.data?.items ?? []}
          initialStatus={opsRes.status}
          platformRole={identity?.platformRole ?? null}
        />

        <footer>
          BAZION WEB PLATFORM <span>Commercial provisioning saga inspection &amp; audited operator controls.</span>
        </footer>
      </section>
    </main>
  );
}

