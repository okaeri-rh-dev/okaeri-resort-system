import type { SupabaseClient } from "@supabase/supabase-js";

import type { BookingStatus } from "@/types/booking-status";
import type { Database, Tables, TablesInsert, TablesUpdate } from "@/types/database.types";

import { toStayInstants, type ManilaDay } from "./stay";

type Client = SupabaseClient<Database>;
type BookingRow = Tables<"bookings">;

export type BookingChanges = Partial<{
  guest_name: string;
  email: string | null;
  contact_number: string | null;
  num_guests: number;
  payment_method: string | null;
  special_requests: string | null;
  is_walk_in: boolean;
}> & { stay?: { check_in: ManilaDay; check_out: ManilaDay } };

type Result<T> = { data: T | null; error: { message: string } | null };

function rowFrom<T>({ data, error }: Result<T>): NonNullable<T> {
  if (error) throw new Error(error.message);
  if (data === null || data === undefined) throw new Error("The booking was not returned");
  return data;
}

export async function updateBooking(
  client: Client,
  bookingId: string,
  changes: BookingChanges
): Promise<BookingRow> {
  const { stay, ...columns } = changes;
  const update: TablesUpdate<"bookings"> = { ...columns };

  if (stay) Object.assign(update, toStayInstants(stay.check_in, stay.check_out));
  if (changes.email) update.guest_id = await guestIdForEmail(client, changes.email, changes);

  return rowFrom(
    await client.from("bookings").update(update).eq("booking_id", bookingId).select().single()
  );
}

async function guestIdForEmail(
  client: Client,
  email: string,
  changes: BookingChanges
): Promise<string> {
  const { data: existing, error } = await client
    .from("guests")
    .select("guest_id")
    .eq("email", email)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (existing) return existing.guest_id;

  const { guest_id } = rowFrom(
    await client
      .from("guests")
      .insert({
        guest_name: changes.guest_name ?? email,
        email,
        phone_number: changes.contact_number ?? null,
      } satisfies TablesInsert<"guests">)
      .select("guest_id")
      .single()
  );
  return guest_id;
}

const STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["CheckedIn", "Cancelled"],
  CheckedIn: ["CheckedOut"],
  CheckedOut: [],
  Cancelled: [],
};

export const canTransitionStatus = (current: BookingStatus, next: BookingStatus) =>
  STATUS_TRANSITIONS[current]?.includes(next) ?? false;

export async function setBookingStatus(
  client: Client,
  bookingId: string,
  status: BookingStatus
): Promise<BookingRow> {
  const { booking_status } = rowFrom(
    await client.from("bookings").select("booking_status").eq("booking_id", bookingId).single()
  );
  if (!canTransitionStatus(booking_status as BookingStatus, status)) {
    throw new Error(`Cannot change a ${booking_status} booking to ${status}`);
  }
  return rowFrom(
    await client
      .from("bookings")
      .update({ booking_status: status } satisfies TablesUpdate<"bookings">)
      .eq("booking_id", bookingId)
      .select()
      .single()
  );
}

export const cancelBooking = (client: Client, bookingId: string) =>
  setBookingStatus(client, bookingId, "Cancelled");
