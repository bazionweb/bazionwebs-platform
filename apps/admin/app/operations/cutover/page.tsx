import Link from "next/link";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminTopbar } from "@/components/admin-topbar";
import {
  CutoverSloPanel,
  type CrossEntityReconciliationReport,
  type CutoverReadinessReport,
  type ProvisioningSloSnapshot,
} from "@/components/cutover-slo-panel";
import { platformFetch, requirePlatformOwner } from "@/lib/platform";

export default async function CutoverAndSloPage() {
  const identity = await requirePlatformOwner().catch(() => null);
  const [sloRes, reconRes, cutoverRes] = await Promise.all([
    platformFetch<ProvisioningSloSnapshot>("commercial-provisioning/slo-alerts"),
    platformFetch<CrossEntityReconciliationReport>("commercial-provisioning/reconciliation-exceptions"),
    platformFetch<CutoverReadinessReport>("commercial-provisioning/cutover-readiness"),
  ]);

  const initialErrorStatus = [sloRes.status, reconRes.status, cutoverRes.status].find((s) => s >= 500) ?? null;

  return (
    <main className="frame">
      <AdminSidebar
        userEmail={identity?.user.email}
        userName={identity?.user.name}
        platformRole={identity?.platformRole ?? undefined}
      />

      <section className="content">
        <AdminTopbar
          title="Platform / SLOs & Cutover"
          userEmail={identity?.user.email}
          platformRole={identity?.platformRole ?? undefined}
        />

        <div className="page-head">
          <div>
            <p className="eyebrow">PHASE 7 OPERATIONS &amp; CUTOVER GOVERNANCE</p>
            <h1>SLOs, Cross-Entity Reconciliation &amp; Cutover Gates</h1>
            <p className="muted">
              Monitor live provisioning SLOs, five-way reconciliation drift with owner routing, and verified pilot/canary/legacy-removal gates.
            </p>
          </div>
          <Link className="secondary" href="/operations" style={{ padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}>
            ← Saga Journal
          </Link>
        </div>

        <CutoverSloPanel
          initialSlo={sloRes.data}
          initialReconciliation={reconRes.data}
          initialCutover={cutoverRes.data}
          initialErrorStatus={initialErrorStatus}
          platformRole={identity?.platformRole ?? null}
        />

        <footer>
          BAZION WEB PLATFORM <span>Commercial provisioning SLOs, five-way reconciliation &amp; cutover readiness.</span>
        </footer>
      </section>
    </main>
  );
}
