import { describe, expect, it } from "vitest";
import { calculateTotals, DomainError } from "./index.js";

describe("calculateTotals", () => {
  it("uses integer minor units and calculates a KES total", () => {
    expect(calculateTotals([
      { productId: "p1", quantity: 2, unitPriceMinor: 1250 },
      { productId: "p2", quantity: 1, unitPriceMinor: 300 },
    ], "KES", { shippingMinor: 250 })).toEqual({
      currency: "KES", subtotalMinor: 2800, discountMinor: 0,
      shippingMinor: 250, taxMinor: 0, totalMinor: 3050,
    });
  });

  it("rejects an empty cart", () => {
    expect(() => calculateTotals([], "KES")).toThrowError(DomainError);
  });

  it("rejects an excessive discount", () => {
    expect(() => calculateTotals([{ productId: "p1", quantity: 1, unitPriceMinor: 100 }], "KES", { discountMinor: 101 }))
      .toThrowError(/Discount cannot exceed subtotal/);
  });

  it("rejects invalid quantities and unsafe money values", () => {
    expect(() => calculateTotals([{ productId: "p1", quantity: 0, unitPriceMinor: 100 }], "KES"))
      .toThrowError(/quantity must be between 1 and 99/);
    expect(() => calculateTotals([{ productId: "p1", quantity: 1, unitPriceMinor: Number.MAX_SAFE_INTEGER + 1 }], "KES"))
      .toThrowError(/safe integer/);
  });

  it("includes discount, delivery and tax in the final total", () => {
    expect(calculateTotals([{ productId: "p1", quantity: 2, unitPriceMinor: 1000 }], "KES", {
      discountMinor: 100, shippingMinor: 250, taxMinor: 150,
    })).toMatchObject({ subtotalMinor: 2000, discountMinor: 100, shippingMinor: 250, taxMinor: 150, totalMinor: 2300 });
  });
});
