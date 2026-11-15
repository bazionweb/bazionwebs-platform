import { describe, it, expect, vi } from 'vitest';
import { PaystackAdapter } from './PaystackAdapter';
import crypto from 'node:crypto';

function mockFetchOnce(json: any, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => json,
    text: async () => JSON.stringify(json),
  } as any);
}

describe('PaystackAdapter', () => {
  it('initializes a transaction with subunit amount + reference', async () => {
    const fetchImpl = mockFetchOnce({
      status: true,
      message: 'Authorization URL created',
      data: {
        authorization_url: 'https://checkout.paystack.com/abc',
        access_code: 'abc',
        reference: 'BMI-123',
      },
    });
    const ps = new PaystackAdapter('sk_test_xxx', { fetchImpl: fetchImpl as any });
    const intent = await ps.createPaymentIntent({
      amount: 50,
      currency: 'NGN',
      email: 'student@example.com',
      metadata: { userId: 'u1' },
    });
    expect(intent.authorizationUrl).toBe('https://checkout.paystack.com/abc');
    expect(intent.reference).toBe('BMI-123');
    expect(intent.status).toBe('pending');
    expect(intent.provider).toBe('paystack');
    const [, init] = fetchImpl.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.amount).toBe('5000'); // 50 NGN -> 5000 kobo
    expect(body.email).toBe('student@example.com');
    expect(body.metadata.merchant).toBe('BEMI TRAINING INSTITUTE');
  });

  it('rejects initialize without email', async () => {
    const ps = new PaystackAdapter('sk_test_xxx', {
      fetchImpl: mockFetchOnce({}) as any,
    });
    await expect(
      ps.createPaymentIntent({ amount: 10, currency: 'NGN' }),
    ).rejects.toThrow(/email is required/i);
  });

  it('verifies a transaction by reference and maps success', async () => {
    const fetchImpl = mockFetchOnce({
      status: true,
      message: 'Verification successful',
      data: {
        reference: 'BMI-123',
        amount: 5000,
        currency: 'NGN',
        status: 'success',
        channel: 'card',
        metadata: { userId: 'u1' },
        customer: { email: 'student@example.com' },
      },
    });
    const ps = new PaystackAdapter('sk_test_xxx', { fetchImpl: fetchImpl as any });
    const intent = await ps.verifyPaymentIntent('BMI-123');
    expect(intent.status).toBe('succeeded');
    expect(intent.amount).toBe(50);
    expect(intent.currency).toBe('ngn');
  });

  it('verifies webhook signature then re-verifies via API', async () => {
    const secret = 'sk_test_webhook';
    const raw = JSON.stringify({ event: 'charge.success', data: { reference: 'BMI-999' } });
    const sig = crypto.createHmac('sha512', secret).update(raw).digest('hex');

    const fetchImpl = mockFetchOnce({
      status: true,
      message: 'Verification successful',
      data: { reference: 'BMI-999', amount: 10000, currency: 'NGN', status: 'success' },
    });
    const ps = new PaystackAdapter(secret, { fetchImpl: fetchImpl as any });
    const intent = await ps.handleWebhook(raw, sig);
    expect(intent.status).toBe('succeeded');
    expect(intent.reference).toBe('BMI-999');
    expect(fetchImpl).toHaveBeenCalledTimes(1); // the re-verify call
  });

  it('rejects webhook with bad signature', async () => {
    const ps = new PaystackAdapter('sk_test_webhook', {
      fetchImpl: mockFetchOnce({}) as any,
    });
    const raw = JSON.stringify({ event: 'charge.success', data: { reference: 'BMI-1' } });
    await expect(ps.handleWebhook(raw, 'bad-signature')).rejects.toThrow(/signature/i);
  });

  it('sanitizes references to Paystack-allowed chars', () => {
    const ps = new PaystackAdapter('sk_test_xxx', { fetchImpl: mockFetchOnce({}) as any });
    expect(ps.sanitizeReference('BMI inv/001#x')).toBe('BMIinv001x');
    expect(ps.generateReference()).toMatch(/^BMI-/);
  });
});
