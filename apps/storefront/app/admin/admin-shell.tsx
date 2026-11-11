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
  const [showGuide, setShowGuide] = useState(false);
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

        <div className="tenant-admin-guide-card">
          <button
            type="button"
            className="tenant-admin-guide-header"
            onClick={() => setShowGuide((prev) => !prev)}
            aria-expanded={showGuide}
          >
            <h3>
              <span aria-hidden="true">💡</span> Novice Admin Quick-Start Guide &amp; Best Practices
            </h3>
            <span className="tenant-admin-guide-toggle">
              {showGuide ? "Hide tips ▲" : "View quick guide ▼"}
            </span>
          </button>
          {showGuide && (
            <div className="tenant-admin-guide-grid">
              <div className="tenant-admin-guide-step">
                <strong>1. Profile &amp; Branding</strong>
                <small>Go to <em>Website settings</em> to set your church name, upload your high-resolution logo, choose an accessible color palette, and configure social media links.</small>
              </div>
              <div className="tenant-admin-guide-step">
                <strong>2. Gathering Info</strong>
                <small>Add your Sunday service times and campus addresses. Use the "+ Insert sample" buttons to easily format your rows with zero errors.</small>
              </div>
              <div className="tenant-admin-guide-step">
                <strong>3. Content &amp; Media</strong>
                <small>Publish audio/video teachings in <em>Sermons</em> and upcoming conferences or prayer meetings in <em>Events</em>. You can paste any YouTube link directly.</small>
              </div>
              <div className="tenant-admin-guide-step">
                <strong>4. Community &amp; Team</strong>
                <small>Switch to <em>Team &amp; access</em> to invite co-workers, and review incoming enquiries, prayer requests, and event signups from the sidebar.</small>
              </div>
            </div>
          )}
        </div>

        {view === "ministry" ? <MinistryAdminDashboard /> : <AdminDashboard />}
      </div>

      <footer className="tenant-admin-footer">{tenantName} tenant workspace · Powered by Bazion Web</footer>
    </main>
  );
}
