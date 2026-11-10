export type CommerceOrderStatus = "pending_payment" | "paid" | "cancelled" | "fulfilled" | "refunded";
export type CommercePaymentStatus = "created" | "requires_action" | "processing" | "succeeded" | "failed" | "cancelled";

export type PaymentSettlementPlan =
  | { kind: "duplicate" }
  | { kind: "order_not_payable" }
  | {
      kind: "settle";
      orderStatus: "paid" | "cancelled";
      paymentStatus: "succeeded" | "failed";
      consumeReservedStock: boolean;
      eventType: "payment.succeeded" | "payment.failed";
    };

const terminalPaymentStatuses = new Set<CommercePaymentStatus>(["succeeded", "failed", "cancelled"]);
const activePaymentStatuses = new Set<CommercePaymentStatus>(["created", "requires_action", "processing"]);

/** Plan one idempotent settlement transition without performing persistence. */
export function planPaymentSettlement(
  orderStatus: unknown,
  paymentStatus: unknown,
  succeeded: boolean,
): PaymentSettlementPlan {
  if (typeof paymentStatus === "string" && terminalPaymentStatuses.has(paymentStatus as CommercePaymentStatus)) {
    return { kind: "duplicate" };
  }
  if (typeof paymentStatus !== "string" || !activePaymentStatuses.has(paymentStatus as CommercePaymentStatus)) {
    return { kind: "order_not_payable" };
  }
  if (orderStatus !== "pending_payment") return { kind: "order_not_payable" };

  return succeeded
    ? {
        kind: "settle",
        orderStatus: "paid",
        paymentStatus: "succeeded",
        consumeReservedStock: true,
        eventType: "payment.succeeded",
      }
    : {
        kind: "settle",
        orderStatus: "cancelled",
        paymentStatus: "failed",
        consumeReservedStock: false,
        eventType: "payment.failed",
      };
}
