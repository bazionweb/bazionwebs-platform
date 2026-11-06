"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "provisioning" | "active" | "suspended" | "closed";

export function LifecycleActions({ tenantId, status }: { tenantId: string; status: Status }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function transition(action: "suspend" | "restore" | "close") {
    const warning = action === "close"
      ? "Close this suspended tenant? This is terminal and cannot be undone."
      : action === "suspend" ? "Suspend this tenant? Its access will be blocked." : "Restore this tenant?";
    if (!window.confirm(warning)) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/v1/admin/platform/tenants/${encodeURIComponent(tenantId)}/lifecycle`, {
        method: "PATCH", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? data.error ?? `Request failed (${response.status})`);
      setMessage(`Tenant ${action} request completed.`);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Lifecycle update failed."); }
    finally { setBusy(false); }
  }
  return <div className="actions">
    {status === "active" && <button disabled={busy} onClick={() => transition("suspend")} className="danger">Suspend workspace</button>}
    {status === "suspended" && <><button disabled={busy} onClick={() => transition("restore")} className="primary">Restore workspace</button><button disabled={busy} onClick={() => transition("close")} className="danger">Close permanently</button></>}
    {status === "provisioning" && <p className="muted">Provisioning workspaces cannot be changed from this screen.</p>}
    {status === "closed" && <p className="muted">This tenant is closed. No further lifecycle transitions are available.</p>}
    {busy && <span className="muted">Saving…</span>}{message && <p className="feedback" role="status">{message}</p>}
  </div>;
}
