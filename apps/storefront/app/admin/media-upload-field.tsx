"use client";

import { useRef, useState } from "react";
import { ResponsiveImage } from "@bazion/ui";
import { pulse } from "@bazion/ui";

export type MinistryMediaAsset = {
  key: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  lastModified: string;
  originalSizeBytes?: number;
  savedBytes?: number;
  optimized?: boolean;
};

type MediaResponse = { items?: MinistryMediaAsset[]; asset?: MinistryMediaAsset; message?: string; error?: string };

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

function safePreviewUrl(value: string): boolean {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

function fileName(key: string): string {
  return key.split("/").at(-1) || "Uploaded image";
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

async function readResponse(response: Response): Promise<MediaResponse> {
  const payload = await response.json().catch(() => null) as MediaResponse | null;
  if (!response.ok) throw new Error(payload?.message ?? payload?.error ?? `Upload request failed (${response.status}).`);
  return payload ?? {};
}

export function MediaUploadField({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<MinistryMediaAsset[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function openLibrary() {
    setLibraryOpen(true);
    setLoadingLibrary(true);
    setError("");
    try {
      const payload = await readResponse(await fetch("/v1/admin/church/media", { credentials: "include", cache: "no-store" }));
      setAssets(payload.items ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The media library could not be loaded.");
    } finally {
      setLoadingLibrary(false);
    }
  }

  async function uploadFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setNotice("");
    if (!allowedImageTypes.has(file.type)) {
      const msg = "Choose a JPEG, PNG, WebP, or AVIF image.";
      setError(msg);
      pulse.warning(msg);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      const msg = "Images must be 8 MB or smaller.";
      setError(msg);
      pulse.warning(msg);
      return;
    }
    setBusy(true);
    try {
      const query = new URLSearchParams({ filename: file.name, contentType: file.type });
      const payload = await pulse.track(
        async () => {
          const res = await fetch(`/v1/admin/church/media?${query}`, {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/octet-stream" },
            body: file,
          });
          return await readResponse(res);
        },
        {
          pending: `Uploading ${file.name}…`,
          success: `${file.name} uploaded`,
          group: "media:upload",
        },
      );
      if (!payload.asset) throw new Error("The upload completed without an asset link.");
      onChange(payload.asset.url);
      setAssets((current) => [payload.asset!, ...current.filter((asset) => asset.key !== payload.asset!.key)]);
      setNotice(payload.asset.optimized
        ? `Image converted to WebP and saved ${formatBytes(payload.asset.savedBytes ?? 0)}.`
        : "Image was already compact; the original format was kept to avoid increasing storage.");
      setLibraryOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The image could not be uploaded.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return <div className="ministry-media-field">
    <span className="ministry-media-label">{label}</span>
    <div className="ministry-media-input-row">
      <input
        type="text"
        value={value}
        required={required}
        maxLength={2048}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Upload an image or paste an HTTPS image URL"
        aria-label={`${label} URL`}
      />
      <input
        ref={fileInput}
        className="ministry-media-file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        aria-label={`Choose ${label.toLowerCase()} image to upload`}
        onChange={(event) => void uploadFile(event.target.files?.[0])}
      />
      <button type="button" className="ministry-media-button" disabled={busy} onClick={() => fileInput.current?.click()}>
        {busy ? "Uploading…" : "Upload"}
      </button>
      <button type="button" className="ministry-media-button ministry-media-button-secondary" disabled={loadingLibrary} onClick={() => void openLibrary()}>
        Browse
      </button>
    </div>
    <small className="ministry-media-help">JPEG, PNG, WebP, or AVIF · up to 8 MB. URLs must use HTTPS or a site-relative path.</small>
    {value && safePreviewUrl(value) && <div className="ministry-media-preview"><ResponsiveImage src={value} alt={`${label} preview`} sizes="180px" /><span>Current image preview</span></div>}
    {notice && <p role="status" className="ministry-media-help">{notice}</p>}
    {error && <p className="ministry-media-error" role="alert">{error}</p>}
    {libraryOpen && <section className="ministry-media-library" aria-label={`${label} media library`}>
      <div className="ministry-media-library-heading"><div><strong>Tenant media library</strong><small>Uploaded assets are available only in this workspace.</small></div><button type="button" onClick={() => setLibraryOpen(false)} aria-label="Close media library">Close</button></div>
      {loadingLibrary && <p role="status">Loading images…</p>}
      {!loadingLibrary && assets.length === 0 && <p className="ministry-media-help">No images have been uploaded to this workspace yet.</p>}
      {!loadingLibrary && assets.length > 0 && <div className="ministry-media-grid">
        {assets.map((asset) => <button type="button" key={asset.key} className="ministry-media-asset" onClick={() => { onChange(asset.url); setLibraryOpen(false); }}>
          <ResponsiveImage src={asset.url} alt={`Select ${fileName(asset.key)}`} sizes="(max-width: 760px) 40vw, 180px" />
          <span>{fileName(asset.key)}</span><small>{formatBytes(asset.sizeBytes)}</small>
        </button>)}
      </div>}
    </section>}
  </div>;
}
