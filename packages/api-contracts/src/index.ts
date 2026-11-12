import { z } from "zod";
import { currencySchema } from "./currency.js";

export { currencySchema } from "./currency.js";
export * from "./commerce-admin.js";
export * from "./provisioning.js";
export * from "./provisioning-catalog.js";
export * from "./identity.js";
export const createCartSchema = z.object({ currency: currencySchema.default("KES") });
export const addCartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
});
export const updateCartItemSchema = z.object({ quantity: z.number().int().min(1).max(99) });
export const checkoutSchema = z.object({
  cartId: z.string().uuid(),
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().min(7).max(24),
  }),
  shippingAddress: z.object({
    line1: z.string().trim().min(2).max(180),
    line2: z.string().trim().max(180).optional(),
    city: z.string().trim().min(2).max(100),
    countryCode: z.string().length(2).transform((v) => v.toUpperCase()),
    postalCode: z.string().trim().max(20).optional(),
  }),
});

export type CreateCartInput = z.infer<typeof createCartSchema>;
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
