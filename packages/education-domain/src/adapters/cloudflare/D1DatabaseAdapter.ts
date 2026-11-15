import type { IDatabase, IPreparedStatement, IHealthCheck } from '../../ports';

export class D1DatabaseAdapter implements IDatabase, IHealthCheck {
  constructor(private readonly d1: D1Database) {}

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    let stmt = this.d1.prepare(sql);
    if (params && params.length > 0) {
      stmt = stmt.bind(...params);
    }
    const result = await stmt.all<T>();
    return result.results as T[];
  }

  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    let stmt = this.d1.prepare(sql);
    if (params && params.length > 0) {
      stmt = stmt.bind(...params);
    }
    const result = await stmt.first<T>();
    return result;
  }

  prepare(sql: string): IPreparedStatement {
    let stmt = this.d1.prepare(sql);
    
    const wrapper: IPreparedStatement = {
      bind: (...params: any[]) => {
        stmt = stmt.bind(...params);
        return wrapper;
      },
      run: async () => {
        const result = await stmt.run();
        return { success: result.success, meta: result.meta };
      },
      all: async <T = any>() => {
        const result = await stmt.all<T>();
        return { results: result.results as T[], meta: result.meta };
      },
      first: async <T = any>() => {
        return await stmt.first<T>();
      }
    };
    // Keep a handle on the underlying D1 statement so `batch()` can forward it
    // to D1's native atomic batch execution.
    (wrapper as any)._d1 = stmt;
    return wrapper;
  }

  async batch<T = any>(statements: IPreparedStatement[]): Promise<T[]> {
    const raw = statements.map((s) => (s as any)._d1 as D1PreparedStatement);
    const results = await this.d1.batch(raw);
    return results.map((r) => r.results) as T[];
  }

  async transaction<T>(callback: (db: IDatabase) => Promise<T>): Promise<T> {
    // Cloudflare D1 does not support interactive transactions (e.g., BEGIN; ... SELECT; ... COMMIT;).
    // Previously, statements were queued into a batch, but reads (query) executed immediately
    // against the uncommitted DB state, leading to stale or empty results.
    // By passing `this` directly, statements are executed sequentially. While this sacrifices atomicity,
    // it guarantees data correctness for reads within the transaction callback.
    return callback(this);
  }

  getPlatform(): string {
    return 'cloudflare-d1';
  }

  async health(): Promise<boolean> {
    try {
      await this.queryOne('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
