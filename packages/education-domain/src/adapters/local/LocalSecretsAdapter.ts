import type { ISecretsManager, IHealthCheck } from '../../ports';

// Reads from process.env (useful for Node.js environments)
export class LocalSecretsAdapter implements ISecretsManager, IHealthCheck {
  async get(key: string): Promise<string | null> {
    return process.env[key] || null;
  }

  async getSecret<T = any>(key: string): Promise<T | null> {
    const val = process.env[key];
    if (typeof val === 'string') {
      try {
        return JSON.parse(val) as T;
      } catch {
        return null;
      }
    }
    return null;
  }

  async health(): Promise<boolean> {
    return true;
  }
}
