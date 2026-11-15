import type { IKVStore, IHealthCheck } from '../../ports';

export class MemoryKVAdapter implements IKVStore, IHealthCheck {
  private store = new Map<string, { value: any; expiresAt?: number }>();

  async get<T = any>(key: string): Promise<T | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value as T;
  }

  async put<T = any>(key: string, value: T, options?: { expirationTtl?: number }): Promise<void> {
    const expiresAt = options?.expirationTtl ? Date.now() + options.expirationTtl * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: Array<{ name: string }>;
    list_complete: boolean;
    cursor?: string;
  }> {
    const prefix = options?.prefix;
    const limit = options?.limit ?? 1000;
    const names = [...this.store.keys()]
      .filter((key) => !prefix || key.startsWith(prefix))
      .sort();
    // Cursor is the index offset encoded as a string (test/dev adapter only).
    const start = Math.max(0, parseInt(options?.cursor ?? '0', 10) || 0);
    const slice = names.slice(start, start + limit);
    const next = start + slice.length;
    return {
      keys: slice.map((name) => ({ name })),
      list_complete: next >= names.length,
      cursor: next < names.length ? String(next) : undefined,
    };
  }

  async health(): Promise<boolean> {
    return true;
  }
}
