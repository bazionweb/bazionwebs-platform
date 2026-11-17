import type { IRateLimiter, IHealthCheck } from '../../ports';

export class CloudflareRateLimiterAdapter implements IRateLimiter, IHealthCheck {
  constructor(private readonly rateLimiterDO: DurableObjectNamespace) {}

  async checkAndIncrement(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number }> {
    const id = this.rateLimiterDO.idFromName(key);
    const obj = this.rateLimiterDO.get(id);
    
    // Call the DO
    const req = new Request(`http://do/limit?limit=${limit}&window=${windowSeconds}`, {
      method: 'POST',
      body: JSON.stringify({ key })
    });
    
    const res = await obj.fetch(req);
    if (!res.ok) {
      throw new Error(`RateLimiter DO returned ${res.status}`);
    }
    
    const data = await res.json() as { allowed: boolean; remaining: number };
    return data;
  }

  async health(): Promise<boolean> {
    return true;
  }
}
