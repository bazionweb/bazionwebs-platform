import { describe, expect, it } from "vitest";
import { planPaymentSettlement } from "./index.js";

describe("commerce payment settlement", () => {
  it("consumes reserved stock only after a successful payment", () => {
    expect(planPaymentSettlement("pending_payment", "processing", true)).toEqual({
      kind: "settle",
      orderStatus: "paid",
      paymentStatus: "succeeded",
      consumeReservedStock: true,
      eventType: "payment.succeeded",
    });
  });

  it("cancels an unpaid order and releases its reservation on payment failure", () => {
    expect(planPaymentSettlement("pending_payment", "requires_action", false)).toEqual({
      kind: "settle",
      orderStatus: "cancelled",
      paymentStatus: "failed",
      consumeReservedStock: false,
      eventType: "payment.failed",
    });
  });

  it("does not process a terminal payment twice", () => {
    for (const status of ["succeeded", "failed", "cancelled"] as const) {
      expect(planPaymentSettlement("pending_payment", status, true)).toEqual({ kind: "duplicate" });
    }
  });

  it("rejects settlement after the order leaves pending payment", () => {
    for (const status of ["paid", "cancelled", "fulfilled", "refunded"] as const) {
      expect(planPaymentSettlement(status, "processing", true)).toEqual({ kind: "order_not_payable" });
    }
  });

  it("rejects unexpected payment states", () => {
    expect(planPaymentSettlement("pending_payment", "unknown", true)).toEqual({ kind: "order_not_payable" });
  });
});
