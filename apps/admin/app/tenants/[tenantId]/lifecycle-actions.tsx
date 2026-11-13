"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { assertOk, pulse } from "@bazion/ui";

type Status = "provisioning" | "active" | "suspended" | "closed";

export function LifecycleActions({ tenantId, status }: { tenantId: string; status: Status }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function transition(action: "suspend" | "restore" | "close") {
    const confirmed = await pulse.confirm(
      action === "close"
        ? {
            title: "Close suspended tenant permanently?",
            message: "This is a terminal action and cannot be undone.",
            tone: "danger",
            confirmLabel: "Close permanently",
            consequences: [
              "Tenant storefront & admin access will be permanently terminated",
              "No further lifecycle transitions will be available",
            ],
            requireText: "CLOSE",
          }
        : action === "suspend"
          ? {
              title: "Suspend this tenant workspace?",
              message: "Public storefront and tenant operator access will be blocked until restored.",
              tone: "warning",
              confirmLabel: "Suspend workspace",
            }
          : {
              title: "Restore this tenant workspace?",
              message: "Public storefront and tenant operator access will resume immediately.",
              tone: "neutral",
              confirmLabel: "Restore workspace",
            },
    );
    if (!confirmed) return;
    setBusy(true);
    setMessage("");
    try {
      await pulse.track(
        async () => {
          const response = await fetch(
            `/v1/admin/platform/tenants/${encodeURIComponent(tenantId)}/lifecycle`,
            {
              method: "PATCH",
              credentials: "include",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ action }),
            },
          );
          await assertOk(response);
        },
        {
          title:
            action === "close"
              ? "Closing tenant permanently"
              : action === "suspend"
                ? "Suspending tenant"
                : "Restoring tenant",
          pendingDetail: "Updating workspace lifecycle state…",
          successTitle: `Tenant ${action} completed`,
          group: `tenant:lifecycle:${tenantId}`,
        },
      );
      setMessage(`Tenant ${action} request completed.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Lifecycle update failed.");
    } finally {
      setBusy(false);
    }
  }
  return <div className="actions">
    {status === "active" && <button disabled={busy} onClick={() => transition("suspend")} className="danger">Suspend workspace</button>}
    {status === "suspended" && <><button disabled={busy} onClick={() => transition("restore")} className="primary">Restore workspace</button><button disabled={busy} onClick={() => transition("close")} className="danger">Close permanently</button></>}
    {status === "provisioning" && <p className="muted">Provisioning workspaces cannot be changed from this screen.</p>}
    {status === "closed" && <p className="muted">This tenant is closed. No further lifecycle transitions are available.</p>}
    {busy && <span className="muted">Saving…</span>}{message && <p className="feedback" role="status">{message}</p>}
  </div>;
}
