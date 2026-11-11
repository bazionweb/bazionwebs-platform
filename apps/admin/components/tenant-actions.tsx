"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  const [success, setSuccess] = useState("");
  const router = useRouter();

  function handleNameChange(val: string) {
    setName(val);
    if (!isManualSlug) {
      setSlug(slugify(val));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/auth/organization/create", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || data.error || `Creation failed (${response.status})`);
      }

      setSuccess(`Workspace "${name}" provisioned successfully!`);
      setTimeout(() => {
        setIsOpen(false);
        setName("");
        setSlug("");
        setIsManualSlug(false);
        setSuccess("");
        router.refresh();
      }, 1200);
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
        onClick={() => setIsOpen(true)}
      >
        <span>+ Provision Workspace</span>
      </button>

      {isOpen && (
        <div className="modal-backdrop" onClick={() => !busy && setIsOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">NEW CLIENT WORKSPACE</p>
                <h2>Provision Workspace</h2>
                <p className="muted">Creates an isolated tenant organization with dedicated schemas and roles.</p>
              </div>
              <button
                type="button"
                className="modal-close"
                disabled={busy}
                onClick={() => setIsOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              {error && <div className="notice-inline error-notice">{error}</div>}
              {success && <div className="notice-inline success-notice">{success}</div>}

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
                <small className="muted">Lowercase letters, numbers, and dashes only.</small>
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
                  onClick={() => setIsOpen(false)}
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
      const response = await fetch("/v1/admin/platform/tenants/reconcile-provisioning", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ staleMinutes: 10, limit: 100 }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || data.error || `Reconciliation failed (${response.status})`);
      }

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

