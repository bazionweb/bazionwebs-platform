import type { IDatabase, IPreparedStatement, IHealthCheck } from '../../ports';

// A simple in-memory database adapter for testing purposes.
// In a real application, this would wrap better-sqlite3 or sql.js.
export class MemoryDatabaseAdapter implements IDatabase, IHealthCheck {
  // A mock storage for testing
  public mockData: any[] = [];
  public mockQueries: { sql: string; params: any[] }[] = [];

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    this.mockQueries.push({ sql, params: params || [] });
    return this.mockData as T[];
  }

  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    this.mockQueries.push({ sql, params: params || [] });
    return this.mockData.length > 0 ? this.mockData[0] as T : null;
  }

  prepare(sql: string): IPreparedStatement {
    let boundParams: any[] = [];
    const wrapper: IPreparedStatement = {
      bind: (...params: any[]) => {
        boundParams = params;
        return wrapper;
      },
      run: async () => {
        this.mockQueries.push({ sql, params: boundParams });
        return { success: true };
      },
      all: async <T = any>() => {
        this.mockQueries.push({ sql, params: boundParams });
        return { results: this.mockData as T[], meta: {} };
      },
      first: async <T = any>() => {
        this.mockQueries.push({ sql, params: boundParams });
        return this.mockData.length > 0 ? this.mockData[0] as T : null;
      }
    };
    return wrapper;
  }

  async transaction<T>(callback: (db: IDatabase) => Promise<T>): Promise<T> {
    // In-memory doesn't enforce strict isolation in this mock
    return callback(this);
  }

  async batch<T = any>(statements: IPreparedStatement[]): Promise<T[]> {
    const results: any[] = [];
    for (const stmt of statements) {
      const r = await stmt.all();
      results.push(r.results);
    }
    return results as T[];
  }

  getPlatform(): string {
    return 'memory-mock';
  }

  async health(): Promise<boolean> {
    return true;
  }
}
