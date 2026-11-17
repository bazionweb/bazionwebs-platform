import type { ISecretsManager } from '../../ports';

export class MemorySecretsAdapter implements ISecretsManager {
  private secrets: Map<string, string>;

  constructor(initialSecrets: Record<string, string> = {}) {
    this.secrets = new Map(Object.entries(initialSecrets));
  }

  async get(key: string): Promise<string | null> {
    return this.secrets.get(key) ?? null;
  }

  async getSecret<T = any>(key: string): Promise<T | null> {
    const value = this.secrets.get(key);
    if (value === undefined) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }
}
