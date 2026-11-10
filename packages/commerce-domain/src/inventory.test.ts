import { describe, expect, it } from "vitest";
import {
  availableStock,
  canReserveStock,
  canSetStockOnHand,
  canSetStockTracking,
  DomainError,
  releaseStockReservation,
  reserveStock,
} from "./index.js";

describe("commerce inventory rules", () => {
  it("reports available stock and treats untracked stock as unlimited", () => {
    expect(availableStock({ stockTracked: true, stockOnHand: 12, stockReserved: 4 })).toBe(8);
    expect(availableStock({ stockTracked: false, stockOnHand: 0, stockReserved: 0 })).toBeNull();
    expect(canReserveStock({ stockTracked: false, stockOnHand: 0, stockReserved: 0 }, 99)).toBe(true);
  });

  it("reserves only available quantities", () => {
    expect(reserveStock({ stockTracked: true, stockOnHand: 12, stockReserved: 4 }, 3))
      .toEqual({ stockOnHand: 12, stockReserved: 7 });
    expect(() => reserveStock({ stockTracked: true, stockOnHand: 12, stockReserved: 4 }, 9))
      .toThrowError(DomainError);
  });

  it("releases a reservation and consumes stock only on successful payment", () => {
    const position = { stockTracked: true, stockOnHand: 12, stockReserved: 4 };
    expect(releaseStockReservation(position, 2, false)).toEqual({ stockOnHand: 12, stockReserved: 2 });
    expect(releaseStockReservation(position, 2, true)).toEqual({ stockOnHand: 10, stockReserved: 2 });
  });

  it("rejects inconsistent reservations and stock reductions below reserved units", () => {
    expect(() => releaseStockReservation({ stockTracked: true, stockOnHand: 2, stockReserved: 1 }, 2, false))
      .toThrowError(/reservation cannot be released safely/);
    expect(canSetStockOnHand(4, 4)).toBe(true);
    expect(canSetStockOnHand(4, 3)).toBe(false);
    expect(canSetStockTracking(4, true)).toBe(true);
    expect(canSetStockTracking(4, false)).toBe(false);
    expect(canSetStockTracking(0, false)).toBe(true);
  });
});
