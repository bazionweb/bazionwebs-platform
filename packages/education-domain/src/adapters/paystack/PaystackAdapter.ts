import { IPaymentProvider, PaymentIntent, CreatePaymentIntentInput } from '../../ports';

const PAYSTACK_API_BASE = 'https://api.paystack.co';

export interface PaystackAdapterOptions {
  /** Defaults to secretKey — Paystack signs webhooks with the SECRET key. */
  webhookSecret?: string;
  baseUrl?: string;
  timeoutMs?: number;
  /** Optional fetch override (tests). */
  fetchImpl?: typeof fetch;
}

interface PaystackInitResponse {
  status: boolean;
  message: string;
  data: { authorization_url: string; access_code: string; reference: string };
}

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    reference: string;
    amount: number;
    currency: string;
    status: string;
    gateway_response?: string;
    channel?: string;
    paid_at?: string;
    metadata?: Record<string, any> | string;
    customer?: { email?: string };
  };
}

/**
 * Paystack payment adapter (Cloudflare Workers compatible).
 *
 * Best-practice flow enforced here:
 *  1. Initialize from BACKEND only (secret key never leaves the server).
 *  2. Amounts submitted in SUBUNIT (kobo/pesewas/cents = major × 100).
 *  3. Unique `BMI-...` reference per transaction (idempotency + reconciliation).
 *  4. Frontend completes via `authorization_url` redirect (or InlineJS
 *     `resumeTransaction(access_code)`); backend NEVER trusts the frontend
 *     callback alone.
 *  5. Webhooks verified with HMAC-SHA512 over the RAW body against
 *     `x-paystack-signature`, then re-verified via GET /transaction/verify.
 *  6. Amount + currency re-checked against the invoice before value delivery
 *     (done by route handlers using the returned intent).
 *
 * No external SDK — plain fetch + Web Crypto so it runs on Workers, Node,
 * and in vitest without extra dependencies.
 */
export class PaystackAdapter implements IPaymentProvider {
  private readonly secretKey: string;
  private readonly webhookSecret: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly doFetch: typeof fetch;

  constructor(secretKey: string, opts: PaystackAdapterOptions = {}) {
    if (!secretKey || !secretKey.startsWith('sk_')) {
      throw new Error('PaystackAdapter requires a valid secret key (sk_test_... / sk_live_...)');
    }
    this.secretKey = secretKey;
    this.webhookSecret = opts.webhookSecret || secretKey;
    this.baseUrl = (opts.baseUrl || PAYSTACK_API_BASE).replace(/\/$/, '');
    this.timeoutMs = opts.timeoutMs ?? 15000;
    this.doFetch = opts.fetchImpl || fetch.bind(globalThis);
  }

  // ─── Initialize (backend only) ──────────────────────────────────────────

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent> {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Paystack: amount must be a positive number (major currency units)');
    }
    const email = (input.email || (input.metadata as any)?.email || '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Paystack: customer email is required to initialize a transaction');
    }
    const currency = (input.currency || 'KES').toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new Error(`Paystack: invalid currency "${input.currency}"`);
    }
    const reference = this.sanitizeReference(input.reference || this.generateReference());
    const subunit = this.toSubunit(amount, currency);

    const body: Record<string, unknown> = {
      email,
      amount: String(subunit),
      currency,
      reference,
      metadata: {
        ...(input.metadata || {}),
        merchant: 'BEMI TRAINING INSTITUTE',
        trading_as: 'BMI University',
      },
    };
    if (input.callbackUrl) body.callback_url = input.callbackUrl;
    if (input.channels?.length) body.channels = input.channels;

    const res = await this.request<PaystackInitResponse>('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!res.status || !res.data?.authorization_url) {
      throw new Error(`Paystack initialize failed: ${res.message || 'unknown error'}`);
    }

    return {
      id: res.data.reference,
      amount,
      currency: currency.toLowerCase(),
      status: 'pending',
      authorizationUrl: res.data.authorization_url,
      accessCode: res.data.access_code,
      reference: res.data.reference,
      provider: 'paystack',
      metadata: input.metadata,
    };
  }

  // ─── Verify (server-side, authoritative) ────────────────────────────────

  async getPaymentIntent(reference: string): Promise<PaymentIntent | null> {
    try {
      return await this.verifyPaymentIntent(reference);
    } catch {
      return null;
    }
  }

  async verifyPaymentIntent(reference: string): Promise<PaymentIntent> {
    const ref = this.sanitizeReference(reference);
    if (!ref) throw new Error('Paystack: reference is required for verification');
    const res = await this.request<PaystackVerifyResponse>(
      `/transaction/verify/${encodeURIComponent(ref)}`,
      { method: 'GET' },
    );
    if (!res.status || !res.data) {
      throw new Error(`Paystack verification failed: ${res.message || 'unknown error'}`);
    }
    const meta =
      typeof res.data.metadata === 'string'
        ? this.safeParseMeta(res.data.metadata)
        : res.data.metadata || {};
    return {
      id: res.data.reference,
      amount: this.fromSubunit(res.data.amount),
      currency: (res.data.currency || 'KES').toLowerCase(),
      status: this.mapStatus(res.data.status),
      reference: res.data.reference,
      provider: 'paystack',
      metadata: {
        ...meta,
        channel: res.data.channel,
        gateway_response: res.data.gateway_response,
        paid_at: res.data.paid_at,
        customer_email: res.data.customer?.email,
      },
    };
  }

  async cancelPaymentIntent(reference: string): Promise<PaymentIntent> {
    // Paystack has no "cancel transaction" API — uncompleted transactions
    // expire on their own. Return a terminal local state so the port
    // contract holds and callers can abandon the pending checkout.
    const existing = await this.getPaymentIntent(reference).catch(() => null);
    return {
      id: reference,
      amount: existing?.amount ?? 0,
      currency: existing?.currency ?? 'ngn',
      status: 'canceled',
      reference,
      provider: 'paystack',
      metadata: existing?.metadata,
    };
  }

  // ─── Webhook (HMAC-SHA512 + re-verify) ──────────────────────────────────

  /**
   * @param payload RAW request body text (preferred). An already-parsed object
   *   is also accepted (HMAC computed over JSON.stringify, Express-style).
   * @param signature value of the `x-paystack-signature` header.
   */
  async handleWebhook(payload: any, signature: string): Promise<PaymentIntent> {
    if (!signature) throw new Error('Paystack webhook: missing x-paystack-signature');
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const valid = await this.verifySignature(raw, signature);
    if (!valid) throw new Error('Paystack webhook: signature verification failed');

    let event: { event?: string; data?: { reference?: string; status?: string; amount?: number; currency?: string } };
    try {
      event = JSON.parse(raw);
    } catch {
      throw new Error('Paystack webhook: invalid JSON payload');
    }

    if (event.event === 'charge.success') {
      const reference = event.data?.reference;
      if (!reference) throw new Error('Paystack webhook: charge.success missing reference');
      // Defense in depth: re-verify via API before the caller delivers value.
      const verified = await this.verifyPaymentIntent(reference);
      if (verified.status !== 'succeeded') {
        throw new Error(`Paystack webhook: reference ${reference} did not verify as successful`);
      }
      return verified;
    }
    if (event.event === 'charge.failed' || event.event === 'charge.abandoned') {
      const reference = event.data?.reference || 'unknown';
      return {
        id: reference,
        amount: this.fromSubunit(event.data?.amount ?? 0),
        currency: (event.data?.currency || 'KES').toLowerCase(),
        status: 'failed',
        reference,
        provider: 'paystack',
      };
    }
    throw new Error(`Paystack webhook: unhandled event type "${event.event || 'unknown'}"`);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  toSubunit(amountMajor: number, _currency: string): number {
    // All Paystack-supported currencies (NGN/GHS/ZAR/KES/USD) are 2-decimal.
    return Math.round(amountMajor * 100);
  }

  fromSubunit(amountMinor: number): number {
    return amountMinor / 100;
  }

  generateReference(prefix = 'BMI'): string {
    const rand =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
    return this.sanitizeReference(`${prefix}-${Date.now()}-${rand}`);
  }

  sanitizeReference(ref: string): string {
    // Paystack allows only [-.,=A-Za-z0-9].
    return (ref || '').replace(/[^A-Za-z0-9\-.,=]/g, '').slice(0, 100);
  }

  private mapStatus(s: string): PaymentIntent['status'] {
    const v = (s || '').toLowerCase();
    if (v === 'success' || v === 'succeeded' || v === 'paid') return 'succeeded';
    if (v === 'abandoned') return 'canceled';
    if (v === 'ongoing' || v === 'pending' || v === 'processing' || v === 'queued') return 'pending';
    return 'failed';
  }

  private safeParseMeta(s: string): Record<string, any> {
    try {
      return JSON.parse(s);
    } catch {
      return {};
    }
  }

  private async request<T>(path: string, init: { method: string; body?: string }): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await this.doFetch(`${this.baseUrl}${path}`, {
        method: init.method,
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: init.body,
        signal: ctrl.signal,
      } as any);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Paystack API ${res.status}: ${text.slice(0, 300) || res.statusText}`);
      }
      return (await res.json()) as T;
    } catch (e: any) {
      if (e?.name === 'AbortError') throw new Error('Paystack API request timed out');
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  /** HMAC-SHA512(rawBody, webhookSecret) hex === signature (constant-time compare). */
  async verifySignature(rawBody: string, signature: string): Promise<boolean> {
    const expected = (await this.hmacSha512Hex(this.webhookSecret, rawBody)).toLowerCase();
    const actual = (signature || '').toLowerCase();
    if (expected.length !== actual.length || expected.length === 0) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
    return diff === 0;
  }

  private async hmacSha512Hex(key: string, data: string): Promise<string> {
    const subtle = (globalThis.crypto as any)?.subtle;
    if (subtle) {
      const enc = new TextEncoder();
      const cryptoKey = await subtle.importKey(
        'raw',
        enc.encode(key),
        { name: 'HMAC', hash: 'SHA-512' },
        false,
        ['sign'],
      );
      const sig = await subtle.sign('HMAC', cryptoKey, enc.encode(data));
      return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    // Fallback for runtimes without WebCrypto (Node <19): use node:crypto.
    const mod: any = await Function('return import("node:crypto")')();
    return mod.createHmac('sha512', key).update(data).digest('hex');
  }
}
