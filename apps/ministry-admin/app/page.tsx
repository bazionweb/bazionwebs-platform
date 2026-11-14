"use client";

import Link from "next/link";
import { PulseActivityButton } from "@bazion/ui";
import { authClient } from "@bazion/auth/client";
import { MinistryAdminDashboard } from "./ministry-admin";

export default function MinistryAdminPage() {
  const activeOrganization = authClient.useActiveOrganization();
  const tenantName = activeOrganization.data?.name ?? "Ministry";

  return (
    <main className="tenant-admin-shell">
      <header className="tenant-admin-header">
        <Link className="tenant-admin-brand" href="/" aria-label={`${tenantName} ministry administration`}>
          <span className="tenant-admin-brand-name">BAZION WEB</span>
          <span className="tenant-admin-context">
            <strong>{tenantName}</strong>
            <small>MINISTRY OPERATIONS CONSOLE</small>
          </span>
        </Link>

        <nav className="tenant-admin-actions" aria-label="Ministry administration links">
          <PulseActivityButton label="Activity" />
          <a className="tenant-admin-public-link" href={process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3000"} target="_blank" rel="noreferrer">
            View {tenantName} public website <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>

      <div className="tenant-admin-content">
        <MinistryAdminDashboard />
      </div>
    </main>
  );
}

