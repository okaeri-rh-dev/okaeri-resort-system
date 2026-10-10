import { RESORT_OPERATION_HOURS } from "@/config/settings";
import type { BookingEditInput } from "@/lib/validation/entity-schemas";
import type { Booking } from "@/types";
import type { TablesUpdate } from "@/types/database.types";
import { formDateToUTC } from "@/utils/date-helpers";

// unit_id is edited through the booking_units junction table, not the bookings row
export function toBookingUpdate(input: BookingEditInput): Partial<Booking> {
  return {
    guest_name: input.guest_name,
    email: input.email,
    contact_number: input.contact_number,
    check_in: formDateToUTC(input.check_in, RESORT_OPERATION_HOURS.checkInTime),
    check_out: formDateToUTC(input.check_out, RESORT_OPERATION_HOURS.checkOutTime),
    num_guests: input.num_guests,
    payment_method: input.payment_method,
    special_requests: input.special_requests,
    is_walk_in: input.is_walk_in,
  } satisfies TablesUpdate<"bookings">;
}
