import type { IKVStore, IHealthCheck } from '../../ports';

export class CloudflareKVAdapter implements IKVStore, IHealthCheck {
  constructor(private readonly kv: KVNamespace) {}

  async get<T = any>(key: string): Promise<T | null> {
    const value = await this.kv.get(key, 'json');
    return value as T | null;
  }

  async put<T = any>(key: string, value: T, options?: { expirationTtl?: number }): Promise<void> {
    const putOptions: KVNamespacePutOptions = {};
    if (options?.expirationTtl) {
      putOptions.expirationTtl = options.expirationTtl;
    }
    await this.kv.put(key, JSON.stringify(value), putOptions);
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(key);
  }

  async list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: Array<{ name: string }>;
    list_complete: boolean;
    cursor?: string;
  }> {
    const result = await this.kv.list({
      prefix: options?.prefix,
      limit: options?.limit,
      cursor: options?.cursor,
    });
    return {
      keys: result.keys.map((k) => ({ name: k.name })),
      list_complete: result.list_complete,
      cursor: (result as { cursor?: string }).cursor,
    };
  }

  async health(): Promise<boolean> {
    try {
      await this.kv.get('__health_check__');
      return true;
    } catch {
      return false;
    }
  }
}
