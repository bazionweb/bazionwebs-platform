"use client";

import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  formatPulseAgo,
  formatPulseElapsed,
  pendingStageLabel,
  pulse,
  type PulseConfirmRequest,
  type PulseController,
  type PulseItem,
  type PulseSnapshot,
  type PulseTone,
  type PulseTrackOptions,
} from "./pulse-core.js";

/** Subscribes a component to the shared pulse store. */
export function usePulseSnapshot(): PulseSnapshot {
  return useSyncExternalStore(pulse.subscribe, pulse.getSnapshot, pulse.getServerSnapshot);
}

/** Returns the shared controller; handy for components that prefer hooks. */
export function usePulse(): PulseController {
  return pulse;
}

function useNow(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs]);
  return now;
}

function PulseGlyph({ tone }: { tone: PulseTone | "danger" | "neutral" }) {
  if (tone === "success") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" /></svg>;
  }
  if (tone === "error" || tone === "danger") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v6" /><path d="M12 17h.01" /></svg>;
  }
  if (tone === "warning") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l9 16H3z" /><path d="M12 10v4" /><path d="M12 17h.01" /></svg>;
  }
  if (tone === "pending") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l2-5 3 10 2-5h7" /></svg>;
  }
  if (tone === "neutral") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v5" /><path d="M12 16.5h.01" /><circle cx="12" cy="12" r="9" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 11v6" /><path d="M12 7.5h.01" /></svg>;
}

function PulseCard({ item, index, expanded }: { item: PulseItem; index: number; expanded: boolean }) {
  const now = useNow(item.tone === "pending");
  const hiddenInStack = !expanded && index > 2;
  const slotStyle = { "--bz-i": index } as CSSProperties;
  const cardStyle = { "--bz-life": `${item.remaining}ms` } as CSSProperties;
  return (
    <li className="bz-pulse-slot" style={slotStyle} data-leaving={item.leaving || undefined} aria-hidden={hiddenInStack || undefined}>
      <div
        className="bz-pulse"
        data-tone={item.tone}
        data-stage={item.stage}
        data-paused={item.paused || undefined}
        data-leaving={item.leaving || undefined}
        style={cardStyle}
      >
        <span className="bz-pulse-orb" aria-hidden="true">
          <span className="bz-pulse-glyph" key={`${item.tone}-${item.cycle}`}><PulseGlyph tone={item.tone} /></span>
        </span>
        <div className="bz-pulse-body">
          {item.scope ? <span className="bz-pulse-scope">{item.scope}</span> : null}
          <p className="bz-pulse-title">
            {item.title}
            {item.count > 1 ? <span className="bz-pulse-count" aria-label={`${item.count} times`}>×{item.count}</span> : null}
          </p>
          {item.detail ? <p className="bz-pulse-detail">{item.detail}</p> : null}
          {item.tone === "pending" ? (
            <p className="bz-pulse-meta">
              <span>{pendingStageLabel(item.stage)}</span>
              <span className="bz-pulse-elapsed">{formatPulseElapsed(now - item.startedAt)}</span>
            </p>
          ) : null}
          {item.hint ? <p className="bz-pulse-hint">{item.hint}</p> : null}
          {item.action ? (
            <button type="button" className="bz-pulse-action" tabIndex={hiddenInStack ? -1 : undefined} onClick={() => { void pulse.runAction(item.id); }}>
              {item.action.label}
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className="bz-pulse-close"
          aria-label={item.tone === "pending" ? "Hide progress (work continues)" : "Dismiss notification"}
          tabIndex={hiddenInStack ? -1 : undefined}
          onClick={() => pulse.dismiss(item.id)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        {item.tone === "pending" ? (
          <svg className="bz-pulse-ecg" viewBox="0 0 240 14" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 7 H70 L78 2 L86 12 L94 1 L100 7 H150 L156 4 L162 10 L168 7 H240" />
          </svg>
        ) : item.duration > 0 ? (
          <span className="bz-pulse-life" key={item.cycle} aria-hidden="true" />
        ) : null}
      </div>
    </li>
  );
}

export interface PulseHostProps {
  /** Where the stack docks. Choose a corner free of other floating widgets. */
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-center" | undefined;
  /** Accessible label for the notification region. */
  label?: string | undefined;
  /** Watch browser connectivity and announce offline/online changes. */
  connectivity?: boolean | undefined;
  /** Optional class for brand overrides (set --bz-pulse-* variables). */
  className?: string | undefined;
}

/**
 * Mount once near the root of an app. Renders the live notification stack,
 * screen-reader announcements and the shared confirmation dialog.
 */
export function PulseHost({ position = "bottom-right", label = "Notifications", connectivity = true, className }: PulseHostProps) {
  const snapshot = usePulseSnapshot();
  const [expanded, setExpanded] = useState(false);
  const regionRef = useRef<HTMLElement>(null);

  useEffect(() => (connectivity ? pulse.watchConnectivity() : undefined), [connectivity]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") pulse.pauseAll();
      else if (!regionRef.current?.matches(":hover, :focus-within")) pulse.resumeAll();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const open = useCallback(() => {
    setExpanded(true);
    pulse.pauseAll();
  }, []);
  const close = useCallback(() => {
    setExpanded(false);
    pulse.resumeAll();
  }, []);

  const items = snapshot.items;
  useEffect(() => {
    if (items.length === 0 && expanded) setExpanded(false);
  }, [items.length, expanded]);

  return (
    <>
      <div className="bz-pulse-sr" role="status" aria-live="polite" aria-atomic="true">{snapshot.announcement.polite}</div>
      <div className="bz-pulse-sr" role="alert" aria-live="assertive" aria-atomic="true">{snapshot.announcement.assertive}</div>
      <section
        ref={regionRef}
        className={["bz-pulse-region", className].filter(Boolean).join(" ")}
        data-position={position}
        aria-label={label}
        data-empty={items.length === 0 || undefined}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            const newest = items.find((item) => !item.leaving);
            if (newest) pulse.dismiss(newest.id);
          }
        }}
      >
        <ol className="bz-pulse-stack" data-expanded={expanded || undefined}>
          {items.map((item, index) => (
            <PulseCard key={item.id} item={item} index={index} expanded={expanded} />
          ))}
        </ol>
      </section>
      <PulseConfirmHost request={snapshot.confirm} />
    </>
  );
}

function PulseConfirmHost({ request }: { request: PulseConfirmRequest | null }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const [armed, setArmed] = useState(false);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (request) {
      setTyped("");
      setArmed(false);
      if (!dialog.open) dialog.showModal();
      // A short arming delay stops the click that opened the dialog (or a
      // double-click) from confirming a consequential action by accident.
      const timer = setTimeout(() => setArmed(true), 480);
      return () => clearTimeout(timer);
    }
    if (dialog.open) dialog.close();
    return undefined;
  }, [request]);

  const tone = request?.tone ?? "neutral";
  const textMatches = !request?.requireText || typed.trim() === request.requireText;
  const canConfirm = armed && textMatches;
  const settle = (confirmed: boolean) => {
    if (request) pulse.resolveConfirm(request.id, confirmed);
  };

  return (
    <dialog
      ref={dialogRef}
      className="bz-confirm"
      data-tone={tone}
      aria-labelledby={request ? titleId : undefined}
      aria-describedby={request?.message ? messageId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        settle(false);
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) settle(false);
      }}
    >
      {request ? (
        <form
          className="bz-confirm-card"
          onSubmit={(event) => {
            event.preventDefault();
            if (canConfirm) settle(true);
          }}
        >
          <span className="bz-confirm-seal" aria-hidden="true"><PulseGlyph tone={tone === "danger" ? "danger" : tone === "warning" ? "warning" : "neutral"} /></span>
          <h2 id={titleId} className="bz-confirm-title">{request.title}</h2>
          {request.message ? <p id={messageId} className="bz-confirm-message">{request.message}</p> : null}
          {request.consequences?.length ? (
            <ul className="bz-confirm-consequences">
              {request.consequences.map((line) => <li key={line}>{line}</li>)}
            </ul>
          ) : null}
          {request.requireText ? (
            <label className="bz-confirm-require">
              <span>Type <strong>{request.requireText}</strong> to confirm</span>
              <input
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                autoFocus
                aria-invalid={typed.length > 0 && !textMatches ? true : undefined}
              />
            </label>
          ) : null}
          <div className="bz-confirm-actions">
            <button type="button" className="bz-confirm-cancel" onClick={() => settle(false)} autoFocus={!request.requireText}>
              {request.cancelLabel ?? "Cancel"}
            </button>
            <button type="submit" className="bz-confirm-go" disabled={!canConfirm} data-armed={armed || undefined}>
              <span>{request.confirmLabel ?? "Confirm"}</span>
            </button>
          </div>
        </form>
      ) : null}
    </dialog>
  );
}

export interface PulseActivityButtonProps {
  label?: string | undefined;
  className?: string | undefined;
}

/**
 * Inline topbar control that shows live in-flight work and opens a session
 * activity log of every confirmation and failure.
 */
export function PulseActivityButton({ label = "Activity", className }: PulseActivityButtonProps) {
  const snapshot = usePulseSnapshot();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const now = useNow(open, 15_000);

  useEffect(() => {
    if (!open) return;
    pulse.markRead();
    const onPointer = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open && snapshot.unread > 0) pulse.markRead();
  }, [open, snapshot.unread]);

  const busy = snapshot.inFlight > 0;
  return (
    <div ref={wrapperRef} className={["bz-activity", className].filter(Boolean).join(" ")}>
      <button
        type="button"
        className="bz-activity-button"
        aria-expanded={open}
        aria-controls={panelId}
        data-busy={busy || undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="bz-activity-dot" aria-hidden="true" />
        <span>{busy ? `${snapshot.inFlight} running` : label}</span>
        {snapshot.unread > 0 && !open ? <span className="bz-activity-badge" aria-label={`${snapshot.unread} new`}>{snapshot.unread > 9 ? "9+" : snapshot.unread}</span> : null}
      </button>
      {open ? (
        <div id={panelId} className="bz-activity-panel" role="dialog" aria-label="Recent activity">
          <header className="bz-activity-head">
            <strong>Recent activity</strong>
            {snapshot.history.length ? <button type="button" onClick={() => pulse.clearHistory()}>Clear</button> : null}
          </header>
          {snapshot.items.some((item) => item.tone === "pending" && !item.leaving) ? (
            <ul className="bz-activity-list bz-activity-live">
              {snapshot.items.filter((item) => item.tone === "pending" && !item.leaving).map((item) => (
                <li key={item.id} data-tone="pending">
                  <span className="bz-activity-tone" aria-hidden="true" />
                  <div><p>{item.title}</p><small>In progress · {formatPulseElapsed(now - item.startedAt)}</small></div>
                </li>
              ))}
            </ul>
          ) : null}
          {snapshot.history.length ? (
            <ul className="bz-activity-list">
              {snapshot.history.map((entry) => (
                <li key={entry.id} data-tone={entry.tone}>
                  <span className="bz-activity-tone" aria-hidden="true" />
                  <div>
                    <p>{entry.title}</p>
                    <small>{[entry.scope, entry.detail, formatPulseAgo(entry.at, now)].filter(Boolean).join(" · ")}</small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="bz-activity-empty">Nothing yet. Confirmations and alerts from this session appear here.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Wraps an async command with pulse tracking and per-call busy state.
 * `isBusy(key)` lets list rows show their own in-flight state.
 */
export function usePulseAction<A extends unknown[], T>(
  work: (...args: A) => Promise<T>,
  options: PulseTrackOptions<T> | ((...args: A) => PulseTrackOptions<T>),
) {
  const workRef = useRef(work);
  const optionsRef = useRef(options);
  workRef.current = work;
  optionsRef.current = options;
  const [busyKeys, setBusyKeys] = useState<readonly string[]>([]);

  const run = useCallback(async (...args: A): Promise<T | undefined> => {
    const resolved = typeof optionsRef.current === "function" ? optionsRef.current(...args) : optionsRef.current;
    const busyKey = resolved.key ?? "__default";
    setBusyKeys((keys) => [...keys, busyKey]);
    try {
      return await pulse.run(() => workRef.current(...args), resolved);
    } finally {
      setBusyKeys((keys) => {
        const index = keys.indexOf(busyKey);
        return index < 0 ? keys : [...keys.slice(0, index), ...keys.slice(index + 1)];
      });
    }
  }, []);

  const isBusy = useCallback((key: string) => busyKeys.includes(key), [busyKeys]);
  return { run, busy: busyKeys.length > 0, isBusy };
}

export interface PulseButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  busy?: boolean | undefined;
  /** Label shown while busy, e.g. "Saving…". Defaults to the children. */
  busyLabel?: ReactNode | undefined;
}

/** A button that shows a spinner and stays disabled while its command runs. */
export function PulseButton({ busy = false, busyLabel, disabled, children, className, ...rest }: PulseButtonProps) {
  return (
    <button
      {...rest}
      className={["bz-busy-button", className].filter(Boolean).join(" ")}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      data-busy={busy || undefined}
    >
      {busy ? <span className="bz-busy-spinner" aria-hidden="true" /> : null}
      <span className="bz-busy-label">{busy ? busyLabel ?? children : children}</span>
    </button>
  );
}
