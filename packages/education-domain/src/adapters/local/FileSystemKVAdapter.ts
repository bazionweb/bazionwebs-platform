import { IKVStore, IHealthCheck } from '../../ports';
import fs from 'fs';
import path from 'path';

export class FileSystemKVAdapter implements IKVStore, IHealthCheck {
  private filePath: string;

  constructor(filePath: string = '.local-kv.json') {
    this.filePath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify({}), 'utf-8');
    }
  }

  private loadStore(): Record<string, { value: any; expiresAt?: number }> {
    try {
      const data = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  private saveStore(store: Record<string, { value: any; expiresAt?: number }>) {
    fs.writeFileSync(this.filePath, JSON.stringify(store, null, 2), 'utf-8');
  }

  async get<T = any>(key: string): Promise<T | null> {
    const store = this.loadStore();
    const item = store[key];
    if (!item) return null;
    
    if (item.expiresAt && Date.now() > item.expiresAt) {
      delete store[key];
      this.saveStore(store);
      return null;
    }
    return item.value as T;
  }

  async put<T = any>(key: string, value: T, options?: { expirationTtl?: number }): Promise<void> {
    const store = this.loadStore();
    const expiresAt = options?.expirationTtl ? Date.now() + options.expirationTtl * 1000 : undefined;
    store[key] = { value, expiresAt };
    this.saveStore(store);
  }

  async delete(key: string): Promise<void> {
    const store = this.loadStore();
    delete store[key];
    this.saveStore(store);
  }

  async list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: Array<{ name: string }>;
    list_complete: boolean;
    cursor?: string;
  }> {
    const store = this.loadStore();
    const prefix = options?.prefix;
    const limit = options?.limit ?? 1000;
    const names = Object.keys(store)
      .filter((k) => !prefix || k.startsWith(prefix))
      .sort();
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
    return true; // We can read/write the file
  }
}
