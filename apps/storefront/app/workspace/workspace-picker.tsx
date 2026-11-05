"use client";

import { useState } from "react";
import { authClient } from "@bazion/auth/client";

type CurrentIdentity = {
  user: { id: string; email: string; name: string; emailVerified: boolean };
  organization: { id: string; role: string } | null;
  tenant: { id: string; slug: string; name: string; currency: string; status: string } | null;
  platformRole: "platform_owner" | "platform_admin" | "platform_support" | null;
};

export function WorkspacePicker() {
  const session = authClient.useSession();
  const organizations = authClient.useListOrganizations();
  const activeOrganization = authClient.useActiveOrganization();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [identity, setIdentity] = useState<CurrentIdentity | null>(null);
  const organizationList = organizations.data ?? [];

  async function selectWorkspace(organizationId: string) {
    setBusyId(organizationId);
    setMessage("");
    setIdentity(null);
    try {
      const result = await authClient.organization.setActive({ organizationId });
      if (result.error) throw new Error(result.error.message ?? "Could not switch workspace.");
      const response = await fetch("/v1/auth/me", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("Workspace selected, but the tenant context could not be loaded.");
      setIdentity(await response.json() as CurrentIdentity);
      setMessage("Active workspace updated. Protected API operations will now use this tenant context.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Workspace selection failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function signOut() {
    await authClient.signOut();
    window.location.assign("/login");
  }

  if (session.isPending) {
    return <section className="auth-card"><p>Checking your session…</p></section>;
  }

  if (!session.data) {
    return (
      <section className="auth-card">
        <p className="eyebrow">BAZION WORKSPACE</p>
        <h1>Sign in to continue.</h1>
        <p className="auth-intro">Your client organizations and permissions are available after you sign in.</p>
        <a className="checkout-button" href="/login?callbackURL=%2Fworkspace">Sign in →</a>
      </section>
    );
  }

  return (
    <section className="workspace-panel">
      <div className="workspace-header">
        <div>
          <p className="eyebrow">BAZION WORKSPACE</p>
          <h1>Choose a client workspace.</h1>
          <p className="auth-intro">Signed in as {session.data.user.email}. Your account can belong to more than one client organization.</p>
        </div>
        <button className="auth-toggle" type="button" onClick={signOut}>Sign out</button>
      </div>

      {organizations.isPending ? <p>Loading your organizations…</p> : null}
      {!organizations.isPending && organizationList.length === 0 ? (
        <div className="workspace-empty">
          <strong>No client workspace assigned yet.</strong>
          <p>Ask your Bazion platform administrator to invite this email address to a client organization.</p>
        </div>
      ) : null}

      {organizationList.length > 0 && (
        <div className="workspace-list">
          {organizationList.map((organization) => {
            const active = activeOrganization.data?.id === organization.id;
            return (
              <article className="workspace-item" key={organization.id}>
                <div>
                  <strong>{organization.name}</strong>
                  <small>{organization.slug} · {active ? "Active workspace" : "Available workspace"}</small>
                </div>
                <button
                  className={active ? "workspace-active" : "workspace-select"}
                  type="button"
                  disabled={active || busyId !== null}
                  onClick={() => selectWorkspace(organization.id)}
                >
                  {busyId === organization.id ? "Switching…" : active ? "Active" : "Use workspace"}
                </button>
              </article>
            );
          })}
        </div>
      )}

      {message && <p className="notice" role="status">{message}</p>}
      {identity?.tenant && (
        <div className="workspace-context">
          <p className="eyebrow">VERIFIED TENANT CONTEXT</p>
          <strong>{identity.tenant.name}</strong>
          <p>{identity.tenant.slug} · {identity.tenant.currency} · {identity.organization?.role}</p>
          <small>Tenant UUID: {identity.tenant.id}</small>
        </div>
      )}
      {identity?.platformRole && <p className="workspace-platform-role">Platform access: {identity.platformRole}</p>}
    </section>
  );
}
