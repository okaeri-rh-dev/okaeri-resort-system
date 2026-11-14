import type { StatusChange } from "@/lib/bookings";

/** The status mutation, or anything with its `mutate`: tests pass a stub. */
export interface UpdateBookingStatus {
  mutate: (change: StatusChange) => void;
}
