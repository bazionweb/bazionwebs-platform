export interface IKVStore {
  /**
   * Retrieves a value by key.
   */
  get<T = any>(key: string): Promise<T | null>;

  /**
   * Stores a value by key, with an optional expiration time (in seconds).
   */
  put<T = any>(key: string, value: T, options?: { expirationTtl?: number }): Promise<void>;

  /**
   * Deletes a value by key.
   */
  delete(key: string): Promise<void>;

  /**
   * Lists keys, optionally filtered by a prefix.
   *
   * Mirrors the real Cloudflare KV list API (options object in, paginated
   * `{ keys, list_complete, cursor }` out) so prefix invalidation actually
   * works in production instead of silently doing nothing.
   */
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: Array<{ name: string }>;
    list_complete: boolean;
    cursor?: string;
  }>;
}
