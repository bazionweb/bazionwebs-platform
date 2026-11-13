"use client";

import { useState } from "react";
import { pulse } from "@bazion/ui";

interface CopyGivingDetailProps {
  label: string;
  value: string;
  variant: "paybill" | "account";
}

export function CopyGivingDetail({ label, value, variant }: CopyGivingDetailProps) {
  const [status, setStatus] = useState("");

  async function copyValue() {
    setStatus("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard access is unavailable.");
      await navigator.clipboard.writeText(value);
      setStatus(label + " copied.");
      pulse.success(label + " copied", { detail: value, duration: 2500 });
    } catch {
      const fallback = "Copy is unavailable here. Press and hold the value to copy it.";
      setStatus(fallback);
      pulse.warning(fallback);
    }
  }

  return (
    <div className="ch-giving-detail-row">
      <div>
        <div className="ch-giving-detail-label">{label}</div>
        <div className={"ch-giving-detail-value ch-giving-detail-value--" + variant}>{value}</div>
      </div>
      <button type="button" className="ch-giving-copy-button" onClick={() => void copyValue()} aria-label={"Copy " + label}>
        <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
          <path d="M8 8V4h12v12h-4M4 8h12v12H4z" />
        </svg>
        Copy
      </button>
      <span className="ch-giving-copy-status" role="status" aria-live="polite">{status}</span>
    </div>
  );
}
