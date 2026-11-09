"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authClient } from "@bazion/auth/client";
import { AdminDashboard } from "./admin-dashboard";
import { MinistryAdminDashboard } from "./ministry-admin";

type AdminShellProps = {
  tenantName: string;
  isPlatformOwner: boolean;
  notice?: string;
};

export function AdminShell({ tenantName, isPlatformOwner, notice }: AdminShellProps) {
  const [view, setView] = useState<"ministry" | "team">("ministry");
  const [commerceEnabled, setCommerceEnabled] = useState(false);
  const organizations = authClient.useListOrganizations();
  const canSwitchTenant = (organizations.data?.length ?? 0) > 1;

  useEffect(() => {
    let active = true;
    void fetch("/v1/admin/tenant/modules", { credentials: "include", cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as { modules?: Array<{ id: string; enabled: boolean }> } : null)
      .then((result) => {
        if (active) setCommerceEnabled(result?.modules?.some((module) => module.id === "commerce" && module.enabled) ?? false);
      })
      .catch(() => { if (active) setCommerceEnabled(false); });
    return () => { active = false; };
  }, []);

  return (
    <main className="tenant-admin-shell">
      <header className="tenant-admin-header">
        <Link className="tenant-admin-brand" href="/admin" aria-label={`${tenantName} tenant administration`}>
          <span className="tenant-admin-brand-name">BAZION WEB</span>
          <span className="tenant-admin-context"><strong>{tenantName}</strong><small>TENANT ADMIN</small></span>
        </Link>

        <nav className="tenant-admin-actions" aria-label="Tenant administration links">
          {canSwitchTenant && <Link className="tenant-admin-link" href="/workspace">Switch assigned tenant</Link>}
          {commerceEnabled && <Link className="tenant-admin-link" href="/admin/commerce">Commerce admin</Link>}
          {isPlatformOwner && <Link className="tenant-admin-platform-link" href="/platform">Platform console</Link>}
          <Link className="tenant-admin-public-link" href="/" target="_blank" rel="noreferrer">View {tenantName} website <span aria-hidden="true">↗</span></Link>
        </nav>
      </header>

      <div className="tenant-admin-nav-wrap">
        <nav className="tenant-admin-section-nav" aria-label="Tenant admin sections">
          <button type="button" aria-pressed={view === "ministry"} onClick={() => setView("ministry")}>Ministry operations</button>
          <button type="button" aria-pressed={view === "team"} onClick={() => setView("team")}>Team &amp; access <small>This tenant only</small></button>
        </nav>
      </div>

      <div className="tenant-admin-content">
        {notice && <p className="tenant-admin-notice" role="status">{notice}</p>}
        {view === "ministry" ? <MinistryAdminDashboard /> : <AdminDashboard />}
      </div>

      <footer className="tenant-admin-footer">{tenantName} tenant workspace · Powered by Bazion Web</footer>
    </main>
  );
}
