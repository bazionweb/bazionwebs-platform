/**
 * Structured JSON Logger — H-03 (Sprint 1 Observability)
 *
 * Emits newline-delimited JSON to stdout, picked up by Cloudflare Workers
 * Logpush (Workers Trace Events). Every log line is machine-parseable and
 * can be forwarded to Datadog, Loki, or any SIEM without regex parsing.
 *
 * Fields emitted on every line:
 *   ts         — ISO-8601 timestamp (UTC)
 *   level      — "debug" | "info" | "warn" | "error"
 *   worker     — worker name (set once at module init, e.g. "bmi-auth")
 *   msg        — human-readable message string
 *   ...context — arbitrary key/value pairs passed by the caller
 *
 * Usage:
 *   import { createLogger } from '@bmi/api-middleware';
 *   const log = createLogger('bmi-auth');
 *   log.info('User registered', { userId, email });
 *   log.error('D1 write failed', { err: err.message, table: 'users' });
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  ts: string;
  level: LogLevel;
  worker: string;
  msg: string;
  [key: string]: unknown;
}

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

/**
 * Keys whose values are automatically replaced with '[REDACTED]' before logging.
 * Add any new PII fields here as the schema grows.
 */
const SENSITIVE_KEYS = new Set([
  'email', 'password', 'token', 'secret', 'studentId', 'student_id',
  'name', 'first_name', 'last_name', 'phone', 'address',
  'refresh_token', 'access_token', 'jwt', 'authorization', 'cookie',
  'pepper', 'PASSWORD_PEPPER', 'JWT_SECRET', 'RESEND_API_KEY',
  'WEBHOOK_SECRET', 'BACKUP_ENCRYPTION_KEY',
]);

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k)) {
      out[k] = '[REDACTED]';
    } else if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = redact(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Minimum level to emit. Set to 'debug' in dev via LOG_LEVEL env var. */
let MIN_LEVEL: LogLevel = 'info';

function emit(level: LogLevel, worker: string, msg: string, context: Record<string, unknown>) {
  if (LEVELS[level] < LEVELS[MIN_LEVEL]) return;

  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    worker,
    msg,
    ...redact(context), // ← PII fields are masked before writing
  };

  const line = JSON.stringify(entry);

  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export interface Logger {
  debug(msg: string, context?: Record<string, unknown>): void;
  info(msg: string, context?: Record<string, unknown>): void;
  warn(msg: string, context?: Record<string, unknown>): void;
  error(msg: string, context?: Record<string, unknown>): void;
  /** Return a child logger with extra fields merged into every entry. */
  child(extra: Record<string, unknown>): Logger;
}

/**
 * Create a structured logger bound to a specific worker name.
 * Call once at module init, reuse the instance everywhere.
 *
 * @param workerName  Logical name, e.g. "bmi-auth"
 * @param minLevel    Optional override (default: "info")
 */
export function createLogger(workerName: string): Logger {
  function makeLogger(defaults: Record<string, unknown> = {}): Logger {
    return {
      debug: (msg, ctx = {}) => emit('debug', workerName, msg, { ...defaults, ...ctx }),
      info:  (msg, ctx = {}) => emit('info',  workerName, msg, { ...defaults, ...ctx }),
      warn:  (msg, ctx = {}) => emit('warn',  workerName, msg, { ...defaults, ...ctx }),
      error: (msg, ctx = {}) => emit('error', workerName, msg, { ...defaults, ...ctx }),
      child: (extra) => makeLogger({ ...defaults, ...extra }),
    };
  }

  return makeLogger();
}

/**
 * Request-scoped logger factory.
 * Automatically injects method, path, and CF ray ID into every log entry.
 *
 * Usage (in fetch handler):
 *   const rlog = requestLogger(log, request);
 *   rlog.info('Route matched');
 */
export function requestLogger(base: Logger, request: Request): Logger {
  const url = new URL(request.url);
  return base.child({
    method: request.method,
    path: url.pathname,
    ray: request.headers.get('CF-Ray') ?? undefined,
  });
}
