/* eslint-disable @typescript-eslint/no-explicit-any */
declare type D1Database = {
  prepare(sql: string): D1PreparedStatement;
  batch<T = any>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(sql: string): Promise<any>;
};
declare type D1PreparedStatement = {
  bind(...values: any[]): D1PreparedStatement;
  all<T = any>(): Promise<D1Result<T>>;
  first<T = any>(colName?: string): Promise<T | null>;
  run<T = any>(): Promise<D1Result<T>>;
};
declare type D1Result<T = any> = { results: T[]; success: boolean; meta?: any };
declare type KVNamespacePutOptions = { expiration?: number; expirationTtl?: number; metadata?: any };
declare type KVNamespace = any;
declare type R2Bucket = any;
declare type DurableObjectNamespace = any;
declare type QueueSendOptions = { contentType?: string; delaySeconds?: number };
declare type Queue<T = any> = {
  send(message: T, options?: QueueSendOptions): Promise<void>;
  sendBatch(messages: Iterable<{ body: T }>): Promise<void>;
};
declare type MessageBatch<T = any> = any;
declare type Fetcher = any;
declare type ExecutionContext = any;

interface CacheStorage {
  readonly default: Cache;
}
