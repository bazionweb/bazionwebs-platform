/**
 * @bmi/shared — Institution Identity
 *
 * Single source of truth for the platform's dual identity.
 *
 * - LEGAL_NAME ("BEMI TRAINING INSTITUTE") is the REGISTERED business name.
 *   It MUST appear on every payment surface: Paystack dashboard business
 *   profile, checkout description, bank statement descriptor, invoices,
 *   receipts, and payment confirmation emails. This is what the student sees
 *   on their bank/card statement, so consistency here prevents chargebacks
 *   and "unknown merchant" support tickets.
 * - ACADEMIC_BRAND ("BMI University") is the public academic/trading brand
 *   used for teaching, admissions, LMS, and general communications.
 *
 * Harmonization rule: payment contexts always lead with the legal name and
 * qualify the academic brand as "trading as". Academic contexts lead with
 * the academic brand and reference the legal entity in footers/legal copy.
 */

export const INSTITUTION_LEGAL_NAME = 'BEMI TRAINING INSTITUTE' as const;

export const INSTITUTION_LEGAL_SHORT = 'BEMI' as const;

export const INSTITUTION_ACADEMIC_BRAND = 'BMI University' as const;

export const INSTITUTION_ACADEMIC_FULL = 'Bethel Ministries International University' as const;

/** "BEMI TRAINING INSTITUTE (trading as BMI University)" — use on checkout + receipts. */
export const INSTITUTION_TRADING_AS_LINE =
  `${INSTITUTION_LEGAL_NAME} (trading as ${INSTITUTION_ACADEMIC_BRAND})` as const;

/** Merchant name sent to Paystack and shown on the Paystack checkout page. */
export const PAYMENT_MERCHANT_NAME = INSTITUTION_LEGAL_NAME;

/**
 * Bank-statement descriptor guidance. Paystack statement descriptors are
 * configured in the Paystack dashboard (Business → Statement descriptor),
 * not via API — keep this constant in sync with the dashboard value so
 * receipts match what students see on their statements.
 */
export const PAYMENT_STATEMENT_DESCRIPTOR = 'BEMI*TRAINING' as const;

/** Finance support contact shown alongside payment instructions. */
export const PAYMENT_SUPPORT_LINE =
  `Payee: ${INSTITUTION_TRADING_AS_LINE}` as const;

/**
 * Build a Paystack transaction description that always names the legal
 * merchant first. e.g. "BEMI TRAINING INSTITUTE - Tuition Invoice abc123".
 */
export function buildPaymentDescription(reason: string): string {
  const clean = (reason || 'Tuition payment').trim().slice(0, 120);
  return `${INSTITUTION_LEGAL_NAME} - ${clean}`;
}

/** Payment receipt footer — include on every receipt / confirmation email. */
export function paymentReceiptFooter(reference?: string): string {
  const ref = reference ? ` • Paystack ref: ${reference}` : '';
  return `Payment received by ${INSTITUTION_TRADING_AS_LINE}${ref}.`;
}

/**
 * Currencies accepted through Paystack on this platform.
 * Amounts are always submitted to Paystack in the SUBUNIT (cents for KES/USD).
 * Default Kenyan billing currency is KES.
 */
export const PAYSTACK_SUPPORTED_CURRENCIES = ['KES', 'USD', 'NGN', 'GHS', 'ZAR'] as const;

export type PaystackCurrency = (typeof PAYSTACK_SUPPORTED_CURRENCIES)[number];

export const PAYSTACK_DEFAULT_CURRENCY: PaystackCurrency = 'KES';

/** Payment channels enabled on Paystack checkout (card, bank, USSD, mobile money, transfer). */
export const PAYSTACK_DEFAULT_CHANNELS = [
  'card',
  'bank',
  'ussd',
  'qr',
  'mobile_money',
  'bank_transfer',
] as const;
