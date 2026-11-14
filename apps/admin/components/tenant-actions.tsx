"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { assertOk, pulse } from "@bazion/ui";
import { getTenantStorefrontUrl, getTenantWorkspacePickerUrl } from "@/lib/public-urls";

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CreateTenantModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isManualSlug, setIsManualSlug] = useState(false);
  const [currency, setCurrency] = useState("KES");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [provisioned, setProvisioned] = useState<{ name: string; slug: string; orgId?: string } | null>(null);
  const router = useRouter();

  function handleNameChange(val: string) {
    setName(val);
    if (!isManualSlug) {
      setSlug(slugify(val));
    }
  }

  function handleClose() {
    if (busy) return;
    setIsOpen(false);
    setName("");
    setSlug("");
    setIsManualSlug(false);
    setError("");
    setProvisioned(null);
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const data = await pulse.track(
        async () => {
          const response = await fetch("/api/auth/organization/create", {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: name.trim(), slug: slug.trim() }),
          });
          await assertOk(response);
          return await response.json();
        },
        {
          title: `Provisioning workspace ${name.trim()}`,
          pendingDetail: "Creating tenant boundary and auth organization…",
          successTitle: `Workspace ${name.trim()} provisioned`,
          group: "tenant:provision",
        },
      );

      setProvisioned({
        name: name.trim(),
        slug: slug.trim(),
        orgId: data.organization?.id || data.id,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to provision workspace.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="primary create-workspace-btn"
        onClick={() => {
          setProvisioned(null);
          setError("");
          setIsOpen(true);
        }}
      >
        <span>+ Provision Workspace</span>
      </button>

      {isOpen && (
        <div className="modal-backdrop" onClick={handleClose}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">NEW CLIENT WORKSPACE</p>
                <h2>{provisioned ? "Workspace Ready" : "Provision Workspace"}</h2>
                <p className="muted">
                  {provisioned
                    ? "Workspace has been created with dedicated schemas and roles."
                    : "Creates an isolated tenant organization with dedicated schemas and roles."}
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                disabled={busy}
                onClick={handleClose}
              >
                ✕
              </button>
            </div>

            {provisioned ? (
              <div className="modal-form" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="notice-inline success-notice" style={{ padding: 14 }}>
                  <strong>Workspace &quot;{provisioned.name}&quot; provisioned successfully!</strong>
                  <p style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5 }}>
                    Your new tenant is live and isolated with default ministry settings and role access.
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--surface)", padding: 14, borderRadius: 6, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>DIRECT WORKSPACE ACCESS LINKS:</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div>
                      <strong style={{ display: "block", fontSize: 13 }}>Public Storefront</strong>
                      <code style={{ fontSize: 12 }}>{getTenantStorefrontUrl(provisioned.slug)}</code>
                    </div>
                    <a
                      href={getTenantStorefrontUrl(provisioned.slug)}
                      target="_blank"
                      rel="noreferrer"
                      className="primary"
                      style={{ padding: "6px 14px", textDecoration: "none", borderRadius: 4, fontSize: 13 }}
                    >
                      Open Site ↗
                    </a>
                  </div>
                  <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "4px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div>
                      <strong style={{ display: "block", fontSize: 13 }}>Tenant Admin Desk</strong>
                      <code style={{ fontSize: 12 }}>
                        {getTenantWorkspacePickerUrl({ slug: provisioned.slug, authOrganizationId: provisioned.orgId }, "/admin")}
                      </code>
                    </div>
                    <a
                      href={getTenantWorkspacePickerUrl({ slug: provisioned.slug, authOrganizationId: provisioned.orgId }, "/admin")}
                      target="_blank"
                      rel="noreferrer"
                      className="secondary"
                      style={{ padding: "6px 14px", textDecoration: "none", borderRadius: 4, fontSize: 13 }}
                    >
                      Open Desk ↗
                    </a>
                  </div>
                </div>

                <div className="modal-actions" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="primary"
                    onClick={handleClose}
                  >
                    Done & View All Workspaces ✓
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="modal-form">
                {error && <div className="notice-inline error-notice">{error}</div>}

                <label>
                  Workspace / Client Name
                  <input
                    type="text"
                    required
                    placeholder="e.g. St. Jude Outreach Ministries"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    disabled={busy}
                  />
                </label>

                <label>
                  URL Identifier (Slug)
                  <input
                    type="text"
                    required
                    placeholder="e.g. st-jude-outreach"
                    value={slug}
                    onChange={(e) => {
                      setIsManualSlug(true);
                      setSlug(slugify(e.target.value));
                    }}
                    disabled={busy}
                  />
                  <small className="muted">
                    {slug ? (
                      <>Storefront URL will be: <code>{getTenantStorefrontUrl(slug)}</code></>
                    ) : (
                      "Lowercase letters, numbers, and dashes only."
                    )}
                  </small>
                </label>

                <label>
                  Base Currency
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    disabled={busy}
                  >
                    <option value="KES">KES - Kenyan Shilling</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                  </select>
                </label>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={handleClose}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="primary"
                    disabled={busy || !name.trim() || !slug.trim()}
                  >
                    {busy ? "Provisioning…" : "Create & Provision Workspace →"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function ReconcileButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  async function handleReconcile() {
    setBusy(true);
    setResult(null);

    try {
      const data = await pulse.track(
        async () => {
          const response = await fetch("/v1/admin/platform/tenants/reconcile-provisioning", {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ staleMinutes: 10, limit: 100 }),
          });
          await assertOk(response);
          return await response.json();
        },
        {
          title: "Reconciling provisioning tenants",
          pendingDetail: "Scanning for stuck provisioning workflows…",
          successTitle: "Provisioning reconciliation complete",
          successDetail: (d) => `Scanned ${d?.scanned ?? 0}, Activated ${d?.activated ?? 0}`,
          group: "tenant:reconcile",
        },
      );

      setResult(`Scanned ${data.scanned ?? 0}, Activated ${data.activated ?? 0}`);
      router.refresh();
      setTimeout(() => setResult(null), 5000);
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Reconciliation failed");
      setTimeout(() => setResult(null), 5000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="reconcile-wrap">
      <button
        type="button"
        className="secondary reconcile-btn"
        disabled={busy}
        title="Check for and repair any orphaned or stuck provisioning tenants"
        onClick={handleReconcile}
      >
        {busy ? "Checking…" : "⚡ Reconcile Provisioning"}
      </button>
      {result && <span className="reconcile-feedback">{result}</span>}
    </div>
  );
}

