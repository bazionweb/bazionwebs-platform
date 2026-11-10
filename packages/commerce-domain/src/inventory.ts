import { DomainError } from "./errors.js";

export interface InventoryPosition {
  stockTracked: boolean;
  stockOnHand: number;
  stockReserved: number;
}

export interface InventoryBalance {
  stockOnHand: number;
  stockReserved: number;
}

function assertInventoryPosition(position: InventoryPosition): void {
  if (!Number.isSafeInteger(position.stockOnHand) || position.stockOnHand < 0 ||
      !Number.isSafeInteger(position.stockReserved) || position.stockReserved < 0 ||
      position.stockReserved > position.stockOnHand) {
    throw new DomainError("INVALID_INVENTORY", "Inventory must have non-negative safe stock with reservations no greater than stock on hand.");
  }
}

function assertQuantity(quantity: number): void {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
    throw new DomainError("INVALID_QUANTITY", "Inventory quantity must be between 1 and 99.");
  }
}

export function availableStock(position: InventoryPosition): number | null {
  assertInventoryPosition(position);
  return position.stockTracked ? position.stockOnHand - position.stockReserved : null;
}

export function canReserveStock(position: InventoryPosition, quantity: number): boolean {
  assertQuantity(quantity);
  const available = availableStock(position);
  return available === null || available >= quantity;
}

export function reserveStock(position: InventoryPosition, quantity: number): InventoryBalance {
  assertQuantity(quantity);
  assertInventoryPosition(position);
  if (!position.stockTracked) return { stockOnHand: position.stockOnHand, stockReserved: position.stockReserved };
  if (position.stockOnHand - position.stockReserved < quantity) {
    throw new DomainError("OUT_OF_STOCK", "There is not enough available stock to reserve this quantity.");
  }
  return { stockOnHand: position.stockOnHand, stockReserved: position.stockReserved + quantity };
}

export function releaseStockReservation(
  position: InventoryPosition,
  quantity: number,
  consume: boolean,
): InventoryBalance {
  if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 99) {
    throw new DomainError("INVENTORY_RESERVATION_INVARIANT_FAILED", "Reserved inventory quantity is invalid.");
  }
  assertInventoryPosition(position);
  if (quantity === 0) return { stockOnHand: position.stockOnHand, stockReserved: position.stockReserved };
  if (!position.stockTracked || position.stockReserved < quantity || (consume && position.stockOnHand < quantity)) {
    throw new DomainError("INVENTORY_RESERVATION_INVARIANT_FAILED", "Inventory reservation cannot be released safely.");
  }
  return {
    stockOnHand: consume ? position.stockOnHand - quantity : position.stockOnHand,
    stockReserved: position.stockReserved - quantity,
  };
}

export function canSetStockOnHand(stockReserved: number, nextStockOnHand: number): boolean {
  if (!Number.isSafeInteger(stockReserved) || stockReserved < 0 ||
      !Number.isSafeInteger(nextStockOnHand) || nextStockOnHand < 0) {
    throw new DomainError("INVALID_INVENTORY", "Stock values must be non-negative safe integers.");
  }
  return nextStockOnHand >= stockReserved;
}

export function canSetStockTracking(stockReserved: number, nextStockTracked: boolean): boolean {
  if (!Number.isSafeInteger(stockReserved) || stockReserved < 0) {
    throw new DomainError("INVALID_INVENTORY", "Reserved stock must be a non-negative safe integer.");
  }
  return nextStockTracked || stockReserved === 0;
}
