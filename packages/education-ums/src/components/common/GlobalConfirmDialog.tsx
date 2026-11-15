import React, { useEffect, useRef } from "react";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  X,
  ShieldAlert
} from '../../shims/lucide-react';
import { useDialogStore, DialogVariant } from "../../stores/dialogStore";

const VARIANT_STYLES: Record<
  DialogVariant,
  {
    icon: React.ReactNode;
    badgeBg: string;
    badgeBorder: string;
    badgeText: string;
    iconColor: string;
    headerGlow: string;
    calloutBg: string;
    calloutBorder: string;
    calloutText: string;
    primaryBtn: string;
  }
> = {
  danger: {
    icon: <AlertTriangle className="w-6 h-6 animate-pulse" />,
    badgeBg: "bg-rose-50 dark:bg-rose-950/50",
    badgeBorder: "border-rose-200 dark:border-rose-800",
    badgeText: "text-rose-700 dark:text-rose-300",
    iconColor: "text-rose-600 dark:text-rose-400",
    headerGlow: "from-rose-500/20 via-transparent to-transparent",
    calloutBg: "bg-rose-50/80 dark:bg-rose-950/30",
    calloutBorder: "border-rose-200/80 dark:border-rose-800/50",
    calloutText: "text-rose-900 dark:text-rose-200",
    primaryBtn: "bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 text-white shadow-lg shadow-rose-600/25 active:scale-95",
  },
  warning: {
    icon: <AlertCircle className="w-6 h-6" />,
    badgeBg: "bg-amber-50 dark:bg-amber-950/50",
    badgeBorder: "border-amber-200 dark:border-amber-800",
    badgeText: "text-amber-800 dark:text-amber-300",
    iconColor: "text-amber-600 dark:text-amber-400",
    headerGlow: "from-amber-500/20 via-transparent to-transparent",
    calloutBg: "bg-amber-50/80 dark:bg-amber-950/30",
    calloutBorder: "border-amber-200/80 dark:border-amber-800/50",
    calloutText: "text-amber-900 dark:text-amber-200",
    primaryBtn: "bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white shadow-lg shadow-amber-600/25 active:scale-95",
  },
  info: {
    icon: <ShieldAlert className="w-6 h-6" />,
    badgeBg: "bg-purple-50 dark:bg-purple-950/50",
    badgeBorder: "border-purple-200 dark:border-purple-800",
    badgeText: "text-purple-800 dark:text-purple-300",
    iconColor: "text-[#2E004F] dark:text-[#FFD700]",
    headerGlow: "from-purple-500/20 via-transparent to-transparent",
    calloutBg: "bg-purple-50/80 dark:bg-purple-950/30",
    calloutBorder: "border-purple-200/80 dark:border-purple-800/50",
    calloutText: "text-purple-950 dark:text-purple-200",
    primaryBtn: "bg-gradient-to-r from-[#2E004F] to-purple-800 hover:from-purple-950 hover:to-indigo-950 text-white shadow-lg shadow-purple-900/25 active:scale-95",
  },
  success: {
    icon: <CheckCircle className="w-6 h-6" />,
    badgeBg: "bg-emerald-50 dark:bg-emerald-950/50",
    badgeBorder: "border-emerald-200 dark:border-emerald-800",
    badgeText: "text-emerald-800 dark:text-emerald-300",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    headerGlow: "from-emerald-500/20 via-transparent to-transparent",
    calloutBg: "bg-emerald-50/80 dark:bg-emerald-950/30",
    calloutBorder: "border-emerald-200/80 dark:border-emerald-800/50",
    calloutText: "text-emerald-950 dark:text-emerald-200",
    primaryBtn: "bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-lg shadow-emerald-600/25 active:scale-95",
  },
};

export default function GlobalConfirmDialog() {
  const { isOpen, isAlertOnly, options, handleConfirm, handleCancel } = useDialogStore();
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus confirm button when modal opens
    const timer = setTimeout(() => {
      confirmBtnRef.current?.focus();
    }, 50);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      } else if (e.key === "Enter" && !e.shiftKey) {
        // Confirm if not focused on cancel button
        if (document.activeElement?.tagName !== "BUTTON" || document.activeElement === confirmBtnRef.current) {
          e.preventDefault();
          handleConfirm();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, handleCancel, handleConfirm]);

  if (!isOpen || !options) return null;

  const variant = options.variant || "danger";
  const style = VARIANT_STYLES[variant];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleCancel();
        }
      }}
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-[#121214] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden animate-scale-up">
        {/* Ambient Top Glow */}
        <div className={`absolute top-0 left-0 right-0 h-24 bg-gradient-to-b ${style.headerGlow} pointer-events-none`} />

        {/* Modal Header */}
        <div className="relative p-6 pb-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`p-2.5 rounded-xl border ${style.badgeBg} ${style.badgeBorder} ${style.iconColor} shadow-xs shrink-0`}>
              {style.icon}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded border ${style.badgeBg} ${style.badgeBorder} ${style.badgeText}`}>
                  {options.badgeText || "Institutional Security Protocol"}
                </span>
              </div>
              <h3 id="confirm-dialog-title" className="text-lg font-black text-gray-900 dark:text-white tracking-tight">
                {options.title}
              </h3>
            </div>
          </div>

          <button
            onClick={handleCancel}
            aria-label="Close dialog"
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-2 space-y-3.5">
          <p id="confirm-dialog-desc" className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-relaxed">
            {options.message}
          </p>

          {options.detail && (
            <div className={`p-3.5 rounded-xl border text-xs font-medium leading-relaxed ${style.calloutBg} ${style.calloutBorder} ${style.calloutText}`}>
              <div className="flex items-start gap-2">
                <Info size={16} className="shrink-0 mt-0.5 opacity-80" />
                <div>{options.detail}</div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer / Actions */}
        <div className="p-6 pt-5 bg-gray-50/60 dark:bg-gray-900/40 border-t border-gray-100 dark:border-gray-800/80 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3">
          {!isAlertOnly && (
            <button
              type="button"
              onClick={handleCancel}
              className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all shadow-xs text-center flex items-center justify-center"
            >
              {options.cancelText || "Cancel"}
            </button>
          )}

          <button
            ref={confirmBtnRef}
            type="button"
            onClick={handleConfirm}
            className={`w-full sm:w-auto px-5 py-2.5 min-h-[44px] text-xs font-bold uppercase tracking-wider rounded-xl transition-all text-center flex items-center justify-center ${style.primaryBtn}`}
          >
            {options.confirmText || (isAlertOnly ? "Acknowledge" : "Confirm Action")}
          </button>
        </div>
      </div>
    </div>
  );
}
