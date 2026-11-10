"use client";

import { useEffect, useState } from "react";
import { authClient } from "@bazion/auth/client";
import Link from "next/link";
import { apiErrorMessage } from "../../lib/api-error";

type Tenant = {
  id: string;
  slug: string;
  name: string;
  status: "provisioning" | "active" | "suspended" | "closed";
  auth_workspace_linked?: boolean;
};

type TenantList = { items: Tenant[]; total: number };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const result = await response.json().catch(() => null) as unknown;
  if (!response.ok) throw new Error(apiErrorMessage(result, response.status));
  return result as T;
}

export function PlatformConsole({ currentUserEmail }: { currentUserEmail: string }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [busyTenant, setBusyTenant] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const pageSize = 100;
        const firstPage = await api<TenantList>(`/v1/admin/platform/tenants?limit=${pageSize}&offset=0`);
        const items = [...firstPage.items];
        const pageCount = Math.ceil(Math.min(firstPage.total, 100_100) / pageSize);
        for (let start = 1; start < pageCount; start += 10) {
          const offsets = Array.from(
            { length: Math.min(10, pageCount - start) },
            (_, index) => (start + index) * pageSize,
          );
          const pages = await Promise.all(offsets.map((offset) =>
            api<TenantList>(`/v1/admin/platform/tenants?limit=${pageSize}&offset=${offset}`),
          ));
          items.push(...pages.flatMap((page) => page.items));
          if (pages.some((page) => page.items.length === 0)) break;
        }
        if (!cancelled) setTenants(items);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load tenants.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function assignAdmin(event: React.FormEvent<HTMLFormElement>, tenant: Tenant) {
    event.preventDefault();
    const email = emails[tenant.id]?.trim();
    if (!email) return;
    setBusyTenant(tenant.id);
    setMessage("");
    setError("");
    try {
      const result = await api<{ assignment: { email: string; role: string; organizationId: string } }>(
        `/v1/admin/platform/tenants/${encodeURIComponent(tenant.id)}/initial-admin`,
        { method: "POST", body: JSON.stringify({ email }) },
      );
      const workspaceSetupMessage = tenant.auth_workspace_linked === false
        ? ` The ${tenant.name} admin workspace was also set up automatically.`
        : "";
      setMessage(`${result.assignment.email} now has administrator access to ${tenant.name}. They can sign in and choose this workspace.${workspaceSetupMessage}`);
      setEmails((current) => ({ ...current, [tenant.id]: "" }));
      setTenants((current) => current.map((item) => item.id === tenant.id
        ? { ...item, auth_workspace_linked: true }
        : item));
      if (result.assignment.email.toLowerCase() === currentUserEmail.toLowerCase()) {
        const activeResult = await authClient.organization.setActive({ organizationId: result.assignment.organizationId });
        if (activeResult.error) {
          setMessage(`${result.assignment.email} now has administrator access to ${tenant.name}.${workspaceSetupMessage}`);
          setError("Access was granted, but this browser could not switch into the tenant. Open the workspace picker and choose the tenant.");
          return;
        }
        window.location.assign("/admin");
        return;
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not assign tenant administrator access.");
    } finally {
      setBusyTenant(null);
    }
  }

  return (
    <main className="platform-console">
      <div className="platform-console-inner">
        <header className="platform-console-header">
          <span className="platform-console-brand">BAZION WEB</span>
          <span className="platform-console-boundary">PLATFORM CONTROL PLANE</span>
          <span className="platform-console-role">Platform owner</span>
          <Link className="platform-console-workspaces" href="/workspace">My tenant workspaces</Link>
        </header>

        <section className="platform-console-hero">
          <p className="platform-console-eyebrow">BAZION WEB · PLATFORM ADMINISTRATION</p>
          <h1>Tenant control center</h1>
          <p>Manage organizations and tenant administrator access across Bazion Web. Each tenant’s website and ministry content are managed from its own dashboard.</p>
        </section>

        <section className="platform-console-section" aria-labelledby="platform-tenant-access-heading">
          <div className="platform-console-section-heading">
            <div><p className="platform-console-eyebrow">TENANT LIFECYCLE</p><h2 id="platform-tenant-access-heading">Tenant access</h2></div>
            <p>Invite an administrator to one active tenant. Their access stays scoped to that tenant.</p>
          </div>
          {loading && <p className="platform-console-notice" role="status">Loading tenant list…</p>}
          {error && <p className="platform-console-error" role="alert">{error}</p>}
          {message && <p className="platform-console-success" role="status">{message}</p>}
          {!loading && !error && tenants.length > 0 && <p className="platform-console-count">{tenants.length} tenant{tenants.length === 1 ? "" : "s"} in the platform</p>}
          {!loading && !tenants.length && !error && <p className="platform-console-notice">No tenants are available.</p>}
        </section>

        <div className="platform-tenant-list">
          {tenants.map((tenant) => (
            <article className="platform-tenant-card" key={tenant.id}>
              <div className="platform-tenant-card-heading">
                <div><h3>{tenant.name}</h3><span>{tenant.slug}</span></div>
                <div className="platform-tenant-badges">
                  <span className={`platform-tenant-status ${tenant.status}`}>{tenant.status}</span>
                  {tenant.status === "active" && tenant.auth_workspace_linked === false && (
                    <span className="platform-tenant-setup">Admin setup needed</span>
                  )}
                </div>
              </div>
              <form onSubmit={(event) => void assignAdmin(event, tenant)} className="platform-tenant-admin-form">
                <label htmlFor={`admin-email-${tenant.id}`}>Verified Bazion email for {tenant.name}</label>
                <input
                  id={`admin-email-${tenant.id}`}
                  type="email"
                  autoComplete="email"
                  required
                  disabled={tenant.status !== "active" || busyTenant !== null}
                  placeholder="verified.account@example.com"
                  value={emails[tenant.id] ?? ""}
                  onChange={(event) => setEmails((current) => ({ ...current, [tenant.id]: event.target.value }))}
                />
                <button type="submit" disabled={tenant.status !== "active" || busyTenant !== null}>
                  {busyTenant === tenant.id ? "Setting up access…" : tenant.auth_workspace_linked === false ? "Set up and grant admin" : "Grant tenant admin"}
                </button>
              </form>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
