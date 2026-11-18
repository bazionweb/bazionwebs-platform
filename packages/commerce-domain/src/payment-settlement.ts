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

export type OrderTransitionPlan =
  | { kind: "allowed"; nextStatus: CommerceOrderStatus; releaseReservedStock: boolean; restockOnHand: boolean }
  | { kind: "invalid_transition"; reason: string };

/** Validate admin order lifecycle transitions across pending_payment, paid, fulfilled, cancelled, and refunded. */
export function planOrderStatusTransition(
  currentStatus: unknown,
  targetStatus: unknown,
  options: { restock?: boolean | undefined } = {},
): OrderTransitionPlan {
  if (targetStatus === "fulfilled") {
    if (currentStatus !== "paid") {
      return { kind: "invalid_transition", reason: "Only paid orders can be marked fulfilled." };
    }
    return { kind: "allowed", nextStatus: "fulfilled", releaseReservedStock: false, restockOnHand: false };
  }
  if (targetStatus === "cancelled") {
    if (currentStatus !== "pending_payment") {
      return { kind: "invalid_transition", reason: "Only unpaid pending_payment orders can be cancelled." };
    }
    return { kind: "allowed", nextStatus: "cancelled", releaseReservedStock: true, restockOnHand: false };
  }
  if (targetStatus === "refunded") {
    if (currentStatus !== "paid" && currentStatus !== "fulfilled") {
      return { kind: "invalid_transition", reason: "Only paid or fulfilled orders can be refunded." };
    }
    return {
      kind: "allowed",
      nextStatus: "refunded",
      releaseReservedStock: false,
      restockOnHand: options.restock === true,
    };
  }
  return { kind: "invalid_transition", reason: "Unsupported target order status." };
}

