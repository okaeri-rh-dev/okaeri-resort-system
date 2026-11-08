import { z } from "zod";

import { PAYMENT_STATUSES, type Booking } from "@/types";

import { BOOKING_SOURCES } from "./source";
import { isManilaDay, manilaDayOf, type ManilaDay } from "./stay";

// The bookings list's URL rules. Bad values drop out; defaults stay out of the URL.

export const BOOKING_VIEWS = ["upcoming", "in-house", "needs-action", "past", "cancelled"] as const;
export type BookingView = (typeof BOOKING_VIEWS)[number];

const lowercased = <T extends string>(values: readonly T[]) =>
  values.map((value) => value.toLowerCase() as Lowercase<T>);

const SOURCE_PARAMS = lowercased(BOOKING_SOURCES);
const PAYMENT_PARAMS = lowercased(PAYMENT_STATUSES);

const isText = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";

const isDay = (value: unknown): value is string => typeof value === "string" && isManilaDay(value);

const oneOf =
  <T extends string>(values: readonly T[]) =>
  (value: unknown): value is T =>
    values.includes(value as T);

export const isBookingView = oneOf(BOOKING_VIEWS);

const validOrUndefined = <T>(keep: (value: unknown) => value is T) =>
  z
    .unknown()
    .transform((value) => (keep(value) ? value : undefined))
    .optional();

const listOf = <T extends string>(keep: (value: unknown) => value is T) =>
  z
    .unknown()
    .transform((value) => {
      const kept = (Array.isArray(value) ? value : [value]).filter(keep);
      return kept.length > 0 ? kept : undefined;
    })
    .optional();

const bookingsSearchSchema = z.object({
  view: validOrUndefined(isBookingView),
  q: validOrUndefined(isText),
  source: listOf(oneOf(SOURCE_PARAMS)),
  payment: listOf(oneOf(PAYMENT_PARAMS)),
  cabin: listOf(isText),
  from: validOrUndefined(isDay),
  to: validOrUndefined(isDay),
  booking: validOrUndefined(isText),
});

export type BookingsSearch = z.output<typeof bookingsSearchSchema>;

// Every key is set, even to undefined, so it overrides the raw value the router keeps beside it.
// The router leaves undefined values out of the URL.
const NO_SEARCH = Object.fromEntries(
  bookingsSearchSchema.keyof().options.map((key) => [key, undefined])
);

export const parseBookingsSearch = (raw: Record<string, unknown>): BookingsSearch => ({
  ...NO_SEARCH,
  ...bookingsSearchSchema.parse(raw),
});

const FILTER_KEYS = ["q", "source", "payment", "cabin", "from", "to"] as const;

export const hasBookingFilters = (search: BookingsSearch) =>
  FILTER_KEYS.some((key) => search[key] !== undefined);

export type NeedsActionReason = "Not checked in" | "Not checked out";

// Views, needs action and the check-in day use Manila days (docs/adr/0002)
export const needsActionReason = (
  booking: Booking,
  today: ManilaDay
): NeedsActionReason | undefined => {
  if (booking.booking_status === "Confirmed" && manilaDayOf(booking.check_in) < today) {
    return "Not checked in";
  }
  if (booking.booking_status === "CheckedIn" && manilaDayOf(booking.check_out) < today) {
    return "Not checked out";
  }
  return undefined;
};

/** The glossary's Needs-action booking. A balance alone never counts. */
export const isNeedsAction = (booking: Booking, today: ManilaDay) =>
  booking.booking_status === "Pending" || needsActionReason(booking, today) !== undefined;

const inView = (booking: Booking, view: BookingView | undefined, today: ManilaDay) => {
  switch (view) {
    case undefined:
      return true;
    case "upcoming":
      return (
        (booking.booking_status === "Pending" || booking.booking_status === "Confirmed") &&
        manilaDayOf(booking.check_in) >= today
      );
    case "in-house":
      return booking.booking_status === "CheckedIn";
    case "needs-action":
      return isNeedsAction(booking, today);
    case "past":
      return booking.booking_status === "CheckedOut";
    case "cancelled":
      return booking.booking_status === "Cancelled";
  }
};

const digitsOf = (value: string) => value.replace(/\D/g, "");

const matchesQuery = (booking: Booking, query: string | undefined) => {
  if (!query) return true;
  const text = query.trim().toLowerCase();
  const digits = /^[\d\s+()-]+$/.test(query) ? digitsOf(query) : "";
  return (
    [
      booking.guest_name,
      booking.email,
      booking.booking_reference,
      booking.airbnb_confirmation_code,
    ].some((field) => field?.toLowerCase().includes(text)) ||
    (digits !== "" && digitsOf(booking.contact_number ?? "").includes(digits))
  );
};

const pickedOrAll = (picked: string[] | undefined, value: string | null | undefined) =>
  !picked || picked.includes(value?.toLowerCase() ?? "");

// A stay's nights run from its check-in day up to the day before check-out
const hasNightIn = (booking: Booking, from: ManilaDay | undefined, to: ManilaDay | undefined) =>
  (!to || manilaDayOf(booking.check_in) <= to) && (!from || manilaDayOf(booking.check_out) > from);

const matchesFilters = (booking: Booking, search: BookingsSearch) =>
  pickedOrAll(search.source, booking.booking_source) &&
  pickedOrAll(search.payment, booking.payment_status) &&
  (!search.cabin ||
    (booking.booking_units ?? []).some(({ unit_id }) => search.cabin?.includes(unit_id))) &&
  hasNightIn(booking, search.from, search.to);

const EARLIEST_FIRST: ReadonlySet<BookingView | undefined> = new Set([
  "upcoming",
  "in-house",
  "needs-action",
]);

const checkInTime = (booking: Booking) => new Date(booking.check_in).getTime();

export const selectBookings = (bookings: Booking[], search: BookingsSearch, today: ManilaDay) => {
  const direction = EARLIEST_FIRST.has(search.view) ? 1 : -1;
  return {
    bookings: bookings
      .filter(
        (booking) =>
          inView(booking, search.view, today) &&
          matchesQuery(booking, search.q) &&
          matchesFilters(booking, search)
      )
      .sort((a, b) => direction * (checkInTime(a) - checkInTime(b))),
    needsActionCount: bookings.filter((booking) => isNeedsAction(booking, today)).length,
  };
};
