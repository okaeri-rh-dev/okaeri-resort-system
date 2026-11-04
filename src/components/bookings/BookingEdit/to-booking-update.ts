import { pickedDay, type BookingChanges } from "@/lib/bookings";
import type { BookingEditInput } from "@/lib/validation/entity-schemas";

// unit_id is edited through the booking_units junction table, not the bookings row
export function toBookingUpdate(input: BookingEditInput, currentTotal: number): BookingChanges {
  return {
    ...(input.total_amount !== currentTotal && { total_amount: input.total_amount }),
    guest_name: input.guest_name,
    email: input.email,
    contact_number: input.contact_number,
    stay: { check_in: pickedDay(input.check_in), check_out: pickedDay(input.check_out) },
    num_guests: input.num_guests,
    payment_method: input.payment_method,
    special_requests: input.special_requests,
    booking_source: input.booking_source,
    airbnb_confirmation_code:
      (input.booking_source === "Airbnb" && input.airbnb_confirmation_code) || null,
  };
}
