"use client";

import { type ReactNode, useEffect } from "react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="ch-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title || "Dialog modal"}
    >
      <div
        className="ch-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="ch-modal-close"
          onClick={onClose}
          aria-label="Close dialog"
        >
          ✕
        </button>
        {title && (
          <div
            style={{
              padding: "20px 24px",
              borderBottom: "1px solid var(--church-border)",
              fontWeight: 700,
              fontSize: "18px",
            }}
          >
            {title}
          </div>
        )}
        <div style={{ padding: "24px" }}>{children}</div>
      </div>
    </div>
  );
}
