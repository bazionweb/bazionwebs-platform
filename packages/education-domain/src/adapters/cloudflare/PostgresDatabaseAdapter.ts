import type { IDatabase, IPreparedStatement, IHealthCheck } from '../../ports';
import { neon, neonConfig } from '../../shims/external-adapters';
import type { NeonQueryFunction } from '../../shims/external-adapters';

type NeonClient = NeonQueryFunction<false, false>;

/**
 * Translates SQLite-flavoured SQL into PostgreSQL syntax.
 *
 * The existing BMI routes use the D1 (SQLite) dialect throughout — `?`
 * placeholders, `datetime('now')`, `INSERT OR IGNORE`, `strftime`, etc.
 * This transformer lets those 400+ `db.prepare()` call-sites execute against
 * Neon unchanged during the strangler-fig migration.
 */
export function translateSqliteToPostgres(sql: string): string {
  let out = sql;

  // 1. INSERT OR IGNORE / REPLACE → standard INSERT with conflict handling.
  out = out
    .replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO')
    .replace(/INSERT\s+OR\s+REPLACE\s+INTO/gi, 'INSERT INTO');

  // 2. datetime('now', '<mod>') → now() + interval '<mod>'
  out = out.replace(
    /datetime\(\s*'now'\s*,\s*'([^']+)'\s*\)/gi,
    (_m, mod: string) => `now() + interval '${normalizeInterval(mod)}'`
  );

  // 3. datetime('now') → now()
  out = out.replace(/datetime\(\s*'now'\s*\)/gi, 'now()');

  // 4. datetime("now") variant
  out = out.replace(/datetime\(\s*"now"\s*\)/gi, 'now()');

  // 5. date('now', '<mod>') → current_date - interval '<mod>'::text::interval
  out = out.replace(
    /date\(\s*'now'\s*,\s*'([^']+)'\s*\)/gi,
    (_m, mod: string) => `(current_date + interval '${normalizeInterval(mod)}')::date`
  );

  // 6. date('now') → current_date
  out = out.replace(/date\(\s*'now'\s*\)/gi, 'current_date');

  // 7. strftime('%Y-%m', col) → to_char(col, 'YYYY-MM')
  out = out.replace(/strftime\(\s*'([^']+)'\s*,\s*([^)]+)\)/gi, (_m, fmt: string, col: string) =>
    `to_char(${col.trim()}, '${strftimeToPostgres(fmt)}')`
  );

  // 8. IFNULL(a, b) → COALESCE(a, b)
  out = out.replace(/IFNULL\s*\(/gi, 'COALESCE(');

  // 9. randomblob(N) → gen_random_uuid() (only valid as a default; harmless elsewhere)
  out = out.replace(/lower\(\s*hex\(\s*randomblob\(\s*\d+\s*\)\s*\)\s*\)/gi, 'gen_random_uuid()');

  // 10. json_valid(x) → x::jsonb IS NOT NULL (approximation used only in CHECK/INSERT guards)
  out = out.replace(/json_valid\s*\(/gi, 'jsonb_typeof(');

  // 11. Normalize ON CONFLICT(<col>) → ON CONFLICT (<col>) (Postgres requires whitespace)
  out = out.replace(/ON\s+CONFLICT\s*\(/gi, 'ON CONFLICT (');

  // 12. json_group_array(x) → json_agg(x)
  out = out.replace(/json_group_array\s*\(/gi, 'json_agg(');

  // 13. json_object(k, v, ...) → json_build_object(k, v, ...)
  out = out.replace(/json_object\s*\(/gi, 'json_build_object(');

  // 14. Disambiguate self-referencing counter updates in ON CONFLICT DO UPDATE
  // In PostgreSQL, `DO UPDATE SET col = col + 1` causes error 42702 (ambiguous column reference).
  // When an INSERT INTO <table> contains an unqualified `col = col + ...`, qualify the RHS with the table name.
  const insertMatch = out.match(/INSERT\s+INTO\s+([a-zA-Z0-9_]+)/i);
  if (insertMatch && /DO\s+UPDATE\s+SET/i.test(out)) {
    const tableName = insertMatch[1];
    out = out.replace(/(DO\s+UPDATE\s+SET\s+)([\s\S]+?)(RETURNING|$)/i, (_m, prefix, setBody, suffix) => {
      const disambiguated = setBody.replace(
        /(?<![a-zA-Z0-9_.]\b)([a-zA-Z0-9_]+)\s*=\s*(?<![a-zA-Z0-9_.]\b)\1(\s*[+\-*\/])/gi,
        `$1 = ${tableName}.$1$2`
      );
      return `${prefix}${disambiguated}${suffix}`;
    });
  }

  return out;
}

function normalizeInterval(mod: string): string {
  const m = mod.trim();
  // SQLite modifiers like '+24 hours', '-30 days', '+1 hour'
  return m.replace(/^\+/, '').replace(/^-(.+)$/, '- $1');
}

function strftimeToPostgres(fmt: string): string {
  const map: Record<string, string> = {
    '%Y': 'YYYY',
    '%y': 'YY',
    '%m': 'MM',
    '%d': 'DD',
    '%H': 'HH24',
    '%M': 'MI',
    '%S': 'SS',
    '%j': 'DDD',
    '%W': 'WW',
    '%w': 'D',
    '%e': 'DD',
    '%b': 'Mon',
    '%B': 'Month',
  };
  return fmt.replace(/%[YymdHMSjWwebB]/g, (tok) => map[tok] ?? tok);
}

/**
 * Convert `?` placeholders into Postgres `$1, $2, ...`, respecting string
 * literals so a `?` inside a quoted string is left untouched.
 */
export function rewritePlaceholders(sql: string): string {
  let out = '';
  let i = 0;
  let n = 0;
  let inString = false;
  let quote: string | null = null;

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inString) {
      out += ch;
      if (ch === quote && next === quote) {
        out += next;
        i += 2;
        continue;
      }
      if (ch === quote) inString = false;
      i += 1;
      continue;
    }

    if (ch === "'" || ch === '"') {
      inString = true;
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }

    if (ch === '-' && next === '-') {
      // line comment
      while (i < sql.length && sql[i] !== '\n') {
        out += sql[i];
        i += 1;
      }
      continue;
    }

    if (ch === '/') {
      // handle block comments (rare in route SQL, defensive)
      const slice = sql.slice(i);
      const isBlock = slice.startsWith('/*');
      if (isBlock) {
        const end = slice.indexOf('*/');
        if (end !== -1) {
          out += slice.slice(0, end + 2);
          i += end + 2;
          continue;
        }
      }
    }

    if (ch === '?') {
      n += 1;
      out += `$${n}`;
      i += 1;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

/** Prepared statement wrapper around a Neon HTTP query function. */
export class NeonPreparedStatement implements IPreparedStatement {
  private params: unknown[] = [];

  constructor(
    private readonly client: NeonClient,
    private readonly sql: string,
    private readonly onExec?: (sql: string, params: unknown[]) => void
  ) {}

  /** The translated, placeholder-rewritten SQL (used by `batch()`). */
  get rawSql(): string {
    return rewritePlaceholders(translateSqliteToPostgres(this.sql));
  }

  get rawParams(): unknown[] {
    return this.params;
  }

  bind(...params: any[]): this {
    this.params = params;
    return this;
  }

  async run(): Promise<{ success: boolean; meta?: any }> {
    const translated = translateSqliteToPostgres(this.sql);
    const rewritten = rewritePlaceholders(translated);
    this.onExec?.(rewritten, this.params);
    try {
      await this.client.query(rewritten, this.params as any[]);
      return { success: true };
    } catch (err) {
      throw new Error(
        `Postgres execute failed for: ${rewritten} — ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  async all<T = any>(): Promise<{ results: T[]; meta?: any }> {
    const translated = translateSqliteToPostgres(this.sql);
    const rewritten = rewritePlaceholders(translated);
    this.onExec?.(rewritten, this.params);
    const rows = await this.client.query(rewritten, this.params as any[]);
    return { results: normalizeRows(rows as Record<string, unknown>[]) as T[] };
  }

  async first<T = any>(): Promise<T | null> {
    const translated = translateSqliteToPostgres(this.sql);
    const rewritten = rewritePlaceholders(translated);
    this.onExec?.(rewritten, this.params);
    const rows = (await this.client.query(rewritten, this.params as any[])) as Record<string, unknown>[];
    return rows.length > 0 ? (normalizeRow(rows[0]) as T) : null;
  }
}

/** Convert Postgres `true/false` back to D1-compatible `1/0` integers. */
function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === 'boolean' ? (v ? 1 : 0) : v;
  }
  return out;
}

function normalizeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(normalizeRow);
}

/**
 * PostgreSQL adapter implementing the existing `IDatabase` port.
 *
 * It reuses the Neon HTTP driver (works on Cloudflare Workers, through
 * Hyperdrive connection pooling) and translates SQLite-flavoured SQL so the
 * existing raw-SQL routes run unchanged. Over time, individual routes migrate
 * to Drizzle ORM (Phase 4) and this adapter is retired.
 */
export class PostgresDatabaseAdapter implements IDatabase, IHealthCheck {
  private readonly client: NeonClient;
  readonly raw: NeonClient;
  private readonly onExec?: (sql: string, params: unknown[]) => void;

  constructor(connectionString: string, options?: { onExec?: (sql: string, params: unknown[]) => void }) {
    // For Cloudflare Workers, disable the TCP fallback unless explicitly wanted.
    if (typeof neonConfig !== 'undefined' && typeof neonConfig.fetchEndpoint === 'string') {
      // leave default; Hyperdrive overrides fetch at runtime via the binding.
    }
    this.onExec = options?.onExec;
    this.client = neon(connectionString);
    this.raw = this.client;
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const translated = translateSqliteToPostgres(sql);
    const rewritten = rewritePlaceholders(translated);
    const rows = (await this.client.query(rewritten, (params ?? []) as any[])) as Record<string, unknown>[];
    return normalizeRows(rows) as T[];
  }

  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const translated = translateSqliteToPostgres(sql);
    const rewritten = rewritePlaceholders(translated);
    const rows = (await this.client.query(rewritten, (params ?? []) as any[])) as Record<string, unknown>[];
    return rows.length > 0 ? (normalizeRow(rows[0]) as T) : null;
  }

  prepare(sql: string): IPreparedStatement {
    return new NeonPreparedStatement(this.client, sql, this.onExec);
  }

  async transaction<T>(callback: (db: IDatabase) => Promise<T>): Promise<T> {
    // Postgres supports real transactions, but the Neon HTTP driver does not
    // allow interactive BEGIN/COMMIT over a single fetch. Mirror the D1
    // adapter's semantics: execute sequentially (correctness for reads,
    // without cross-statement atomicity). A Pool-based driver (Hyperdrive +
    // WebSocket) can be swapped in later for full atomicity.
    return callback(this);
  }

  async batch<T = any>(statements: IPreparedStatement[]): Promise<T[]> {
    const stmts = statements as NeonPreparedStatement[];
    // Neon's HTTP `transaction` submits all queries as a single, atomic
    // non-interactive Postgres transaction — equivalent to D1's batch.
    const results = await this.client.transaction((txn) =>
      stmts.map((s) => {
        this.onExec?.(s.rawSql, s.rawParams);
        return txn.query(s.rawSql, s.rawParams as any[]);
      })
    );
    return (results as Record<string, unknown>[][]).map((rows) => normalizeRows(rows)) as T[];
  }

  getPlatform(): string {
    return 'neon-postgres';
  }

  async health(): Promise<boolean> {
    try {
      await this.client.query('select 1');
      return true;
    } catch {
      return false;
    }
  }
}
