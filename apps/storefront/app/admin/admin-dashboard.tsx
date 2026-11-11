"use client";

import { useEffect, useState } from "react";
import { authClient } from "@bazion/auth/client";

type Overview = {
  tenant: { id: string; slug: string; name: string; currency: string };
  organization: { id: string; roles: string[] };
  user: { id: string; name: string; email: string };
  metrics: { products: number; activeProducts: number; orders: number; pendingOrders: number; paidOrders: number };
};

type Member = {
  id: string;
  role: string;
  createdAt: string;
  user: { id: string; name: string; email: string; image?: string | null };
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
};

type MemberResponse = { members: Member[]; total: number };

const roles = [
  ["admin", "Administrator", "Full management of website settings, content, team, orders, and donations."],
  ["contentEditor", "Content editor", "Can create, update, and publish sermons, events, giving campaigns, and site pages."],
  ["catalogManager", "Catalog manager", "Can create products, set prices, and manage stock on hand in the store."],
  ["orderManager", "Order manager", "Can view incoming orders and mark items as fulfilled."],
  ["viewer", "Viewer", "Read-only access to view records, metrics, and donor summaries without edit rights."],
  ["member", "Basic member", "Standard workspace membership."],
] as const;

type AssignableRole = (typeof roles)[number][0];

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const result = await response.json().catch(() => null) as { message?: string; error?: string } | T | null;
  if (!response.ok) {
    const detail = result && typeof result === "object" && "message" in result
      ? String(result.message)
      : result && typeof result === "object" && "error" in result
        ? String(result.error)
        : `Request failed (${response.status}).`;
    throw new Error(detail);
  }
  return result as T;
}

function roleLabel(role: string): string {
  return role.split(",").map((item) => roles.find(([value]) => value === item)?.[1] ?? item).join(", ");
}

export function AdminDashboard() {
  const session = authClient.useSession();
  const activeOrganization = authClient.useActiveOrganization();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [overviewError, setOverviewError] = useState("");
  const [membersError, setMembersError] = useState("");
  const [invitationsError, setInvitationsError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AssignableRole>("viewer");
  const [busyKey, setBusyKey] = useState("");
  const [feedback, setFeedback] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!session.data || !activeOrganization.data?.id) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setOverviewError("");
      setMembersError("");
      setInvitationsError("");

      const [overviewResult, membersResult, invitationsResult] = await Promise.allSettled([
        apiRequest<Overview>("/v1/admin/overview"),
        apiRequest<MemberResponse>("/v1/admin/members"),
        apiRequest<Invitation[]>("/v1/admin/invitations"),
      ]);

      if (!cancelled) {
        if (overviewResult.status === "fulfilled") setOverview(overviewResult.value);
        else setOverviewError(overviewResult.reason instanceof Error ? overviewResult.reason.message : "Could not load dashboard metrics.");
        if (membersResult.status === "fulfilled") setMembers(membersResult.value.members ?? []);
        else setMembersError(membersResult.reason instanceof Error ? membersResult.reason.message : "Could not load team members.");
        if (invitationsResult.status === "fulfilled") setInvitations(invitationsResult.value ?? []);
        else setInvitationsError(invitationsResult.reason instanceof Error ? invitationsResult.reason.message : "Could not load invitations.");
        setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [session.data, activeOrganization.data?.id, reloadKey]);

  async function sendInvitation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyKey("invite");
    setFeedback("");
    try {
      await apiRequest("/v1/admin/invitations", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      setInviteEmail("");
      setFeedback("Invitation created. Delivery depends on the configured authentication email transport.");
      setReloadKey((value) => value + 1);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Invitation failed.");
    } finally {
      setBusyKey("");
    }
  }

  async function changeRole(member: Member, role: AssignableRole) {
    setBusyKey(`role:${member.id}`);
    setFeedback("");
    try {
      await apiRequest(`/v1/admin/members/${encodeURIComponent(member.id)}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      setFeedback(`Updated the role for ${member.user.email}.`);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Role update failed.");
    } finally {
      setBusyKey("");
    }
  }

  async function removeMember(member: Member) {
    if (!window.confirm(`Remove ${member.user.email} from this client workspace?`)) return;
    setBusyKey(`remove:${member.id}`);
    setFeedback("");
    try {
      await apiRequest(`/v1/admin/members/${encodeURIComponent(member.user.id)}`, { method: "DELETE" });
      setFeedback(`Removed ${member.user.email} from this workspace.`);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Member removal failed.");
    } finally {
      setBusyKey("");
    }
  }

  async function cancelInvitation(invitation: Invitation) {
    setBusyKey(`cancel:${invitation.id}`);
    setFeedback("");
    try {
      await apiRequest(`/v1/admin/invitations/${encodeURIComponent(invitation.id)}`, { method: "DELETE" });
      setFeedback(`Cancelled the invitation for ${invitation.email}.`);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Invitation cancellation failed.");
    } finally {
      setBusyKey("");
    }
  }

  async function signOut() {
    await authClient.signOut();
    window.location.assign("/login");
  }

  if (session.isPending || activeOrganization.isPending) {
    return <section className="admin-card"><p>Checking your workspace session…</p></section>;
  }

  if (!session.data) {
    return (
      <section className="admin-card">
        <p className="eyebrow">CLIENT ADMINISTRATION</p>
        <h1>Sign in to manage this workspace.</h1>
        <a className="admin-primary-link" href="/login?callbackURL=%2Fadmin">Sign in</a>
      </section>
    );
  }

  if (!activeOrganization.data) {
    return (
      <section className="admin-card">
        <p className="eyebrow">CLIENT ADMINISTRATION</p>
        <h1>Select a client workspace.</h1>
        <p className="admin-muted">Choose an organization before opening its administration area.</p>
        <a className="admin-primary-link" href="/workspace">Choose workspace</a>
      </section>
    );
  }

  const tenantName = overview?.tenant.name ?? activeOrganization.data.name;

  return (
    <section className="admin-dashboard">
      <header className="admin-heading">
        <div>
          <p className="eyebrow">CLIENT ADMINISTRATION</p>
          <h1>{tenantName}</h1>
          <p className="admin-muted">{activeOrganization.data.slug} · Signed in as {session.data.user.email}</p>
        </div>
        <div className="admin-heading-actions">
          <a className="admin-secondary-link" href="/workspace">Switch workspace</a>
          <button className="admin-quiet-button" type="button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <div className="admin-section-title">
        <div><p className="eyebrow">WORKSPACE SNAPSHOT</p><h2>Overview</h2></div>
        <span>{loading ? "Refreshing…" : overview?.tenant.currency ?? ""}</span>
      </div>
      {overviewError ? <p className="admin-error" role="alert">{overviewError}</p> : null}
      <div className="admin-metrics">
        <article><span>Products</span><strong>{overview?.metrics.products ?? "—"}</strong><small>{overview?.metrics.activeProducts ?? "—"} active</small></article>
        <article><span>Orders</span><strong>{overview?.metrics.orders ?? "—"}</strong><small>{overview?.metrics.pendingOrders ?? "—"} awaiting payment</small></article>
        <article><span>Paid orders</span><strong>{overview?.metrics.paidOrders ?? "—"}</strong><small>Based on current order status</small></article>
      </div>

      <div className="admin-section-title admin-team-title">
        <div><p className="eyebrow">PEOPLE AND ACCESS</p><h2>Team members</h2></div>
        <span>{members.length} listed</span>
      </div>
      {membersError ? <p className="admin-error" role="alert">{membersError}</p> : null}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Member</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead>
          <tbody>
            {members.map((member) => {
              const selectableRole = roles.some(([value]) => value === member.role) ? member.role : "";
              return (
                <tr key={member.id}>
                  <td><strong>{member.user.name || "Unnamed member"}</strong><small>{member.user.email}</small></td>
                  <td>
                    <select
                      aria-label={`Role for ${member.user.email}`}
                      value={selectableRole}
                      disabled={busyKey !== "" || selectableRole === ""}
                      onChange={(event) => void changeRole(member, event.target.value as AssignableRole)}
                    >
                      {!selectableRole ? <option value="">Custom: {roleLabel(member.role)}</option> : null}
                      {roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </td>
                  <td>{new Date(member.createdAt).toLocaleDateString()}</td>
                  <td><button className="admin-danger-button" type="button" disabled={busyKey !== ""} onClick={() => void removeMember(member)}>Remove</button></td>
                </tr>
              );
            })}
            {!members.length ? <tr><td colSpan={4} className="admin-empty">No member records to display, or you do not have team-management access.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="admin-invite-layout">
        <section className="admin-card admin-invite-card">
          <p className="eyebrow">ADD TO YOUR TEAM</p>
          <h2>Invite a member</h2>
          <p className="admin-muted">Invitations are scoped to this workspace. Client administrators cannot grant the platform-controlled owner role.</p>
          <form className="admin-invite-form" onSubmit={sendInvitation}>
            <label>
              Email address
              <input
                type="email"
                required
                maxLength={254}
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value.trim())}
                placeholder="colleague@example.com"
              />
            </label>
            <label>
              Workspace role
              <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as AssignableRole)}>
                {roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <small className="admin-muted" style={{ marginTop: 4, lineHeight: 1.4 }}>
                <strong>Role scope:</strong> {roles.find(([r]) => r === inviteRole)?.[2]}
              </small>
            </label>
            <button className="admin-primary-button" type="submit" disabled={busyKey !== ""}>
              {busyKey === "invite" ? "Sending…" : "Send invitation"}
            </button>
          </form>
        </section>

        <section className="admin-card admin-invitation-card">
          <div className="admin-section-title"><div><p className="eyebrow">PENDING ACCESS</p><h2>Invitations</h2></div><span>{invitations.length}</span></div>
          {invitationsError ? <p className="admin-error" role="alert">{invitationsError}</p> : null}
          {invitations.map((invitation) => (
            <div className="admin-invitation-row" key={invitation.id}>
              <div><strong>{invitation.email}</strong><small>{roleLabel(invitation.role)} · {invitation.status} · Expires {new Date(invitation.expiresAt).toLocaleDateString()}</small></div>
              <button className="admin-danger-button" type="button" disabled={busyKey !== ""} onClick={() => void cancelInvitation(invitation)}>Cancel</button>
            </div>
          ))}
          {!invitations.length && !invitationsError ? (
            <p className="admin-empty">No pending invitations. When you invite colleagues or volunteers, their pending invitations will appear here.</p>
          ) : null}
        </section>

        <section className="admin-card" style={{ gridColumn: "1 / -1", marginTop: 8 }}>
          <p className="eyebrow">ACCESS PERMISSIONS REFERENCE</p>
          <h3 style={{ margin: "4px 0 14px", fontSize: 16 }}>Workspace roles explained</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {roles.map(([id, label, desc]) => (
              <div key={id} style={{ padding: 12, background: "#f8f9fa", border: "1px solid #e9ecef", borderRadius: 8 }}>
                <strong style={{ display: "block", color: "#19392f", fontSize: 13 }}>{label}</strong>
                <small style={{ color: "#5c7162", fontSize: 11, lineHeight: 1.45, display: "block", marginTop: 4 }}>{desc}</small>
              </div>
            ))}
          </div>
        </section>
      </div>

      {feedback ? <p className="admin-feedback" role="status">{feedback}</p> : null}
      <p className="admin-security-note">Workspace access is checked by the API for every operation. Organization selection in the browser is not used as proof of tenant access.</p>
    </section>
  );
}
