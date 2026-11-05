export type BookingStatus = "requested" | "confirmed" | "cancelled" | "completed";
export interface Booking {
  id: string;
  tenantId: string;
  resourceId: string;
  customerId: string | null;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
}

export function validateBookingWindow(startsAt: Date, endsAt: Date): void {
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
    throw new Error("INVALID_BOOKING_WINDOW");
  }
}
