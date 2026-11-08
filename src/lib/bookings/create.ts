import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Tables } from "@/types/database.types";

import { BlockedUnitError, isBlockedNightError } from "./availability";
import { DuplicateConfirmationCodeError, isDuplicateConfirmationCode } from "./confirmation-code";
import type { StaffBookingSource } from "./source";
import { toStayInstants, type ManilaDay } from "./stay";

type Client = SupabaseClient<Database>;

export type PricedUnit = {
  unit_id: string;
  unit_price: number;
  weekend_surcharge: number;
  extra_person_charge: number;
  subtotal: number;
  assigned_guests: number;
  unit_notes?: string;
};

export type NewBooking = {
  guest: {
    guest_name: string;
    email: string | null;
    contact_number: string | null;
    guest_id?: string;
  };
  check_in: ManilaDay;
  check_out: ManilaDay;
  units: PricedUnit[];
  payment_method: string | null;
  special_requests?: string | null;
  internal_notes?: string | null;
  booking_source: StaffBookingSource;
  airbnb_confirmation_code?: string | null;
};

export type BookingWithUnits = Tables<"bookings"> & {
  booking_units: (Tables<"booking_units"> & { unit: Tables<"units"> | null })[];
};

export async function createBooking(
  client: Client,
  booking: NewBooking
): Promise<BookingWithUnits> {
  const { data: bookingId, error } = await client.rpc("create_multi_unit_booking", {
    p_booking_data: {
      guest_name: booking.guest.guest_name,
      email: booking.guest.email,
      contact_number: booking.guest.contact_number,
      ...toStayInstants(booking.check_in, booking.check_out),
      num_guests: booking.units.reduce((sum, unit) => sum + unit.assigned_guests, 0),
      payment_method: booking.payment_method,
      special_requests: booking.special_requests ?? null,
      internal_notes: booking.internal_notes ?? null,
      booking_source: booking.booking_source,
      airbnb_confirmation_code: booking.airbnb_confirmation_code ?? null,
      booking_status: "Pending",
      payment_status: "Pending",
    },
    p_units: booking.units,
    p_guest_id: booking.guest.guest_id,
  });
  if (isBlockedNightError(error)) throw new BlockedUnitError();
  if (isDuplicateConfirmationCode(error)) throw new DuplicateConfirmationCodeError();
  if (error) throw new Error(error.message);

  const { data, error: fetchError } = await client
    .from("bookings")
    .select("*, booking_units(*, unit:units(*))")
    .eq("booking_id", bookingId)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  return data;
}
