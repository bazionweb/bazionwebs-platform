import { z } from "zod";

export const currencySchema = z.enum(["KES", "USD", "EUR", "GBP", "CAD", "AUD", "NZD", "CHF", "SGD", "ZAR", "NGN", "GHS", "INR", "AED", "BRL", "MXN", "SAR", "CNY", "HKD", "SEK", "NOK", "DKK", "PLN", "THB", "PHP"]);
export type ApiCurrencyCode = z.infer<typeof currencySchema>;
