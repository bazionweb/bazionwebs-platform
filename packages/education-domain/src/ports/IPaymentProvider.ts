
export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'canceled';
  clientSecret?: string;
  /** Paystack checkout URL — redirect the student here to complete payment. */
  authorizationUrl?: string;
  /** Paystack transaction reference (also used as the intent id for Paystack). */
  reference?: string;
  /** Paystack access code — used with InlineJS resumeTransaction(). */
  accessCode?: string;
  /** Which gateway fulfilled this intent (useful for logging/receipts). */
  provider?: 'paystack' | 'stripe' | 'memory';
  metadata?: Record<string, any>;
}

export interface CreatePaymentIntentInput {
  amount: number;
  currency: string;
  /** Payer email — REQUIRED by Paystack, optional for Stripe (kept optional for backward compat). */
  email?: string;
  description?: string;
  metadata?: Record<string, any>;
  /**
   * Idempotency / reconciliation reference. Only [-.,=A-Za-z0-9] allowed.
   * When omitted, the adapter generates a unique `BMI-...` reference.
   */
  reference?: string;
  /** Fully-qualified URL Paystack redirects to after checkout (overrides dashboard callback). */
  callbackUrl?: string;
  /** Paystack payment channels to enable (card, bank, ussd, qr, mobile_money, bank_transfer). */
  channels?: string[];
}

export interface IPaymentProvider {
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent>;
  getPaymentIntent(id: string): Promise<PaymentIntent | null>;
  cancelPaymentIntent(id: string): Promise<PaymentIntent>;
  handleWebhook(payload: any, signature: string): Promise<PaymentIntent>;
  /**
   * Server-side verification by Paystack reference.
   * Best practice: ALWAYS verify via API (GET /transaction/verify/:reference)
   * before delivering value — never trust the frontend callback alone.
   * Stripe/Memory adapters implement this via payment-intent retrieval.
   */
  verifyPaymentIntent(reference: string): Promise<PaymentIntent>;
}
