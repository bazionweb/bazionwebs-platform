"use client";

import { useEffect, useState } from "react";
import { pulse } from "@bazion/ui";

interface SiteEnquiryItem {
  id: string;
  formId: string;
  fullName: string;
  email: string | null;
  telephone: string | null;
  subject: string | null;
  message: string;
  status: "new" | "in_progress" | "responded" | "archived";
  assignedTo: string | null;
  privacyNoticeVersion: string;
  createdAt: string;
}

interface SiteEnquiryPolicy {
  enabled: boolean;
  privacyNotice: string;
  privacyNoticeVersion: string;
  retentionDays: number;
  routingEmail?: string | null;
  publishedAt?: string | null;
}

const DEFAULT_POLICY: SiteEnquiryPolicy = {
  enabled: false,
  privacyNotice: "We collect your contact details strictly to respond to your enquiry and delete records automatically after the retention period.",
  privacyNoticeVersion: "1.0.0",
  retentionDays: 180,
  routingEmail: "",
};

export function FormsLeadsAdminPanel() {
  const [enquiries, setEnquiries] = useState<SiteEnquiryItem[]>([]);
  const [policy, setPolicy] = useState<SiteEnquiryPolicy>(DEFAULT_POLICY);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadAll(filter = statusFilter) {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ limit: "50" });
      if (filter !== "all") query.set("status", filter);
      const [policyRes, listRes] = await Promise.all([
        fetch("/v1/admin/site/enquiry-policy", { credentials: "include", cache: "no-store" }),
        fetch(`/v1/admin/site/enquiries?${query.toString()}`, { credentials: "include", cache: "no-store" }),
      ]);
      if (policyRes.ok) {
        const data = await policyRes.json() as { policy?: SiteEnquiryPolicy | null };
        if (data.policy) setPolicy({ ...DEFAULT_POLICY, ...data.policy, routingEmail: data.policy.routingEmail ?? "" });
      }
      if (listRes.ok) {
        const data = await listRes.json() as { enquiries?: SiteEnquiryItem[] };
        setEnquiries(data.enquiries ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load leads inbox.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll("all");
  }, []);

  async function savePolicy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/v1/admin/site/enquiry-policy", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled: policy.enabled,
          privacyNotice: policy.privacyNotice,
          privacyNoticeVersion: policy.privacyNoticeVersion,
          retentionDays: Number(policy.retentionDays),
          routingEmail: policy.routingEmail?.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message ?? "Could not save enquiry privacy policy.");
      }
      pulse.success("Enquiry policy saved");
      setMessage("Website enquiry policy updated.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Policy update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function updateLeadStatus(id: string, status: SiteEnquiryItem["status"]) {
    try {
      const res = await fetch(`/v1/admin/site/enquiries/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update lead status.");
      setEnquiries((prev) => prev.map((item) => item.id === id ? { ...item, status } : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed.");
    }
  }

  async function deleteLead(id: string) {
    const ok = await pulse.confirm({
      title: "Delete website enquiry?",
      message: "This permanently removes the contact submission for privacy compliance.",
      tone: "danger",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    const res = await fetch(`/v1/admin/site/enquiries/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      setEnquiries((prev) => prev.filter((item) => item.id !== id));
    }
  }

  return (
    <section className="admin-dashboard">
      <div className="admin-section-title">
        <div>
          <p className="eyebrow">FORMS & LEAD CAPTURE</p>
          <h2>Enquiries & Privacy Policy</h2>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a className="admin-secondary-link" href="/v1/admin/site/enquiries/export">Export JSON</a>
          <select
            aria-label="Filter leads by status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              void loadAll(e.target.value);
            }}
          >
            <option value="all">All statuses</option>
            <option value="new">New</option>
            <option value="in_progress">In progress</option>
            <option value="responded">Responded</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {error && <p className="admin-error" role="alert">{error}</p>}
      {message && <p className="admin-feedback" role="status">{message}</p>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Sender</th><th>Subject & Message</th><th>Status</th><th>Received</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="admin-empty">Loading enquiries…</td></tr>
            ) : enquiries.length === 0 ? (
              <tr><td colSpan={5} className="admin-empty">No active website enquiries found.</td></tr>
            ) : enquiries.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.fullName}</strong>
                  <small>{[item.email, item.telephone].filter(Boolean).join(" · ")}</small>
                </td>
                <td>
                  <strong>{item.subject || item.formId}</strong>
                  <small>{item.message}</small>
                </td>
                <td>
                  <select
                    aria-label={`Status for ${item.fullName}`}
                    value={item.status}
                    onChange={(e) => void updateLeadStatus(item.id, e.target.value as SiteEnquiryItem["status"])}
                  >
                    <option value="new">New</option>
                    <option value="in_progress">In progress</option>
                    <option value="responded">Responded</option>
                    <option value="archived">Archived</option>
                  </select>
                </td>
                <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                <td>
                  <button type="button" className="admin-danger-button" onClick={() => void deleteLead(item.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="admin-card" style={{ marginTop: 20 }}>
        <p className="eyebrow">COLLECTION POLICY</p>
        <h3>Public enquiry notice &amp; retention</h3>
        <form className="admin-invite-form" onSubmit={savePolicy}>
          <label>
            <input
              type="checkbox"
              checked={policy.enabled}
              onChange={(e) => setPolicy((p) => ({ ...p, enabled: e.target.checked }))}
            /> Enable public website enquiry collection
          </label>
          <label>
            Privacy notice text (min 40 characters)
            <textarea
              rows={3}
              required
              minLength={40}
              value={policy.privacyNotice}
              onChange={(e) => setPolicy((p) => ({ ...p, privacyNotice: e.target.value }))}
            />
          </label>
          <label>
            Notice version (semver)
            <input
              required
              pattern="[0-9]+\.[0-9]+\.[0-9]+"
              value={policy.privacyNoticeVersion}
              onChange={(e) => setPolicy((p) => ({ ...p, privacyNoticeVersion: e.target.value }))}
            />
          </label>
          <label>
            Retention window (days)
            <input
              type="number"
              min={1}
              max={3650}
              value={policy.retentionDays}
              onChange={(e) => setPolicy((p) => ({ ...p, retentionDays: Number(e.target.value) || 180 }))}
            />
          </label>
          <label>
            Notification routing email (optional)
            <input
              type="email"
              value={policy.routingEmail ?? ""}
              onChange={(e) => setPolicy((p) => ({ ...p, routingEmail: e.target.value }))}
              placeholder="enquiries@example.com"
            />
          </label>
          <button type="submit" className="admin-primary-button" disabled={saving}>
            {saving ? "Saving…" : "Save enquiry policy"}
          </button>
        </form>
      </section>
    </section>
  );
}
