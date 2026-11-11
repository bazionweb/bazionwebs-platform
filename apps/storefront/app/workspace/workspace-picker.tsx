"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authClient, resolveSafeRedirectTarget } from "@bazion/auth/client";
import { AccountIdentityPanels } from "./account-identity-panels";

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
  const [accessNotice, setAccessNotice] = useState("");
  const [identity, setIdentity] = useState<CurrentIdentity | null>(null);
  const [identityLoading, setIdentityLoading] = useState(false);
  const [identityError, setIdentityError] = useState("");
  const autoRedirectStarted = useRef(false);
  const organizationList = organizations.data ?? [];

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("reason");
    if (reason === "platform-owner-required") {
      setAccessNotice("Only the Bazion platform owner can open the cross-tenant console. Sign out and sign in with the platform owner account to assign this email to a tenant.");
    } else if (reason === "tenant-access-required") {
      setAccessNotice("This account needs an active tenant workspace before it can open the admin dashboard. Ask the platform owner to assign this email to the correct tenant.");
    }
  }, []);

  useEffect(() => {
    if (!session.data) return;
    let cancelled = false;
    setIdentityLoading(true);
    setIdentityError("");
    void fetch("/v1/auth/me", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load your account access.");
        return await response.json() as CurrentIdentity;
      })
      .then((currentIdentity) => { if (!cancelled) setIdentity(currentIdentity); })
      .catch((error: unknown) => {
        if (cancelled) return;
        setIdentity(null);
        setIdentityError(error instanceof Error ? error.message : "Could not load your account access.");
      })
      .finally(() => { if (!cancelled) setIdentityLoading(false); });
    return () => { cancelled = true; };
  }, [session.data?.user.id]);

  const selectWorkspace = useCallback(async (organizationId: string) => {
    setBusyId(organizationId);
    setMessage("");
    setIdentity(null);
    try {
      const result = await authClient.organization.setActive({ organizationId });
      if (result.error) throw new Error(result.error.message ?? "Could not switch workspace.");
      const response = await fetch("/v1/auth/me", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("Workspace selected, but the tenant context could not be loaded.");
      const currentIdentity = await response.json() as CurrentIdentity;
      if (currentIdentity.organization?.id !== organizationId || currentIdentity.tenant?.status !== "active") {
        throw new Error("This organization is not linked to an active tenant. Contact Bazion support.");
      }
      if (currentIdentity.tenant?.slug) {
        document.cookie = `bazion_tenant=${encodeURIComponent(currentIdentity.tenant.slug)}; path=/; samesite=lax`;
      }
      setIdentity(currentIdentity);
      const redirectTarget = resolveSafeRedirectTarget(
        new URLSearchParams(window.location.search).get("redirect"),
        { allowedOrigins: [window.location.origin], fallback: "/admin" },
      );
      window.location.assign(redirectTarget);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Workspace selection failed.");
    } finally {
      setBusyId(null);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const selectId = params.get("select");
    const selectSlug = params.get("workspace");
    if (!selectId && !selectSlug) return;
    if (organizations.isPending || organizationList.length === 0 || busyId) return;

    const targetOrg = organizationList.find(
      (org) => (selectId && org.id === selectId) || (selectSlug && org.slug === selectSlug)
    );
    if (!targetOrg) return;

    if (activeOrganization.data?.id === targetOrg.id && identity?.tenant?.status === "active") {
      const redirectTarget = resolveSafeRedirectTarget(
        params.get("redirect"),
        { allowedOrigins: [window.location.origin], fallback: "/admin" },
      );
      window.location.assign(redirectTarget);
      return;
    }

    void selectWorkspace(targetOrg.id);
  }, [organizations.isPending, organizationList, activeOrganization.data?.id, identity, busyId, selectWorkspace]);

  useEffect(() => {
    if (!session.data || !identity || identity.platformRole === "platform_owner" || organizations.isPending || organizationList.length !== 1 || autoRedirectStarted.current) return;
    autoRedirectStarted.current = true;
    const onlyOrganization = organizationList[0];
    if (!onlyOrganization) return;
    if (identity.organization?.id !== onlyOrganization.id || identity.tenant?.status !== "active") {
      setMessage("This organization is not linked to an active tenant. Contact Bazion support.");
      return;
    }
    if (activeOrganization.data?.id === onlyOrganization.id) {
      window.location.replace("/admin");
      return;
    }
    void selectWorkspace(onlyOrganization.id);
  }, [session.data?.user.id, identity, organizations.isPending, organizationList.length, activeOrganization.data?.id, selectWorkspace]);

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
          <p className="eyebrow">{identity?.platformRole === "platform_owner" ? "BAZION WEB · PLATFORM OWNER" : "BAZION WORKSPACE"}</p>
          <h1>{identity?.platformRole === "platform_owner" ? "Choose an administration area." : "Choose a client workspace."}</h1>
          <p className="auth-intro">Signed in as {session.data.user.email}. {identity?.platformRole === "platform_owner"
            ? "Platform-wide controls and tenant workspaces are separate. Choose the platform console or one of your assigned tenant workspaces."
            : "Your account can belong to more than one client organization."}</p>
        </div>
        <button className="auth-toggle" type="button" onClick={signOut}>Sign out</button>
      </div>

      {accessNotice && <p className="notice" role="status">{accessNotice}</p>}

      {identity?.platformRole === "platform_owner" && <div className="workspace-platform-card">
        <div><p className="eyebrow">PLATFORM CONTROL PLANE</p><strong>Bazion Web platform administration</strong><p>Manage all tenants and their administrator assignments.</p></div>
        <a href="/platform">Open platform console →</a>
      </div>}

      {organizations.isPending ? <p>Loading your organizations…</p> : null}
      {identityLoading && <p role="status">Checking your tenant access…</p>}
      {identityError && <p className="notice" role="alert">{identityError} Refresh the page or contact Bazion support.</p>}
      {!organizations.isPending && !identityLoading && !identityError && organizationList.length === 0 ? (
        <div className="workspace-empty">
          <strong>No client workspace assigned yet.</strong>
          <p>{identity?.platformRole === "platform_owner"
            ? "Manage tenant administrators from the platform console, or ask a platform owner to assign you to a tenant workspace."
            : "Ask the tenant owner or your Bazion platform administrator to assign this email to a client organization."}</p>
        </div>
      ) : null}

      {organizationList.length > 0 && (
        <div className="workspace-tenant-area">
          {identity?.platformRole === "platform_owner" && <div className="workspace-tenant-heading"><div><p className="eyebrow">TENANT ADMINISTRATION</p><h2>Your assigned tenant workspaces</h2></div><p>Only tenants assigned to your account are listed here.</p></div>}
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
        </div>
      )}

      {message && <p className="notice" role="status">{message}</p>}
      {identity?.tenant?.status === "active" && identity.organization?.id === activeOrganization.data?.id && (
        <a className="workspace-admin-link" href="/admin">{identity.platformRole === "platform_owner" ? "Open tenant admin workspace →" : "Open tenant administration →"}</a>
      )}
      <AccountIdentityPanels
        currentEmail={session.data.user.email}
        emailVerified={Boolean(identity?.user.emailVerified ?? session.data.user.emailVerified)}
        onOrderClaimed={() => {
          void organizations.refetch();
        }}
      />
    </section>
  );
}
