"use client";

import React, { useRef, useState, useCallback, useId } from "react";
import { formatFilenameStem, traverseDataTransferItems, type DiscoveredFile } from "./folder-traversal.js";
import { BoundedUploadQueue, type QueueItem } from "./upload-queue.js";

export interface BatchUploadedImage {
  imageUrl: string;
  alt: string;
  caption?: string | undefined;
  filename: string;
  sizeBytes: number;
}

export interface UniversalBatchUploaderProps {
  uploadEndpoint?: string | undefined;
  headers?: Record<string, string> | undefined;
  maxConcurrency?: number | undefined;
  maxFiles?: number | undefined;
  onComplete: (images: BatchUploadedImage[]) => void;
  onClose?: (() => void) | undefined;
  title?: string | undefined;
  description?: string | undefined;
}

export function UniversalBatchUploader({
  uploadEndpoint = "/v1/admin/church/media",
  headers = {},
  maxConcurrency = 3,
  maxFiles = 60,
  onComplete,
  onClose,
  title = "Batch & Folder Image Upload",
  description = "Drag and drop a complete folder or multiple photos. Images are automatically optimized and metadata is auto-inferred.",
}: UniversalBatchUploaderProps) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progressSummary, setProgressSummary] = useState({ completed: 0, total: 0, percentage: 0 });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef<BoundedUploadQueue | null>(null);
  const headingId = useId();

  const handleFilesDiscovered = useCallback(
    (discovered: DiscoveredFile[]) => {
      setErrorMsg(null);
      if (discovered.length === 0) {
        setErrorMsg("No valid image files (JPEG, PNG, WebP, AVIF) were found.");
        return;
      }

      setItems((prev) => {
        const remainingCapacity = maxFiles - prev.length;
        if (remainingCapacity <= 0) {
          setErrorMsg(`Maximum capacity of ${maxFiles} images reached.`);
          return prev;
        }

        const allowedToAdd = discovered.slice(0, remainingCapacity);
        const newQueueItems: QueueItem[] = allowedToAdd.map(({ file, relativePath }) => ({
          id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          relativePath,
          status: "queued",
          progress: 0,
          inferredAltText: formatFilenameStem(file.name),
          inferredCaption: relativePath !== file.name ? relativePath : undefined,
        }));

        return [...prev, ...newQueueItems];
      });
    },
    [maxFiles],
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer?.items) {
      const files = await traverseDataTransferItems(e.dataTransfer.items);
      handleFilesDiscovered(files);
    } else if (e.dataTransfer?.files) {
      const files = await traverseDataTransferItems(e.dataTransfer.files);
      handleFilesDiscovered(files);
    }
  };

  const onFolderSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = await traverseDataTransferItems(e.target.files);
      handleFilesDiscovered(files);
      e.target.value = "";
    }
  };

  const onFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = await traverseDataTransferItems(e.target.files);
      handleFilesDiscovered(files);
      e.target.value = "";
    }
  };

  const startUpload = () => {
    if (items.length === 0) return;
    setIsUploading(true);
    setErrorMsg(null);

    const queue = new BoundedUploadQueue({
      concurrency: maxConcurrency,
      uploadEndpoint,
      headers,
      onItemProgress: (updatedItem) => {
        setItems((prev) => prev.map((item) => (item.id === updatedItem.id ? { ...updatedItem } : item)));
      },
      onItemComplete: (updatedItem) => {
        setItems((prev) => prev.map((item) => (item.id === updatedItem.id ? { ...updatedItem } : item)));
      },
      onQueueProgress: (completed, total, percentage) => {
        setProgressSummary({ completed, total, percentage });
      },
      onAllComplete: (successful) => {
        setIsUploading(false);
        const uploadedImages: BatchUploadedImage[] = successful
          .filter((item) => item.asset?.url)
          .map((item) => ({
            imageUrl: item.asset!.url,
            alt: item.inferredAltText || formatFilenameStem(item.file.name),
            caption: item.inferredCaption,
            filename: item.file.name,
            sizeBytes: item.file.size,
          }));

        if (uploadedImages.length > 0) {
          onComplete(uploadedImages);
        }
      },
    });

    queueRef.current = queue;
    queue.addFiles(
      items.map((item) => ({
        file: item.file,
        relativePath: item.relativePath,
        inferredAltText: item.inferredAltText,
        inferredCaption: item.inferredCaption,
      })),
    );
    queue.start();
  };

  const removeItem = (id: string) => {
    if (isUploading) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "24px",
        boxShadow: "0 10px 25px -5px rgba(0,0,0,0.08)",
        maxWidth: "760px",
        width: "100%",
        margin: "0 auto",
      }}
      role="region"
      aria-labelledby={headingId}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
        <div>
          <h3 id={headingId} style={{ margin: "0 0 6px 0", fontSize: "1.25rem", color: "#0f172a" }}>{title}</h3>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>{description}</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            aria-label="Close uploader"
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              cursor: isUploading ? "not-allowed" : "pointer",
              color: "#94a3b8",
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Hidden file inputs */}
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is standard in browser engines
        webkitdirectory=""
        directory=""
        multiple
        style={{ display: "none" }}
        onChange={onFolderSelected}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        multiple
        style={{ display: "none" }}
        onChange={onFilesSelected}
      />

      {/* Dropzone Area */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          border: isDragging ? "2px dashed #0284c7" : "2px dashed #cbd5e1",
          background: isDragging ? "#f0f9ff" : "#f8fafc",
          borderRadius: "8px",
          padding: "32px 20px",
          textAlign: "center",
          cursor: "pointer",
          transition: "all 0.2s ease",
          marginBottom: "16px",
        }}
      >
        <div style={{ fontSize: "2rem", marginBottom: "8px" }}>📁</div>
        <p style={{ margin: "0 0 8px 0", fontWeight: 600, color: "#1e293b", fontSize: "1rem" }}>
          Drop folder or multiple images here
        </p>
        <p style={{ margin: "0 0 16px 0", color: "#64748b", fontSize: "0.8125rem" }}>
          Recursively ingests subfolders, preserves structures, and extracts titles
        </p>
        <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            disabled={isUploading}
            style={{
              background: "#0f172a",
              color: "#ffffff",
              border: "none",
              padding: "8px 16px",
              borderRadius: "6px",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: isUploading ? "not-allowed" : "pointer",
            }}
          >
            Select Folder
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            style={{
              background: "#ffffff",
              color: "#0f172a",
              border: "1px solid #cbd5e1",
              padding: "8px 16px",
              borderRadius: "6px",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: isUploading ? "not-allowed" : "pointer",
            }}
          >
            Select Files
          </button>
        </div>
      </div>

      {errorMsg && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            borderRadius: "6px",
            padding: "10px 14px",
            fontSize: "0.875rem",
            marginBottom: "16px",
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Progress Bar during upload */}
      {isUploading && (
        <div style={{ marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", color: "#475569", marginBottom: "6px" }}>
            <span>Uploading batch…</span>
            <span>{progressSummary.completed} of {progressSummary.total} ({progressSummary.percentage}%)</span>
          </div>
          <div style={{ background: "#e2e8f0", borderRadius: "999px", height: "8px", overflow: "hidden" }}>
            <div
              style={{
                background: "#0284c7",
                width: `${progressSummary.percentage}%`,
                height: "100%",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* Queue items review list */}
      {items.length > 0 && (
        <div style={{ maxHeight: "260px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "8px", marginBottom: "16px" }}>
          <div style={{ padding: "8px 12px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: "0.8125rem", fontWeight: 600, color: "#475569" }}>
            Queued for Import ({items.length} files)
          </div>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                borderBottom: "1px solid #f1f5f9",
                fontSize: "0.8125rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
                <span style={{ fontSize: "1.2rem" }}>🖼️</span>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <div style={{ fontWeight: 500, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.inferredAltText}
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
                    {item.relativePath} · {(item.file.size / 1024).toFixed(0)} KB
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                {item.status === "queued" && <span style={{ color: "#64748b" }}>Queued</span>}
                {item.status === "uploading" && <span style={{ color: "#0284c7" }}>Uploading…</span>}
                {item.status === "success" && <span style={{ color: "#16a34a", fontWeight: 600 }}>✓ Uploaded</span>}
                {item.status === "error" && <span style={{ color: "#dc2626" }}>Error</span>}
                {!isUploading && item.status === "queued" && (
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    aria-label={`Remove ${item.file.name}`}
                    style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "1.1rem" }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action footer */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            style={{
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              padding: "8px 16px",
              borderRadius: "6px",
              fontSize: "0.875rem",
              cursor: isUploading ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={startUpload}
          disabled={isUploading || items.length === 0}
          style={{
            background: items.length > 0 && !isUploading ? "#0284c7" : "#94a3b8",
            color: "#ffffff",
            border: "none",
            padding: "8px 20px",
            borderRadius: "6px",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: items.length > 0 && !isUploading ? "pointer" : "not-allowed",
          }}
        >
          {isUploading ? "Uploading Batch…" : `Upload Batch (${items.length})`}
        </button>
      </div>
    </div>
  );
}
