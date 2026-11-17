import type { IRateLimiter, IHealthCheck } from '../../ports';

export class MemoryRateLimiterAdapter implements IRateLimiter, IHealthCheck {
  private store = new Map<string, { count: number; windowStart: number }>();

  async checkAndIncrement(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number }> {
    const now = Date.now();
    let record = this.store.get(key);

    if (!record || now - record.windowStart > windowSeconds * 1000) {
      record = { count: 0, windowStart: now };
    }

    if (record.count >= limit) {
      this.store.set(key, record);
      return { allowed: false, remaining: 0 };
    }

    record.count += 1;
    this.store.set(key, record);
    return { allowed: true, remaining: limit - record.count };
  }

  async health(): Promise<boolean> {
    return true;
  }
}
