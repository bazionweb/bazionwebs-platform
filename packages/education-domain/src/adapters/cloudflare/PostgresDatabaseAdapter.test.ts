import { describe, it, expect } from 'vitest';
import {
  translateSqliteToPostgres,
  rewritePlaceholders,
  NeonPreparedStatement,
} from './PostgresDatabaseAdapter';

describe('translateSqliteToPostgres', () => {
  it('converts datetime("now") to now()', () => {
    expect(translateSqliteToPostgres(`datetime('now')`)).toBe('now()');
    expect(translateSqliteToPostgres(`datetime("now")`)).toBe('now()');
  });

  it('converts datetime modifiers to intervals', () => {
    expect(translateSqliteToPostgres(`datetime('now', '+24 hours')`)).toBe(`now() + interval '24 hours'`);
    expect(translateSqliteToPostgres(`datetime('now', '-30 days')`)).toBe(`now() + interval '- 30 days'`);
    expect(translateSqliteToPostgres(`datetime('now', '+1 hour')`)).toBe(`now() + interval '1 hour'`);
  });

  it('converts date("now", modifiers) to current_date', () => {
    expect(translateSqliteToPostgres(`date('now', '-90 days')`)).toBe(`(current_date + interval '- 90 days')::date`);
    expect(translateSqliteToPostgres(`date('now')`)).toBe('current_date');
  });

  it('converts strftime to to_char', () => {
    expect(translateSqliteToPostgres(`strftime('%Y-%m', created_at)`)).toBe(`to_char(created_at, 'YYYY-MM')`);
  });

  it('converts INSERT OR IGNORE / REPLACE', () => {
    expect(translateSqliteToPostgres(`INSERT OR IGNORE INTO enrollments (id) VALUES (?)`)).toBe(
      `INSERT INTO enrollments (id) VALUES (?)`
    );
    expect(translateSqliteToPostgres(`INSERT OR REPLACE INTO t (id) VALUES (?)`)).toBe(
      `INSERT INTO t (id) VALUES (?)`
    );
  });

  it('converts IFNULL to COALESCE', () => {
    expect(translateSqliteToPostgres(`IFNULL(a, b)`)).toBe('COALESCE(a, b)');
  });

  it('normalizes ON CONFLICT whitespace', () => {
    expect(translateSqliteToPostgres(`ON CONFLICT(id) DO UPDATE SET x = excluded.x`)).toBe(
      `ON CONFLICT (id) DO UPDATE SET x = excluded.x`
    );
  });

  it('disambiguates self-referencing counter updates in ON CONFLICT DO UPDATE', () => {
    const input = `INSERT INTO application_number_counters (year, last_serial) VALUES (?, 1) ON CONFLICT(year) DO UPDATE SET last_serial = last_serial + 1 RETURNING last_serial`;
    const expected = `INSERT INTO application_number_counters (year, last_serial) VALUES (?, 1) ON CONFLICT (year) DO UPDATE SET last_serial = application_number_counters.last_serial + 1 RETURNING last_serial`;
    expect(translateSqliteToPostgres(input)).toBe(expected);
  });

  it('preserves already-qualified column references in ON CONFLICT DO UPDATE', () => {
    const input = `INSERT INTO application_number_counters (year, last_serial) VALUES (?, 1) ON CONFLICT(year) DO UPDATE SET last_serial = application_number_counters.last_serial + 1 RETURNING last_serial`;
    const expected = `INSERT INTO application_number_counters (year, last_serial) VALUES (?, 1) ON CONFLICT (year) DO UPDATE SET last_serial = application_number_counters.last_serial + 1 RETURNING last_serial`;
    expect(translateSqliteToPostgres(input)).toBe(expected);
  });
});

describe('rewritePlaceholders', () => {
  it('rewrites ? to $n in order', () => {
    expect(rewritePlaceholders('SELECT * FROM t WHERE a = ? AND b = ?')).toBe(
      'SELECT * FROM t WHERE a = $1 AND b = $2'
    );
  });

  it('does not rewrite ? inside string literals', () => {
    expect(rewritePlaceholders(`SELECT '?' AS q, ?`)).toBe(`SELECT '?' AS q, $1`);
  });

  it('preserves doubled single-quote escapes', () => {
    expect(rewritePlaceholders(`SELECT 'it''s ?', ?`)).toBe(`SELECT 'it''s ?', $1`);
  });
});

describe('NeonPreparedStatement.rawSql', () => {
  it('exposes translated and rewritten SQL for batch usage', () => {
    const client = { query: async () => [] as Record<string, unknown>[] } as any;
    const stmt = new NeonPreparedStatement(client, `INSERT OR IGNORE INTO t (a, b) VALUES (?, datetime('now', '+1 day'))`);
    stmt.bind('x');
    expect(stmt.rawSql).toBe(`INSERT INTO t (a, b) VALUES ($1, now() + interval '1 day')`);
    expect(stmt.rawParams).toEqual(['x']);
  });
});
