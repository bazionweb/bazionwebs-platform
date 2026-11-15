
import { IPaymentProvider, PaymentIntent, CreatePaymentIntentInput } from '../../ports';

export class MemoryPaymentAdapter implements IPaymentProvider {
  private intents: Map<string, PaymentIntent> = new Map();

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent> {
    const id = crypto.randomUUID();
    const reference = input.reference || `BMI-${Date.now()}-${id.slice(0, 8)}`;
    const intent: PaymentIntent = {
      id,
      amount: input.amount,
      currency: input.currency,
      status: 'pending',
      clientSecret: `pi_${id}_secret_${crypto.randomUUID()}`,
      reference,
      provider: 'memory',
      metadata: input.metadata,
    };
    this.intents.set(id, intent);
    return intent;
  }

  async getPaymentIntent(id: string): Promise<PaymentIntent | null> {
    return this.intents.get(id) || null;
  }

  async cancelPaymentIntent(id: string): Promise<PaymentIntent> {
    const intent = this.intents.get(id);
    if (!intent) throw new Error('Payment intent not found');
    intent.status = 'canceled';
    this.intents.set(id, intent);
    return intent;
  }

  async verifyPaymentIntent(reference: string): Promise<PaymentIntent> {
    // Memory adapter has no external gateway — verification is a local lookup
    // by intent id or stored reference.
    const direct = this.intents.get(reference);
    if (direct) return direct;
    for (const intent of this.intents.values()) {
      if (intent.reference === reference) return intent;
    }
    throw new Error('Payment intent not found');
  }

  async handleWebhook(payload: any, _signature: string): Promise<PaymentIntent> {
    const id = payload.data?.object?.id;
    const intent = this.intents.get(id);
    if (!intent) throw new Error('Payment intent not found');
    intent.status = 'succeeded';
    this.intents.set(id, intent);
    return intent;
  }
}
