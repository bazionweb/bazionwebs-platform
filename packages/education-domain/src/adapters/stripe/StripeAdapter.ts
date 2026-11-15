import { IPaymentProvider, PaymentIntent, CreatePaymentIntentInput } from '../../ports';
import Stripe from '../../shims/external-adapters';

export class StripeAdapter implements IPaymentProvider {
  private stripe: Stripe;
  private webhookSecret?: string;

  constructor(secretKey: string, webhookSecret?: string) {
    this.stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' });
    this.webhookSecret = webhookSecret;
  }

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent> {
    const intent = await this.stripe.paymentIntents.create({
      amount: Math.round(input.amount * 100),
      currency: input.currency.toLowerCase(),
      metadata: input.metadata,
      description: input.description,
    });

    return {
      id: intent.id,
      amount: intent.amount / 100,
      currency: intent.currency,
      status: this.mapStatus(intent.status),
      clientSecret: intent.client_secret || undefined,
      provider: 'stripe',
    };
  }

  async getPaymentIntent(id: string): Promise<PaymentIntent | null> {
    try {
      const intent = await this.stripe.paymentIntents.retrieve(id);
      return {
        id: intent.id,
        amount: intent.amount / 100,
        currency: intent.currency,
        status: this.mapStatus(intent.status),
        clientSecret: intent.client_secret || undefined,
        provider: 'stripe',
      };
    } catch {
      return null;
    }
  }

  async cancelPaymentIntent(id: string): Promise<PaymentIntent> {
    const intent = await this.stripe.paymentIntents.cancel(id);
    return {
      id: intent.id,
      amount: intent.amount / 100,
      currency: intent.currency,
      status: this.mapStatus(intent.status),
      provider: 'stripe',
    };
  }

  async verifyPaymentIntent(id: string): Promise<PaymentIntent> {
    const intent = await this.getPaymentIntent(id);
    if (!intent) throw new Error(`Payment intent not found: ${id}`);
    return intent;
  }

  async handleWebhook(payload: string, signature: string): Promise<PaymentIntent> {
    if (!this.webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    } catch (err) {
      throw new Error(`Webhook signature verification failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    }

    if (event.type !== 'payment_intent.succeeded' && event.type !== 'payment_intent.payment_failed') {
      throw new Error(`Unhandled event type: ${event.type}`);
    }

    const intent = event.data.object as { id: string; amount: number; currency: string; status: string };
    return {
      id: intent.id,
      amount: intent.amount / 100,
      currency: intent.currency,
      status: this.mapStatus(intent.status),
    };
  }

  private mapStatus(stripeStatus: string): PaymentIntent['status'] {
    switch (stripeStatus) {
      case 'succeeded': return 'succeeded';
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
        return 'pending';
      case 'canceled': return 'canceled';
      default: return 'failed';
    }
  }
}
