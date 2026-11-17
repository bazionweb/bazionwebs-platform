import type { ISecretsManager, IHealthCheck } from '../../ports';

export class EnvironmentSecretsAdapter implements ISecretsManager, IHealthCheck {
  constructor(private readonly env: Record<string, unknown>) {}

  async get(key: string): Promise<string | null> {
    const val = this.env[key];
    if (typeof val === 'string') return val;
    return null;
  }

  async getSecret<T = any>(key: string): Promise<T | null> {
    const val = this.env[key];
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
