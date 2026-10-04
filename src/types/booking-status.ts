export const BOOKING_STATUSES = [
  "Pending",
  "Confirmed",
  "CheckedIn",
  "CheckedOut",
  "Cancelled",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
