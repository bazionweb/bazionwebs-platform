import Link from "next/link";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminTopbar } from "@/components/admin-topbar";
import { platformFetch, requirePlatformOwner } from "@/lib/platform";

export type PlatformModule = {
  id: string;
  name: string;
  version: string;
  status: "planned" | "experimental" | "partial" | "stable" | "deprecated";
  tenantModel: "tenant-owned" | "platform-owned" | "mixed" | "not-applicable";
  dependencies: string[];
  description: string;
  defaultEnabled: boolean;
  required: boolean;
  tenantAssignable: boolean;
};

export default async function ModulesPage() {
  const identity = await requirePlatformOwner();
  const result = await platformFetch<{ modules: PlatformModule[] }>("modules");
  const modules = result.data?.modules ?? [];

  const stableCount = modules.filter((m) => m.status === "stable").length;
  const partialCount = modules.filter((m) => m.status === "partial").length;
  const plannedCount = modules.filter((m) => m.status === "planned").length;

  return (
    <main className="frame">
      <AdminSidebar
        userEmail={identity?.user.email}
        userName={identity?.user.name}
        platformRole={identity?.platformRole ?? undefined}
      />

      <section className="content">
        <AdminTopbar
          title="Platform / Modules Catalogue"
          userEmail={identity?.user.email}
          platformRole={identity?.platformRole ?? undefined}
        />

        <div className="page-head">
          <div>
            <p className="eyebrow">RUNTIME ARCHITECTURE & CAPABILITIES</p>
            <h1>Platform Modules Catalogue</h1>
            <p className="muted">
              Declared capabilities, solution packs, and tenant-level entitlement surfaces across the platform.
            </p>
          </div>
          <span className="live-tag">● {modules.length} REGISTERED</span>
        </div>

        <div className="metric-grid">
          <article>
            <span>ACTIVE & PARTIAL</span>
            <strong>{partialCount + stableCount}</strong>
            <small>{stableCount} stable · {partialCount} partial/runtime ready</small>
          </article>
          <article>
            <span>PLANNED / ROADMAP</span>
            <strong>{plannedCount}</strong>
            <small>Solution pack & roadmap capabilities</small>
          </article>
          <article>
            <span>TENANT ASSIGNABLE</span>
            <strong>{modules.filter((m) => m.tenantAssignable).length}</strong>
            <small>Can be toggled per client workspace</small>
          </article>
        </div>

        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">MODULE INVENTORY</p>
              <h2>Core Modules & Domains</h2>
              <p className="muted">Modules govern data schema, route permissions, and domain operations.</p>
            </div>
            <span className="count">{modules.length} TOTAL</span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>MODULE</th>
                  <th>ID</th>
                  <th>STATUS</th>
                  <th>TENANT MODEL</th>
                  <th>DEFAULT</th>
                  <th>DEPENDENCIES</th>
                </tr>
              </thead>
              <tbody>
                {modules.map((mod) => (
                  <tr key={mod.id}>
                    <td>
                      <strong>{mod.name}</strong>
                      <small>{mod.description}</small>
                    </td>
                    <td>
                      <code>{mod.id}</code>
                      <small>v{mod.version}</small>
                    </td>
                    <td>
                      <span className={`status status-${mod.status === "stable" || mod.status === "partial" ? "active" : mod.status === "planned" ? "closed" : "provisioning"}`}>
                        {mod.status}
                      </span>
                    </td>
                    <td>
                      <span>{mod.tenantModel}</span>
                      <small>{mod.tenantAssignable ? "Per-tenant switchable" : "Platform fixed"}</small>
                    </td>
                    <td>
                      <span>{mod.defaultEnabled ? "Enabled" : "Disabled"}</span>
                      {mod.required && <small style={{ color: "var(--green)", fontWeight: 600 }}>Required</small>}
                    </td>
                    <td>
                      {mod.dependencies.length > 0 ? (
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                          {mod.dependencies.map((dep) => (
                            <code key={dep} style={{ fontSize: "10px", padding: "2px 5px", background: "#f0f2ee", borderRadius: "3px" }}>
                              {dep}
                            </code>
                          ))}
                        </div>
                      ) : (
                        <small className="muted">None</small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer>
          BAZION WEB PLATFORM <span>Modular platform architecture. Module manifests dictate capability mapping.</span>
        </footer>
      </section>
    </main>
  );
}

