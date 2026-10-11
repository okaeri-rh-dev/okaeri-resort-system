import { pickedDay, type BookingChanges } from "@/lib/bookings";
import type { BookingEditInput } from "@/lib/validation/entity-schemas";

// unit_id is edited through the booking_units junction table, not the bookings row
export function toBookingUpdate(input: BookingEditInput): BookingChanges {
  return {
    guest_name: input.guest_name,
    email: input.email,
    contact_number: input.contact_number,
    stay: { check_in: pickedDay(input.check_in), check_out: pickedDay(input.check_out) },
    num_guests: input.num_guests,
    payment_method: input.payment_method,
    special_requests: input.special_requests,
    is_walk_in: input.is_walk_in,
  };
}
