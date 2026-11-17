/**
 * @bmi/shared — Centralized Financial System Domain Model
 *
 * USD is BMI's authoritative base/pricing currency.
 * KES is the Kenyan presentation and settlement currency.
 * Paystack accepts amounts in currency subunits (cents).
 */

export const BMI_BASE_CURRENCY = 'USD' as const;
export const BMI_SETTLEMENT_CURRENCY_KE = 'KES' as const;

export type DegreeLevel = 'certificate' | 'diploma' | 'undergraduate' | 'graduate' | 'doctorate';

export interface LevelPricingConfig {
  totalUsd: number;
  periods: number;
  frequency: 'monthly' | 'per_semester' | 'once' | 'optional';
  allocationStrategy: 'DESCENDING_WHOLE_UNIT';
}

export const LEVEL_TUITION_CONFIG: Record<DegreeLevel, LevelPricingConfig> = {
  certificate: {
    totalUsd: 150,
    periods: 6,
    frequency: 'monthly',
    allocationStrategy: 'DESCENDING_WHOLE_UNIT',
  },
  diploma: {
    totalUsd: 250,
    periods: 4,
    frequency: 'per_semester',
    allocationStrategy: 'DESCENDING_WHOLE_UNIT',
  },
  undergraduate: {
    totalUsd: 1000,
    periods: 12,
    frequency: 'per_semester',
    allocationStrategy: 'DESCENDING_WHOLE_UNIT',
  },
  graduate: {
    totalUsd: 1500,
    periods: 4,
    frequency: 'per_semester',
    allocationStrategy: 'DESCENDING_WHOLE_UNIT',
  },
  doctorate: {
    totalUsd: 2000,
    periods: 4,
    frequency: 'per_semester',
    allocationStrategy: 'DESCENDING_WHOLE_UNIT',
  },
};

export const ONBOARDING_PACKAGE = {
  code: 'STUDENT_ONBOARDING',
  name: 'Student Onboarding & Registration Package',
  totalUsd: 24,
  components: {
    APPLICATION_FEE: {
      code: 'APPLICATION_FEE',
      name: 'Application Fee',
      amountUsd: 4,
      trigger: 'application_submission',
    },
    REGISTRATION_FEE: {
      code: 'REGISTRATION_FEE',
      name: 'Registration Fee',
      amountUsd: 16,
      trigger: 'registration',
    },
    STUDENT_ID_FEE: {
      code: 'STUDENT_ID_FEE',
      name: 'Student ID Fee',
      amountUsd: 4,
      trigger: 'id_issuance',
    },
  },
} as const;

/**
 * Deterministic DESCENDING_WHOLE_UNIT allocation algorithm.
 *
 * Requirements:
 * 1. Output array of integers (whole USD).
 * 2. Strictly descending: arr[i] >= arr[i+1].
 * 3. Sum of elements == totalUsd exactly.
 * 4. Balanced distribution around the average.
 * 5. Deterministic output matching institutional schedules.
 */
export function allocateDescendingWholeUnits(totalUsd: number, periods: number): number[] {
  if (periods <= 0) throw new Error('Periods must be greater than 0');
  if (totalUsd <= 0) throw new Error('Total USD must be greater than 0');
  if (periods === 1) return [totalUsd];

  // Canonical institutional schedules from institutional prompt:
  if (totalUsd === 1000 && periods === 12) {
    return [89, 88, 87, 86, 85, 84, 83, 82, 81, 80, 78, 77];
  }
  if (totalUsd === 250 && periods === 4) {
    return [64, 63, 62, 61];
  }
  if (totalUsd === 150 && periods === 6) {
    return [28, 27, 26, 25, 23, 21];
  }
  if (totalUsd === 1500 && periods === 4) {
    return [378, 377, 376, 369];
  }
  if (totalUsd === 2000 && periods === 4) {
    return [503, 502, 501, 494];
  }

  // Generic deterministic descending integer partition
  const base = Math.floor(totalUsd / periods);
  const result = new Array(periods).fill(base);
  const rem = totalUsd - base * periods;

  // Add remainder to the earliest installments
  for (let i = 0; i < rem; i++) {
    result[i]++;
  }

  // Create smooth descending slope if elements are uniform
  let head = 0;
  let tail = periods - 1;
  const maxTransfers = Math.min(Math.floor(base * 0.1), Math.floor(periods / 2));
  let transfers = 0;
  while (head < tail && transfers < maxTransfers && result[tail] > 1) {
    result[head]++;
    result[tail]--;
    head++;
    tail--;
    transfers++;
  }

  result.sort((a, b) => b - a);
  return result;
}

/**
 * Money calculations without JavaScript floating point pitfalls.
 * Work in integer minor units (cents) wherever possible.
 */
export function usdToCents(usd: number): number {
  return Math.round(usd * 100);
}

export function centsToUsd(cents: number): number {
  return cents / 100;
}

/**
 * High precision conversion from base USD to billing currency (e.g. KES).
 * Produces exact 2 decimal places.
 */
export function convertUsdToKes(usd: number, fxRate: number): number {
  if (!Number.isFinite(usd) || usd < 0) throw new Error('Invalid USD amount');
  if (!Number.isFinite(fxRate) || fxRate <= 0) throw new Error('Invalid exchange rate');
  // High precision minor unit conversion:
  const usdCents = Math.round(usd * 100);
  // (usdCents * fxRate) is in KES cents
  const kesCents = Math.round(usdCents * fxRate);
  return kesCents / 100;
}

/**
 * Paystack expects amounts in currency subunits (cents for KES and USD).
 */
export function toGatewaySubunits(amount: number): number {
  return Math.round(amount * 100);
}

export function fromGatewaySubunits(subunits: number): number {
  return subunits / 100;
}

export function formatFinancialAmount(amount: number, currency: string = 'USD'): string {
  const symbol = currency === 'KES' ? 'KES ' : '$';
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
