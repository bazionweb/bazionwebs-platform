/**
 * Interface for abstracting database interactions.
 */
export interface IDatabase {
  /**
   * Executes a raw query and returns the results.
   */
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;

  /**
   * Executes a raw query and returns a single row or null.
   */
  queryOne<T = any>(sql: string, params?: any[]): Promise<T | null>;

  /**
   * Creates a prepared statement.
   */
  prepare(sql: string): IPreparedStatement;

  /**
   * Executes a callback within a transaction.
   * Note: Some platforms (like Cloudflare D1) may simulate this using batch execution.
   */
  transaction<T>(callback: (db: IDatabase) => Promise<T>): Promise<T>;

  /**
   * Executes an array of prepared statements as a single atomic batch
   * (single round-trip on D1; a non-interactive transaction on Neon HTTP).
   */
  batch<T = any>(statements: IPreparedStatement[]): Promise<T[]>;

  /**
   * Returns a string identifying the underlying platform (e.g., 'cloudflare-d1', 'postgres').
   */
  getPlatform(): string;
}

/**
 * Interface for a prepared statement.
 */
export interface IPreparedStatement {
  /**
   * Binds parameters to the statement.
   */
  bind(...params: any[]): this;

  /**
   * Executes the statement and returns metadata.
   */
  run(): Promise<{ success: boolean; meta?: any }>;

  /**
   * Executes the statement and returns all resulting rows.
   */
  all<T = any>(): Promise<{ results: T[], meta?: any }>;

  /**
   * Executes the statement and returns the first row, or null.
   */
  first<T = any>(): Promise<T | null>;
}
