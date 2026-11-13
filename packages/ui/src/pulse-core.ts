/**
 * Bazion Pulse — the shared command-feedback engine for every Bazion surface.
 *
 * Every user command should produce a visible "pulse": an in-flight signal
 * while work runs, and a confirmation (or an explained failure) when it ends.
 * This module is framework-agnostic (no React import) so it can be called from
 * components, data-layer interceptors and plain event handlers alike. The same
 * file is mirrored into the Bazionweb commercial app so both systems speak the
 * same feedback language.
 *
 * Intelligence built in:
 * - Error insight: reads HTTP status, server `message`/`code` shapes (Nest,
 *   Fastify, Better Auth, axios, fetch) and network/timeout failures, then
 *   explains what happened and what to do next in plain language.
 * - Adaptive patience: in-flight pulses escalate their wording when work is
 *   slower than expected, and show an elapsed timer.
 * - Reading-time dwell: notifications stay long enough to be read, pause on
 *   hover/focus and while the tab is hidden.
 * - Coalescing: repeated identical messages merge into one with a ×N counter.
 * - Double-submit guard: keyed commands that are already running are not
 *   started twice.
 * - Recovery affordances: retryable failures offer "Try again"; expired
 *   sessions offer "Sign in"; reversible commands can offer "Undo".
 * - Session activity log so users can review what happened.
 */

export type PulseTone = "pending" | "success" | "error" | "warning" | "info";
export type PulseSettledTone = Exclude<PulseTone, "pending">;

export interface PulseAction {
  label: string;
  onAction: () => void | Promise<unknown>;
  /** Dismiss the pulse after the action runs. Defaults to true. */
  dismiss?: boolean | undefined;
}

export interface PulseOptions {
  /** Reuse an id to morph an existing pulse (e.g. pending → success). */
  id?: string | undefined;
  detail?: string | undefined;
  hint?: string | undefined;
  /** Short eyebrow describing the area, e.g. "Sermons" or "Billing". */
  scope?: string | undefined;
  /** Messages sharing a key replace each other instead of stacking. */
  key?: string | undefined;
  /** Milliseconds before auto-dismiss. 0 keeps the pulse until dismissed. */
  duration?: number | undefined;
  /** Friendly alias for duration */
  dwellMs?: number | undefined;
  action?: PulseAction | undefined;
}

export interface PulseItem {
  id: string;
  tone: PulseTone;
  title: string;
  detail: string | undefined;
  hint: string | undefined;
  scope: string | undefined;
  key: string | undefined;
  action: PulseAction | undefined;
  count: number;
  createdAt: number;
  startedAt: number;
  /** Pending escalation stage: 0 normal, 1 slower than usual, 2 very slow. */
  stage: 0 | 1 | 2;
  duration: number;
  remaining: number;
  paused: boolean;
  leaving: boolean;
  /** Increments whenever the dwell timer restarts (used to restart CSS). */
  cycle: number;
}

export interface PulseHistoryEntry {
  id: string;
  tone: PulseSettledTone;
  title: string;
  detail: string | undefined;
  scope: string | undefined;
  at: number;
}

export interface PulseConfirmOptions {
  title: string;
  message?: string | undefined;
  /** Friendly alias for message */
  detail?: string | undefined;
  tone?: "danger" | "warning" | "neutral" | undefined;
  /** Friendly alias for tone: "danger" */
  danger?: boolean | undefined;
  confirmLabel?: string | undefined;
  cancelLabel?: string | undefined;
  /** Bullet list of what will happen; shown prominently for destructive work. */
  consequences?: string[] | undefined;
  /** Require the user to type this exact text before confirming. */
  requireText?: string | undefined;
}

export interface PulseConfirmRequest extends PulseConfirmOptions {
  id: string;
}

export interface PulseAnnouncement {
  polite: string;
  assertive: string;
  seq: number;
}

export interface PulseSnapshot {
  items: PulseItem[];
  history: PulseHistoryEntry[];
  unread: number;
  inFlight: number;
  confirm: PulseConfirmRequest | null;
  announcement: PulseAnnouncement;
}

export interface PulseErrorInsight {
  title: string;
  detail: string | undefined;
  hint: string | undefined;
  retryable: boolean;
  /** True when the user must sign in again to continue. */
  signIn: boolean;
  status: number | undefined;
  code: string | undefined;
}

export type PulseWork<T> = Promise<T> | (() => Promise<T>);

export interface PulseTrackOptions<T> {
  /** In-flight wording, e.g. "Saving sermon…". */
  pending?: string | undefined;
  /** Friendly alias for pending. */
  title?: string | undefined;
  pendingDetail?: string | undefined;
  /** Success wording; `false` hides the success pulse (the pending one clears). */
  success?: string | false | ((value: T) => string) | undefined;
  /** Friendly alias for success. */
  successTitle?: string | false | ((value: T) => string) | undefined;
  successDetail?: string | ((value: T) => string | undefined) | undefined;
  /** Failure title; the insight explains the cause underneath. */
  error?: string | ((insight: PulseErrorInsight, error: unknown) => string) | undefined;
  scope?: string | undefined;
  /** Friendly alias for scope. */
  group?: string | undefined;
  /** Prevents the same command from running twice concurrently. */
  key?: string | undefined;
  id?: string | undefined;
  /** Offer "Try again" on retryable failures. Defaults to true for functions. */
  retry?: boolean | undefined;
  /** Where "Sign in" sends the user when the session has expired. */
  signInHref?: string | undefined;
  undo?: {
    label?: string | undefined;
    onUndo: () => Promise<unknown>;
    success?: string | undefined;
  } | undefined;
}

type Timer = ReturnType<typeof setTimeout>;

const MAX_ITEMS = 5;
const MAX_HISTORY = 40;
const HISTORY_STORAGE_KEY = "bazion.pulse.history.v1";
const LEAVE_MS = 260;
const STAGE_ONE_MS = 4_000;
const STAGE_TWO_MS = 12_000;
const REPORTED = Symbol.for("bazion.pulse.reported");

const EMPTY_SNAPSHOT: PulseSnapshot = Object.freeze({
  items: [],
  history: [],
  unread: 0,
  inFlight: 0,
  confirm: null,
  announcement: { polite: "", assertive: "", seq: 0 },
}) as PulseSnapshot;

let sequence = 0;
function createId(prefix = "pulse"): string {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence.toString(36)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function countWords(...parts: Array<string | undefined>): number {
  return parts.join(" ").trim().split(/\s+/).filter(Boolean).length;
}

/** Reading-time based dwell so longer explanations stay on screen longer. */
export function computePulseDuration(
  tone: PulseTone,
  title: string,
  detail?: string,
  hasAction = false,
): number {
  if (tone === "pending") return 0;
  const base = tone === "error" ? 6_500 : tone === "warning" ? 5_500 : tone === "info" ? 4_500 : 3_800;
  const reading = countWords(title, detail) * 230;
  const withAction = hasAction ? 3_000 : 0;
  return Math.min(16_000, Math.max(3_200, base + reading + withAction));
}

export function pendingStageLabel(stage: 0 | 1 | 2): string {
  if (stage === 2) return "Taking longer than usual — keep working, we’ll let you know.";
  if (stage === 1) return "Still working on it…";
  return "Working…";
}

export function formatPulseElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
}

export function formatPulseAgo(at: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

// ─── Error insight ──────────────────────────────────────────────────────────

/** Error thrown by `assertOk` that keeps the parsed response body. */
export class PulseHttpError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(status: number, data: unknown, message?: string) {
    super(message ?? `Request failed with status ${status}`);
    this.name = "PulseHttpError";
    this.status = status;
    this.data = data;
  }
}

/** Throws a `PulseHttpError` (with the parsed body) when a fetch response is not ok. */
export async function assertOk(response: Response): Promise<Response> {
  if (response.ok) return response;
  let data: unknown = null;
  try {
    const text = await response.clone().text();
    if (text) {
      try {
        data = JSON.parse(text) as unknown;
      } catch {
        data = text;
      }
    }
  } catch {
    data = null;
  }
  throw new PulseHttpError(response.status, data, extractServerMessage(data));
}

const GENERIC_HTTP_PHRASES = /^(bad request|not found|forbidden|unauthorized|conflict|internal server error|service unavailable|too many requests|unprocessable entity|request failed.*|network error)$/i;

export function extractServerMessage(data: unknown, depth = 0): string | undefined {
  if (depth > 3 || data === null || data === undefined) return undefined;
  if (typeof data === "string") {
    const text = data.trim();
    if (!text || text.length > 280 || text.startsWith("<") || GENERIC_HTTP_PHRASES.test(text)) return undefined;
    return text;
  }
  if (!isRecord(data)) return undefined;
  const message = data.message;
  if (typeof message === "string" && message.trim() && !GENERIC_HTTP_PHRASES.test(message.trim())) return message.trim();
  if (Array.isArray(message)) {
    const parts = message.filter((part): part is string => typeof part === "string" && part.trim().length > 0);
    if (parts.length) return parts.slice(0, 3).join(" · ");
  }
  const nested = data.error;
  if (typeof nested === "string") {
    const text = nested.trim();
    if (text && !GENERIC_HTTP_PHRASES.test(text)) return text;
  } else if (isRecord(nested)) {
    const inner = extractServerMessage(nested, depth + 1);
    if (inner) return inner;
  }
  if (typeof data.detail === "string" && data.detail.trim()) return data.detail.trim();
  if (Array.isArray(data.issues)) {
    const issues = data.issues
      .map((issue) => (isRecord(issue) && typeof issue.message === "string" ? issue.message : undefined))
      .filter((issue): issue is string => Boolean(issue));
    if (issues.length) return issues.slice(0, 3).join(" · ");
  }
  return undefined;
}

function extractServerCode(data: unknown): string | undefined {
  if (!isRecord(data)) return undefined;
  if (typeof data.code === "string" && /^[A-Z][A-Z0-9_]{2,}$/.test(data.code)) return data.code;
  if (isRecord(data.error)) return extractServerCode(data.error);
  return undefined;
}

function humanizeCode(code: string): string {
  const words = code.toLowerCase().split("_").filter(Boolean).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

interface InsightTemplate {
  title: string;
  hint?: string;
  retryable?: boolean;
  signIn?: boolean;
}

const CODE_INSIGHTS: Record<string, InsightTemplate> = {
  SANDBOX_IMPERSONATION_FORBIDDEN: { title: "Sandbox sessions are read-only", hint: "Exit the support sandbox to make changes." },
  SANDBOX_MUTATION_BLOCKED: { title: "Sandbox sessions are read-only", hint: "Exit the support sandbox to make changes." },
  PERMISSION_DENIED: { title: "You don’t have permission for that", hint: "Ask a workspace owner to update your role." },
  TENANT_MEMBERSHIP_REQUIRED: { title: "Choose a workspace first", hint: "Open your workspace list and select one to continue." },
  CHURCH_MODULE_DISABLED: { title: "This feature is switched off", hint: "A platform administrator can enable it for this workspace." },
  TENANT_MAINTENANCE: { title: "Maintenance in progress", hint: "Changes will be available again shortly.", retryable: true },
  TENANT_NOT_FOUND: { title: "We couldn’t find this workspace", hint: "Check the address or contact support." },
  RATE_LIMITED: { title: "Too many attempts", hint: "Wait a minute, then try again.", retryable: true },
  RATE_LIMIT_RESET_UNAVAILABLE: { title: "Reset isn’t supported here", hint: "Limits clear automatically after their window expires." },
  CUSTOMER_LOCAL_AUTH_DISABLED: { title: "Sign in with Bazion ID", hint: "Password sign-in has moved to the secure Bazion identity portal." },
  STAFF_LOCAL_AUTH_DISABLED: { title: "Staff password sign-in is disabled", hint: "Use your organisation’s single sign-on." },
  PLATFORM_SSOT_AUTHORITATIVE: { title: "Managed by Bazion Platform", hint: "Make hosting changes in the Platform control plane." },
  LEGACY_PROVISIONING_BLOCKED: { title: "Managed by Bazion Platform", hint: "Make hosting changes in the Platform control plane." },
  IDEMPOTENCY_CONFLICT: { title: "That reference was already used differently", hint: "Refresh to see the latest state before trying again." },
  INVALID_CREDENTIALS: { title: "Email or password didn’t match", hint: "Check for typos or reset your password." },
  INVALID_EMAIL_OR_PASSWORD: { title: "Email or password didn’t match", hint: "Check for typos or reset your password." },
  EMAIL_NOT_VERIFIED: { title: "Verify your email first", hint: "Open the verification link we sent, then sign in." },
  SESSION_EXPIRED: { title: "Your session has ended", hint: "Sign in again to continue.", signIn: true },
};

function statusInsight(status: number): InsightTemplate {
  if (status === 400) return { title: "Something in the request needs attention", hint: "Check the details you entered and try again." };
  if (status === 401) return { title: "Your session has ended", hint: "Sign in again to continue.", signIn: true };
  if (status === 403) return { title: "You don’t have access to that", hint: "Ask a workspace owner if you need permission." };
  if (status === 404) return { title: "We couldn’t find that", hint: "It may have moved or been removed. Refresh to see the latest." };
  if (status === 408) return { title: "The request timed out", hint: "Your connection may be slow. Try again.", retryable: true };
  if (status === 409) return { title: "That conflicts with the latest changes", hint: "Refresh to see the current state, then try again." };
  if (status === 413) return { title: "That upload is too large", hint: "Choose a smaller file and try again." };
  if (status === 415) return { title: "That file type isn’t supported", hint: "Use a supported format and try again." };
  if (status === 422) return { title: "A few details need fixing", hint: "Review the highlighted fields and try again." };
  if (status === 429) return { title: "Too many attempts in a short time", hint: "Pause for a minute, then try again.", retryable: true };
  if (status === 501) return { title: "That action isn’t available yet", hint: "This capability hasn’t been enabled on the server." };
  if (status === 502 || status === 504) return { title: "A connected service didn’t respond", hint: "Nothing was lost. Try again in a moment.", retryable: true };
  if (status === 503) return { title: "The service is briefly unavailable", hint: "Please try again shortly.", retryable: true };
  if (status >= 500) return { title: "Our servers hit a snag", hint: "Nothing was lost on your side. Try again in a moment.", retryable: true };
  return { title: "The request couldn’t be completed", hint: "Try again, or contact support if it keeps happening." };
}

function isUselessMessage(message: string | undefined): boolean {
  if (!message) return true;
  const text = message.trim();
  return !text
    || GENERIC_HTTP_PHRASES.test(text)
    || /^request failed with status( code)? \d+/i.test(text)
    || /^(failed to fetch|load failed|networkerror.*|timeout of \d+ms exceeded|\[object object\])$/i.test(text);
}

/** Explains an unknown failure in human terms with a next step. */
export function interpretError(error: unknown): PulseErrorInsight {
  let status: number | undefined;
  let data: unknown;
  let transportCode: string | undefined;
  const rawMessage = error instanceof Error ? error.message : typeof error === "string" ? error : undefined;
  const name = isRecord(error) && typeof error.name === "string" ? error.name : undefined;

  if (error instanceof PulseHttpError) {
    status = error.status;
    data = error.data;
  } else if (isRecord(error)) {
    const response = error.response;
    if (isRecord(response) && typeof response.status === "number") {
      status = response.status;
      data = response.data;
    } else if (typeof error.status === "number") {
      status = error.status;
      data = error.data ?? error.body ?? error;
    } else if (typeof error.statusCode === "number") {
      status = error.statusCode;
      data = error;
    } else if (error.error !== undefined || typeof error.message === "string") {
      data = error;
    }
    if (typeof error.code === "string") transportCode = error.code;
  }

  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const timedOut = name === "AbortError" || name === "TimeoutError" || transportCode === "ECONNABORTED" || transportCode === "ETIMEDOUT"
    || /timeout|timed out/i.test(rawMessage ?? "");
  const networkFailure = transportCode === "ERR_NETWORK"
    || (status === undefined && error instanceof TypeError && /fetch|network|load failed/i.test(rawMessage ?? ""));

  if (status === undefined && (offline || networkFailure)) {
    return offline
      ? { title: "You’re offline", detail: "Your device lost its connection before the request was sent.", hint: "Reconnect, then try again — nothing was changed.", retryable: true, signIn: false, status, code: "OFFLINE" }
      : { title: "We couldn’t reach the server", detail: undefined, hint: "Check your connection and try again.", retryable: true, signIn: false, status, code: "NETWORK" };
  }
  if (status === undefined && timedOut) {
    return { title: "That took too long to respond", detail: undefined, hint: "The server may be busy. Try again in a moment.", retryable: true, signIn: false, status, code: "TIMEOUT" };
  }

  const serverMessage = extractServerMessage(data);
  const code = extractServerCode(data) ?? (transportCode && /^[A-Z][A-Z0-9_]{2,}$/.test(transportCode) && !transportCode.startsWith("ERR_") ? transportCode : undefined);
  const template = (code ? CODE_INSIGHTS[code] : undefined) ?? (status !== undefined ? statusInsight(status) : undefined);

  if (template) {
    const detail = serverMessage && serverMessage !== template.title ? serverMessage : undefined;
    return {
      title: template.title,
      detail,
      hint: template.hint,
      retryable: template.retryable ?? false,
      signIn: template.signIn ?? false,
      status,
      code,
    };
  }

  const message = serverMessage ?? (isUselessMessage(rawMessage) ? undefined : rawMessage?.trim());
  if (message) {
    return { title: message, detail: undefined, hint: undefined, retryable: false, signIn: false, status, code };
  }
  if (code) {
    return { title: humanizeCode(code), detail: undefined, hint: undefined, retryable: false, signIn: false, status, code };
  }
  return {
    title: "Something went wrong",
    detail: undefined,
    hint: "Try again. If it keeps happening, contact support.",
    retryable: true,
    signIn: false,
    status,
    code,
  };
}

/** Marks an error as already shown so global safety nets don't repeat it. */
export function markPulseReported(error: unknown): void {
  if (!isRecord(error)) return;
  try {
    Object.defineProperty(error, REPORTED, { value: true, enumerable: false, configurable: true });
  } catch {
    // Frozen errors simply aren't marked.
  }
}

export function isPulseReported(error: unknown): boolean {
  return isRecord(error) && (error as Record<symbol, unknown>)[REPORTED] === true;
}

function stripEllipsis(text: string): string {
  return text.replace(/(…|\.\.\.)\s*$/, "").trim();
}

// ─── Store ──────────────────────────────────────────────────────────────────

export class PulseStore {
  private snapshot: PulseSnapshot = EMPTY_SNAPSHOT;
  private readonly listeners = new Set<() => void>();
  private readonly dismissTimers = new Map<string, Timer>();
  private readonly stageTimers = new Map<string, Timer[]>();
  private readonly deadlines = new Map<string, number>();
  private readonly confirmQueue: Array<{ request: PulseConfirmRequest; resolve: (ok: boolean) => void }> = [];
  private readonly inflight = new Map<string, Promise<unknown>>();
  private hydrated = false;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    this.hydrate();
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): PulseSnapshot => this.snapshot;

  readonly getServerSnapshot = (): PulseSnapshot => EMPTY_SNAPSHOT;

  private emit(patch: Partial<PulseSnapshot>): void {
    const next = { ...this.snapshot, ...patch };
    next.inFlight = next.items.filter((item) => item.tone === "pending" && !item.leaving).length;
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }

  private announce(tone: PulseTone, title: string, detail?: string): PulseAnnouncement {
    const previous = this.snapshot.announcement;
    const marker = previous.seq % 2 === 0 ? "\u200b" : "";
    const text = `${title}${detail ? `. ${detail}` : ""}${marker}`;
    return tone === "error"
      ? { polite: previous.polite, assertive: text, seq: previous.seq + 1 }
      : { polite: text, assertive: previous.assertive, seq: previous.seq + 1 };
  }

  private hydrate(): void {
    if (this.hydrated || typeof window === "undefined") return;
    this.hydrated = true;
    try {
      const raw = window.sessionStorage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const history = parsed
        .filter((entry): entry is PulseHistoryEntry => isRecord(entry) && typeof entry.id === "string" && typeof entry.title === "string" && typeof entry.at === "number")
        .slice(0, MAX_HISTORY);
      if (history.length) this.emit({ history: [...this.snapshot.history, ...history].slice(0, MAX_HISTORY) });
    } catch {
      // Storage can be unavailable (private mode); history is best-effort.
    }
  }

  private persistHistory(history: PulseHistoryEntry[]): void {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Ignore quota/storage errors.
    }
  }

  private record(item: PulseItem): void {
    if (item.tone === "pending") return;
    const entry: PulseHistoryEntry = {
      id: `${item.id}:${item.cycle}`,
      tone: item.tone,
      title: item.title,
      detail: item.detail,
      scope: item.scope,
      at: Date.now(),
    };
    const history = [entry, ...this.snapshot.history.filter((existing) => existing.id !== entry.id)].slice(0, MAX_HISTORY);
    this.persistHistory(history);
    this.emit({ history, unread: this.snapshot.unread + 1 });
  }

  private clearTimers(id: string): void {
    const dismissTimer = this.dismissTimers.get(id);
    if (dismissTimer) clearTimeout(dismissTimer);
    this.dismissTimers.delete(id);
    for (const timer of this.stageTimers.get(id) ?? []) clearTimeout(timer);
    this.stageTimers.delete(id);
    this.deadlines.delete(id);
  }

  private arm(item: PulseItem): void {
    this.clearTimers(item.id);
    if (item.tone === "pending") {
      const elapsed = Date.now() - item.startedAt;
      const timers: Timer[] = [];
      if (item.stage < 1) timers.push(setTimeout(() => this.setStage(item.id, 1), Math.max(0, STAGE_ONE_MS - elapsed)));
      if (item.stage < 2) timers.push(setTimeout(() => this.setStage(item.id, 2), Math.max(0, STAGE_TWO_MS - elapsed)));
      this.stageTimers.set(item.id, timers);
      return;
    }
    if (item.duration > 0 && !item.paused) {
      this.deadlines.set(item.id, Date.now() + item.remaining);
      this.dismissTimers.set(item.id, setTimeout(() => this.dismiss(item.id), item.remaining));
    }
  }

  private setStage(id: string, stage: 1 | 2): void {
    const items = this.snapshot.items.map((item) => (item.id === id && item.tone === "pending" && item.stage < stage ? { ...item, stage } : item));
    this.emit({ items });
  }

  private find(id: string): PulseItem | undefined {
    return this.snapshot.items.find((item) => item.id === id && !item.leaving);
  }

  show(tone: PulseTone, title: string, options: PulseOptions = {}): string {
    const now = Date.now();
    const existingById = options.id ? this.find(options.id) : undefined;
    if (existingById) return this.morph(existingById, tone, title, options, false);

    const twin = this.snapshot.items.find((item) => !item.leaving && (options.key
      ? item.key === options.key
      : tone !== "pending" && item.tone === tone && item.title === title && item.detail === options.detail));
    if (twin) {
      const sameMessage = twin.tone === tone && twin.title === title;
      return this.morph(twin, tone, title, options, sameMessage);
    }

    const duration = options.duration ?? options.dwellMs ?? computePulseDuration(tone, title, options.detail, Boolean(options.action));
    const item: PulseItem = {
      id: options.id ?? createId(),
      tone,
      title,
      detail: options.detail,
      hint: options.hint,
      scope: options.scope,
      key: options.key,
      action: options.action,
      count: 1,
      createdAt: now,
      startedAt: now,
      stage: 0,
      duration,
      remaining: duration,
      paused: false,
      leaving: false,
      cycle: 0,
    };

    let items = [item, ...this.snapshot.items];
    const active = items.filter((candidate) => !candidate.leaving);
    if (active.length > MAX_ITEMS) {
      const overflow = active
        .slice(MAX_ITEMS)
        .filter((candidate) => candidate.tone !== "pending")
        .map((candidate) => candidate.id);
      for (const id of overflow) this.clearTimers(id);
      items = items.filter((candidate) => !overflow.includes(candidate.id));
    }

    this.emit({ items, announcement: this.announce(tone, title, options.detail) });
    this.arm(item);
    this.record(item);
    return item.id;
  }

  private morph(current: PulseItem, tone: PulseTone, title: string, options: PulseOptions, bump: boolean): string {
    const duration = options.duration ?? options.dwellMs ?? computePulseDuration(tone, title, options.detail, Boolean(options.action));
    const next: PulseItem = {
      ...current,
      tone,
      title,
      detail: "detail" in options ? options.detail : bump ? current.detail : undefined,
      hint: "hint" in options ? options.hint : bump ? current.hint : undefined,
      scope: options.scope ?? current.scope,
      key: options.key ?? current.key,
      action: "action" in options ? options.action : bump ? current.action : undefined,
      count: bump ? current.count + 1 : current.count,
      startedAt: tone === "pending" && current.tone !== "pending" ? Date.now() : current.startedAt,
      stage: tone === "pending" ? (current.tone === "pending" ? current.stage : 0) : 0,
      duration,
      remaining: duration,
      paused: false,
      cycle: current.cycle + 1,
    };
    const items = this.snapshot.items.map((item) => (item.id === current.id ? next : item));
    this.emit({ items, announcement: this.announce(tone, title, next.detail) });
    this.arm(next);
    this.record(next);
    return next.id;
  }

  update(id: string, tone: PulseTone, title: string, options: PulseOptions = {}): string {
    return this.show(tone, title, { ...options, id });
  }

  dismiss(id: string): void {
    const item = this.find(id);
    if (!item) return;
    this.clearTimers(id);
    this.emit({ items: this.snapshot.items.map((candidate) => (candidate.id === id ? { ...candidate, leaving: true } : candidate)) });
    setTimeout(() => {
      this.emit({ items: this.snapshot.items.filter((candidate) => candidate.id !== id || !candidate.leaving) });
    }, LEAVE_MS);
  }

  dismissAll(): void {
    for (const item of this.snapshot.items) this.dismiss(item.id);
  }

  pause(id: string): void {
    const item = this.find(id);
    if (!item || item.paused || item.tone === "pending" || item.duration === 0) return;
    const deadline = this.deadlines.get(id);
    const remaining = deadline ? Math.max(400, deadline - Date.now()) : item.remaining;
    this.clearTimers(id);
    this.emit({ items: this.snapshot.items.map((candidate) => (candidate.id === id ? { ...candidate, paused: true, remaining } : candidate)) });
  }

  resume(id: string): void {
    const item = this.find(id);
    if (!item || !item.paused) return;
    const resumed = { ...item, paused: false };
    this.emit({ items: this.snapshot.items.map((candidate) => (candidate.id === id ? resumed : candidate)) });
    this.arm(resumed);
  }

  pauseAll(): void {
    for (const item of this.snapshot.items) this.pause(item.id);
  }

  resumeAll(): void {
    for (const item of this.snapshot.items) this.resume(item.id);
  }

  async runAction(id: string): Promise<void> {
    const item = this.find(id);
    if (!item?.action) return;
    const { action } = item;
    if (action.dismiss !== false) this.dismiss(id);
    try {
      await action.onAction();
    } catch (error) {
      this.error(error, { title: `“${action.label}” didn’t work` });
    }
  }

  markRead(): void {
    if (this.snapshot.unread !== 0) this.emit({ unread: 0 });
  }

  clearHistory(): void {
    this.persistHistory([]);
    this.emit({ history: [], unread: 0 });
  }

  // ── Convenience tones ──
  success(title: string, options?: PulseOptions): string {
    return this.show("success", title, options);
  }

  info(title: string, options?: PulseOptions): string {
    return this.show("info", title, options);
  }

  warning(title: string, options?: PulseOptions): string {
    return this.show("warning", title, options);
  }

  pending(title: string, options?: PulseOptions): string {
    return this.show("pending", title, options);
  }

  /** Accepts a message or any thrown value; unknown errors are interpreted. */
  error(input: unknown, options: PulseOptions & { title?: string | undefined } = {}): string {
    const { title: callerTitle, ...rest } = options;
    if (typeof input === "string" && !callerTitle) return this.show("error", input, rest);
    const insight = interpretError(input);
    markPulseReported(input);
    const title = callerTitle ?? insight.title;
    const detail = rest.detail ?? (callerTitle ? insight.detail ?? insight.title : insight.detail);
    return this.show("error", title, { ...rest, detail, hint: rest.hint ?? insight.hint });
  }

  // ── Command tracking ──

  /** True while a keyed command started with `track`/`run` is still running. */
  isRunning(key: string): boolean {
    return this.inflight.has(key);
  }

  /**
   * Shows an in-flight pulse, then morphs it into a confirmation or an
   * explained failure. Rejects with the original error (already reported).
   */
  track<T>(work: PulseWork<T>, options: PulseTrackOptions<T>): Promise<T> {
    const runner: () => Promise<T> = typeof work === "function" ? work : () => work;
    const pendingText = options.pending ?? options.title ?? "Working…";
    const scope = options.scope ?? options.group;
    const successOpt = options.success !== undefined ? options.success : options.successTitle;

    if (options.key) {
      const running = this.inflight.get(options.key);
      if (running) {
        this.show("info", "Already on it", {
          detail: `${stripEllipsis(pendingText)} is still in progress.`,
          scope,
          key: `${options.key}:duplicate`,
        });
        return running as Promise<T>;
      }
    }

    const id = options.id ?? createId();
    this.show("pending", pendingText, {
      id,
      detail: options.pendingDetail,
      scope,
      key: options.key ? `track:${options.key}` : undefined,
    });

    const promise = (async () => {
      try {
        const value = await runner();
        if (successOpt === false) {
          this.dismiss(id);
        } else {
          const title = typeof successOpt === "function" ? successOpt(value) : successOpt ?? "Done";
          const detail = typeof options.successDetail === "function" ? options.successDetail(value) : options.successDetail;
          const undo = options.undo;
          this.update(id, "success", title, {
            detail,
            scope,
            action: undo
              ? {
                  label: undo.label ?? "Undo",
                  dismiss: false,
                  onAction: () => this.run(undo.onUndo, { id, pending: "Undoing…", success: undo.success ?? "Change undone", scope }),
                }
              : undefined,
            duration: undo ? Math.max(8_000, computePulseDuration("success", title, detail, true)) : undefined,
          });
        }
        return value;
      } catch (error) {
        const insight = interpretError(error);
        const title = typeof options.error === "function" ? options.error(insight, error) : options.error ?? insight.title;
        const callerTitled = title !== insight.title;
        const detail = callerTitled ? insight.detail ?? insight.title : insight.detail;
        const canRetry = (options.retry ?? typeof work === "function") && insight.retryable;
        const signInHref = options.signInHref;
        const action: PulseAction | undefined = canRetry
          ? { label: "Try again", dismiss: false, onAction: () => this.run(runner, { ...options, id }) }
          : insight.signIn && typeof window !== "undefined"
            ? { label: "Sign in", onAction: () => window.location.assign(signInHref ?? `/login?callbackURL=${encodeURIComponent(window.location.pathname)}`) }
            : undefined;
        this.update(id, "error", title, { detail, hint: insight.hint, scope, action });
        markPulseReported(error);
        throw error;
      } finally {
        if (options.key) this.inflight.delete(options.key);
      }
    })();

    if (options.key) this.inflight.set(options.key, promise);
    return promise;
  }

  /** Like `track` but never rejects: resolves `undefined` on failure. */
  async run<T>(work: PulseWork<T>, options: PulseTrackOptions<T>): Promise<T | undefined> {
    try {
      return await this.track(work, options);
    } catch {
      return undefined;
    }
  }

  // ── Confirmation ──

  confirm(options: PulseConfirmOptions): Promise<boolean> {
    if (typeof window === "undefined") return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      const normalized: PulseConfirmOptions = {
        ...options,
        message: options.message ?? options.detail,
        tone: options.tone ?? (options.danger ? "danger" : undefined),
      };
      const request: PulseConfirmRequest = { ...normalized, id: createId("confirm") };
      this.confirmQueue.push({ request, resolve });
      if (!this.snapshot.confirm) this.emit({ confirm: request });
    });
  }

  resolveConfirm(id: string, confirmed: boolean): void {
    const index = this.confirmQueue.findIndex((entry) => entry.request.id === id);
    if (index < 0) return;
    const [entry] = this.confirmQueue.splice(index, 1);
    entry?.resolve(confirmed);
    this.emit({ confirm: this.confirmQueue[0]?.request ?? null });
  }

  // ── Environment awareness ──

  /** Shows offline/online pulses. Returns an unsubscribe function. */
  watchConnectivity(): () => void {
    if (typeof window === "undefined") return () => undefined;
    const offline = () => {
      this.show("warning", "You’re offline", {
        key: "pulse:connectivity",
        detail: "We’ll keep your place. Actions will wait until you reconnect.",
        duration: 0,
      });
    };
    const online = () => {
      this.show("success", "Back online", { key: "pulse:connectivity", detail: "Your connection is restored." });
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    if (navigator.onLine === false) offline();
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }
}

export type PulseController = PulseStore;

/** The single shared pulse controller for this browser tab. */
export const pulse: PulseController = new PulseStore();

