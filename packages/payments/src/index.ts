export type PaymentProviderName = "mpesa" | "stripe" | "mock";
export type PaymentStatus = "created" | "requires_action" | "processing" | "succeeded" | "failed" | "cancelled";

export interface CreatePaymentSessionInput {
  tenantId: string;
  orderId: string;
  orderNumber: string;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
  customer: { name: string; email: string; phone: string };
  returnUrl: string;
}

export interface CreatePaymentSessionResult {
  provider: PaymentProviderName;
  providerReference: string;
  status: PaymentStatus;
  redirectUrl: string | null;
}

export interface VerifiedPaymentEvent {
  provider: Exclude<PaymentProviderName, "mock">;
  providerEventId: string;
  providerReference: string;
  orderId: string;
  status: "succeeded" | "failed" | "cancelled";
  amountMinor: number;
  currency: string;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  createPaymentSession(input: CreatePaymentSessionInput): Promise<CreatePaymentSessionResult>;
  // A real adapter must verify authenticity using the provider's documented signature/authentication mechanism.
  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): Promise<VerifiedPaymentEvent>;
}

export { DarajaClient, DarajaRequestError, normalizeKenyanPhoneNumber } from "./daraja.js";
export type { DarajaConfig, DarajaStkPushInput, DarajaStkPushResult } from "./daraja.js";
