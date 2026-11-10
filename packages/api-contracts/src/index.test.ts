import { describe, expect, it } from "vitest";
import {
  addCartItemSchema, checkoutSchema, createCartSchema, orderStatusInputSchema,
  productInputSchema, productPatchSchema, storeSettingsInputSchema,
} from "./index.js";

describe("commerce API contracts", () => {
  it("defaults a new cart to KES", () => {
    expect(createCartSchema.parse({})).toEqual({ currency: "KES" });
  });

  it("bounds cart item quantities", () => {
    expect(addCartItemSchema.safeParse({ productId: "00000000-0000-4000-8000-000000000001", quantity: 1 }).success).toBe(true);
    expect(addCartItemSchema.safeParse({ productId: "00000000-0000-4000-8000-000000000001", quantity: 100 }).success).toBe(false);
  });

  it("normalizes the checkout country code and requires contact and shipping data", () => {
    const result = checkoutSchema.parse({
      cartId: "00000000-0000-4000-8000-000000000001",
      customer: { name: "Jane Doe", email: "jane@example.test", phone: "+254712345678" },
      shippingAddress: { line1: "1 Main Street", city: "Nairobi", countryCode: "ke" },
    });
    expect(result.shippingAddress.countryCode).toBe("KE");
    expect(checkoutSchema.safeParse({ cartId: "bad" }).success).toBe(false);
  });

  it("validates product money, image URLs, and inventory configuration", () => {
    const validProduct = {
      sku: "BOOK-1", name: "Church History", priceMinor: 1200, stockOnHand: 4,
      imageUrl: "https://images.example.test/book.jpg", compareAtPriceMinor: 1400,
    };
    expect(productInputSchema.safeParse(validProduct).success).toBe(true);
    expect(productInputSchema.safeParse({ ...validProduct, compareAtPriceMinor: 1100 }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...validProduct, imageUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...validProduct, stockTracked: false, stockOnHand: 4 }).success).toBe(false);
  });

  it("requires meaningful store settings and only allows order fulfillment", () => {
    const settings = storeSettingsInputSchema.safeParse({
      storeName: "Bazion Shop", tagline: "Books for everyone", supportEmail: "", isHomePage: false,
      locale: "en-KE", timeZone: "Africa/Nairobi", defaultCountryCode: "KE", defaultCurrency: "KES",
      supportedCurrencies: ["KES"], shippingRates: { KES: 0 }, shippingCountries: [],
    });
    expect(settings.success).toBe(true);
    expect(orderStatusInputSchema.safeParse({ status: "fulfilled" }).success).toBe(true);
    expect(orderStatusInputSchema.safeParse({ status: "refunded" }).success).toBe(false);
  });
});
