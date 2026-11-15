export interface IRateLimiter {
  /**
   * Checks if an operation is allowed, and increments the counter.
   * Returns whether the operation is allowed and the remaining quota.
   */
  checkAndIncrement(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number }>;
}
