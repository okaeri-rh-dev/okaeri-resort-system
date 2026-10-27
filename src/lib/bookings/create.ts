import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Tables, TablesInsert } from "@/types/database.types";

import { BlockedUnitError, isBlockedNightError } from "./availability";
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
  is_walk_in: boolean;
};

export type BookingWithUnits = Tables<"bookings"> & {
  booking_units: (Tables<"booking_units"> & { unit: Tables<"units"> | null })[];
};

export async function createBooking(
  client: Client,
  booking: NewBooking
): Promise<BookingWithUnits> {
  const guestId = booking.guest.guest_id ?? (await guestIdFor(client, booking.guest));

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
      is_walk_in: booking.is_walk_in,
      booking_status: "Pending",
      payment_status: "Pending",
    },
    p_units: booking.units,
    p_guest_id: guestId,
  });
  if (isBlockedNightError(error)) throw new BlockedUnitError();
  if (error) throw new Error(error.message);

  const { data, error: fetchError } = await client
    .from("bookings")
    .select("*, booking_units(*, unit:units(*))")
    .eq("booking_id", bookingId)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  return data;
}

async function guestIdFor(client: Client, guest: NewBooking["guest"]): Promise<string> {
  if (guest.email) {
    const { data, error } = await client
      .from("guests")
      .select("guest_id")
      .eq("email", guest.email)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data.guest_id;
  }

  const { data, error } = await client
    .from("guests")
    .insert({
      guest_name: guest.guest_name,
      email: guest.email,
      phone_number: guest.contact_number,
      total_bookings: 0,
      total_spent: 0,
    } satisfies TablesInsert<"guests">)
    .select("guest_id")
    .single();
  if (error) throw new Error(error.message);
  return data.guest_id;
}
