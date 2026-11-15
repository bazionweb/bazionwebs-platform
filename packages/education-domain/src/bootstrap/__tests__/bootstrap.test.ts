import { describe, it, expect } from 'vitest';
import { bootstrap } from '../index';

describe('bootstrap', () => {
  it('buildCloudflare: wires D1 adapter for db with cloudflare provider', () => {
    const env = { PLATFORM_PROVIDER: 'cloudflare', DB: {}, JWT_SECRET: 'test' };
    const ctx = bootstrap(env);
    expect(ctx.db.getPlatform()).toBe('cloudflare-d1');
  });

  it('buildCloudflare: wires CloudflareKVAdapter when KV binding present', () => {
    const env = { PLATFORM_PROVIDER: 'cloudflare', DB: {}, KV: {}, JWT_SECRET: 'test' };
    const ctx = bootstrap(env);
    expect(typeof ctx.kv.get).toBe('function');
    expect(typeof ctx.kv.put).toBe('function');
  });

  it('buildCloudflare: wires ResendEmailAdapter when RESEND_API_KEY is set', () => {
    const env = { PLATFORM_PROVIDER: 'cloudflare', DB: {}, RESEND_API_KEY: 're_test', JWT_SECRET: 'test' };
    const ctx = bootstrap(env);
    expect(typeof ctx.email.sendEmail).toBe('function');
  });

  it('buildCloudflare: prefers PaystackAdapter when PAYSTACK_SECRET_KEY is set', async () => {
    const env = { PLATFORM_PROVIDER: 'cloudflare', DB: {}, PAYSTACK_SECRET_KEY: 'sk_test_xxx', JWT_SECRET: 'test' };
    const ctx = bootstrap(env);
    expect(typeof ctx.payment.createPaymentIntent).toBe('function');
    expect(typeof ctx.payment.verifyPaymentIntent).toBe('function');
  });

  it('buildCloudflare: wires StripeAdapter when STRIPE_SECRET_KEY is set', async () => {
    const env = { PLATFORM_PROVIDER: 'cloudflare', DB: {}, STRIPE_SECRET_KEY: 'sk_test_xxx', JWT_SECRET: 'test' };
    const ctx = bootstrap(env);
    expect(typeof ctx.payment.createPaymentIntent).toBe('function');
  });

  it('buildCloudflare: uses unimplemented proxy for payment when no gateway key is set', async () => {
    const env = { PLATFORM_PROVIDER: 'cloudflare', DB: {}, JWT_SECRET: 'test' };
    const ctx = bootstrap(env);
    try {
      await ctx.payment.createPaymentIntent({ amount: 10, currency: 'USD' });
      expect.unreachable('Expected unimplemented proxy to throw');
    } catch (e: unknown) {
      expect((e as Error).message).toContain('payment');
      expect((e as Error).message).toContain('not yet available');
    }
  });

  it('buildCloudflare: wires D1IdentityAdapter for identity', () => {
    const env = { PLATFORM_PROVIDER: 'cloudflare', DB: {}, JWT_SECRET: 'test' };
    const ctx = bootstrap(env);
    expect(typeof ctx.identity.getUser).toBe('function');
    expect(typeof ctx.identity.createUser).toBe('function');
  });

  it('buildCloudflare: uses unimplemented proxy for lms', async () => {
    const env = { PLATFORM_PROVIDER: 'cloudflare', DB: {}, JWT_SECRET: 'test' };
    const ctx = bootstrap(env);
    try {
      await ctx.lms.getCourses('user1');
      expect.unreachable('Expected unimplemented proxy to throw');
    } catch (e: unknown) {
      expect((e as Error).message).toContain('lms');
    }
  });

  it('buildCloudflare: uses unimplemented proxy for notification', async () => {
    const env = { PLATFORM_PROVIDER: 'cloudflare', DB: {}, JWT_SECRET: 'test' };
    const ctx = bootstrap(env);
    try {
      await ctx.notification.send({ userId: 'u1', title: 'test', message: 'test' });
      expect.unreachable('Expected unimplemented proxy to throw');
    } catch (e: unknown) {
      expect((e as Error).message).toContain('notification');
    }
  });

  it('buildLocal: wires memory adapters for all ports', () => {
    const env = { PLATFORM_PROVIDER: 'local', DB: {}, JWT_SECRET: 'test' };
    const ctx = bootstrap(env);
    expect(ctx.identity).toBeDefined();
    expect(ctx.lms).toBeDefined();
    expect(ctx.payment).toBeDefined();
    expect(ctx.notification).toBeDefined();
    expect(typeof ctx.identity.getUser).toBe('function');
    expect(typeof ctx.lms.getCourses).toBe('function');
    expect(typeof ctx.payment.createPaymentIntent).toBe('function');
    expect(typeof ctx.notification.send).toBe('function');
  });

  it('throws for unknown provider', () => {
    const env = { PLATFORM_PROVIDER: 'aws', DB: {}, JWT_SECRET: 'test' };
    expect(() => bootstrap(env)).toThrow('aws');
  });

  it('defaults to cloudflare provider when PLATFORM_PROVIDER is unset', () => {
    const env = { DB: {}, JWT_SECRET: 'test' };
    const ctx = bootstrap(env);
    expect(ctx.db.getPlatform()).toBe('cloudflare-d1');
  });
});
