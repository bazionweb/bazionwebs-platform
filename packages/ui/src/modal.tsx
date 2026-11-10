"use client";

import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef } from "react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  onKeyDown?: (event: KeyboardEvent<HTMLDialogElement>) => void;
}

export function Modal({ isOpen, onClose, title, children, onKeyDown }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousOverflow = document.body.style.overflow;
    if (isOpen && !dialog.open) {
      document.body.style.overflow = "hidden";
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }

    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="ch-modal-overlay"
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : "Dialog"}
      onCancel={(event) => {
        event.preventDefault();
        onCloseRef.current();
      }}
      onClose={() => onCloseRef.current()}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
      onKeyDown={onKeyDown}
    >
      <div className="ch-modal-content">
        <button
          type="button"
          className="ch-modal-close"
          onClick={() => onCloseRef.current()}
          aria-label="Close dialog"
          autoFocus
        >
          ✕
        </button>
        {title && <h2 id={titleId} className="ch-modal-title">{title}</h2>}
        <div className="ch-modal-body">{children}</div>
      </div>
    </dialog>
  );
}
