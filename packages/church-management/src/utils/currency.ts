// Currency formatting utilities for consistent KSH display

export const formatCurrency = (
  amount: number,
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    showSymbol?: boolean;
  },
): string => {
  const { minimumFractionDigits = 2, maximumFractionDigits = 2, showSymbol = true } = options || {};

  const formattedAmount = amount.toLocaleString('en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
  });

  return showSymbol ? `KSH ${formattedAmount}` : formattedAmount;
};

export const formatCurrencyShort = (amount: number): string => {
  if (amount >= 1000000) {
    return `KSH ${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `KSH ${(amount / 1000).toFixed(1)}K`;
  }
  return formatCurrency(amount);
};

export const parseCurrency = (value: string): number => {
  // Remove KSH prefix and commas, then parse
  const cleanValue = value.replace(/KSH\s?|,/g, '');
  return parseFloat(cleanValue) || 0;
};
