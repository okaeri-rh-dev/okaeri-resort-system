import type { SupabaseClient } from "@supabase/supabase-js";

import type { TableName } from "@/lib/after-write";
import type { BookingStatus } from "@/types/booking-status";
import type { Database, Tables, TablesUpdate } from "@/types/database.types";

import { BlockedUnitError, isBlockedNightError } from "./availability";
import { DuplicateConfirmationCodeError, isDuplicateConfirmationCode } from "./confirmation-code";
import type { BookingSource } from "./source";
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
  booking_source: BookingSource;
  airbnb_confirmation_code: string | null;
  /** Manager and above only; split across the cabins by the database. */
  total_amount: number;
}> & { stay?: { check_in: ManilaDay; check_out: ManilaDay } };

type Result<T> = { data: T | null; error: { message: string; code?: string } | null };

const EXCLUSION_VIOLATION = "23P01";

function throwIfError(error: Result<unknown>["error"]) {
  if (error?.code === EXCLUSION_VIOLATION) {
    throw new Error("This unit is already booked for some of these days");
  }
  if (isBlockedNightError(error)) throw new BlockedUnitError();
  if (isDuplicateConfirmationCode(error)) throw new DuplicateConfirmationCodeError();
  if (error) throw new Error(error.message);
}

function rowFrom<T>({ data, error }: Result<T>): NonNullable<T> {
  throwIfError(error);
  if (data === null || data === undefined) throw new Error("The booking was not returned");
  return data;
}

// Tables updateBooking writes: an email with no guest inserts one, and a new total calls set_booking_total
export const UPDATE_BOOKING_WRITES = [
  "bookings",
  "guests",
  "booking_units",
  "payments",
] as const satisfies readonly TableName[];

export async function updateBooking(
  client: Client,
  bookingId: string,
  changes: BookingChanges
): Promise<BookingRow> {
  const { stay, total_amount, ...columns } = changes;
  const update: TablesUpdate<"bookings"> = { ...columns };

  if (stay) Object.assign(update, toStayInstants(stay.check_in, stay.check_out));

  const { error } = await client.rpc("update_booking", {
    p_booking_id: bookingId,
    p_changes: update,
    p_total: total_amount,
  });
  throwIfError(error);
  return rowFrom(await client.from("bookings").select().eq("booking_id", bookingId).single());
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
