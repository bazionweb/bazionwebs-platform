export type CurrencyCode = "KES" | "USD" | "EUR" | "GBP" | "CAD" | "AUD" | "NZD" | "CHF" | "SGD" | "ZAR" | "NGN" | "GHS" | "INR" | "AED" | "BRL" | "MXN" | "SAR" | "CNY" | "HKD" | "SEK" | "NOK" | "DKK" | "PLN" | "THB" | "PHP";

export interface CartLine {
  productId: string;
  quantity: number;
  unitPriceMinor: number;
}

export interface MoneyTotals {
  currency: CurrencyCode;
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
}

export function productSlug(name: string): string {
  const slug = name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 180).replace(/-+$/g, "");
  return slug || "product";
}

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

function assertMinorUnits(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DomainError("INVALID_MONEY", `${label} must be a non-negative safe integer in minor units.`);
  }
}

export function calculateTotals(
  lines: readonly CartLine[],
  currency: CurrencyCode,
  options: { discountMinor?: number; shippingMinor?: number; taxMinor?: number } = {},
): MoneyTotals {
  if (lines.length === 0) throw new DomainError("EMPTY_CART", "A cart must contain at least one item.");

  const subtotalMinor = lines.reduce((total, line) => {
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 99) {
      throw new DomainError("INVALID_QUANTITY", "Each item quantity must be between 1 and 99.");
    }
    assertMinorUnits(line.unitPriceMinor, "Unit price");
    const next = total + line.quantity * line.unitPriceMinor;
    if (!Number.isSafeInteger(next)) throw new DomainError("MONEY_OVERFLOW", "Cart total exceeds safe integer range.");
    return next;
  }, 0);

  const discountMinor = options.discountMinor ?? 0;
  const shippingMinor = options.shippingMinor ?? 0;
  const taxMinor = options.taxMinor ?? 0;
  assertMinorUnits(discountMinor, "Discount");
  assertMinorUnits(shippingMinor, "Shipping");
  assertMinorUnits(taxMinor, "Tax");

  if (discountMinor > subtotalMinor) throw new DomainError("INVALID_DISCOUNT", "Discount cannot exceed subtotal.");
  const totalMinor = subtotalMinor - discountMinor + shippingMinor + taxMinor;
  if (!Number.isSafeInteger(totalMinor)) throw new DomainError("MONEY_OVERFLOW", "Cart total exceeds safe integer range.");

  return { currency, subtotalMinor, discountMinor, shippingMinor, taxMinor, totalMinor };
}

export function formatMoney(minorUnits: number, currency: CurrencyCode, locale = "en-KE"): string {
  assertMinorUnits(minorUnits, "Amount");
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minorUnits / 100);
}
