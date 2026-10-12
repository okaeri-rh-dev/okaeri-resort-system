export const BOOKING_STATUSES = [
  "Pending",
  "Confirmed",
  "CheckedIn",
  "CheckedOut",
  "Cancelled",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_STATUSES = ["Pending", "Partial", "Completed", "Refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
