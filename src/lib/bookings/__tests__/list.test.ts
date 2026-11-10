import { describe, expect, it } from "vitest";

import {
  isNeedsAction,
  mainActionFor,
  needsActionReason,
  overflowActionsFor,
  parseBookingsSearch,
  selectBookings,
  toStayInstants,
} from "@/lib/bookings";
import type { Booking, BookingStatus } from "@/types";

// src/lib/bookings/__tests__/list.test.ts
process.env.TZ = "America/Los_Angeles";

describe("parseBookingsSearch", () => {
  it("reads every list param", () => {
    expect(
      parseBookingsSearch({
        view: "needs-action",
        q: "Santos",
        source: ["airbnb", "walk-in"],
        payment: ["partial"],
        cabin: ["unit-1"],
        from: "2026-10-01",
        to: "2026-10-31",
        booking: "booking-1",
      })
    ).toEqual({
      view: "needs-action",
      q: "Santos",
      source: ["airbnb", "walk-in"],
      payment: ["partial"],
      cabin: ["unit-1"],
      from: "2026-10-01",
      to: "2026-10-31",
      booking: "booking-1",
    });
  });

  it("leaves out defaults, so no view means All", () => {
    expect(parseBookingsSearch({})).toEqual({});
    expect(parseBookingsSearch({ q: "  ", source: [], cabin: [""] })).toEqual({});
  });

  it("drops bad values with no error", () => {
    expect(
      parseBookingsSearch({
        view: "NoShow",
        q: 42,
        source: ["airbnb", "facebook"],
        payment: "partial",
        from: "2026-02-30",
        to: "tomorrow",
        booking: { id: 1 },
      })
    ).toEqual({ source: ["airbnb"], payment: ["partial"] });
  });

  it("sets every list key, so it overrides the raw value the router keeps", () => {
    expect({ q: "Santos", status: "Confirmed", ...parseBookingsSearch({}) }).toStrictEqual({
      status: "Confirmed",
      view: undefined,
      q: undefined,
      source: undefined,
      payment: undefined,
      cabin: undefined,
      from: undefined,
      to: undefined,
      booking: undefined,
    });
  });

  it("ignores the old status, search and page params", () => {
    expect(parseBookingsSearch({ status: "Confirmed", search: "OKR", page: 3 })).toEqual({});
  });
});

const TODAY = "2026-10-15";

let nextId = 0;
const booking = (
  status: BookingStatus,
  checkInDay: string,
  checkOutDay: string,
  fields: Partial<Booking> = {}
): Booking =>
  ({
    booking_id: `booking-${++nextId}`,
    booking_reference: `OKR-${nextId}`,
    guest_name: "Guest",
    email: null,
    contact_number: null,
    booking_status: status,
    payment_status: "Pending",
    ...toStayInstants(checkInDay, checkOutDay),
    ...fields,
  }) as Booking;

const ids = (bookings: Booking[]) => bookings.map(({ booking_id }) => booking_id);

describe("isNeedsAction", () => {
  it("holds every pending booking", () => {
    expect(isNeedsAction(booking("Pending", "2026-11-01", "2026-11-03"), TODAY)).toBe(true);
    expect(
      needsActionReason(booking("Pending", "2026-11-01", "2026-11-03"), TODAY)
    ).toBeUndefined();
  });

  it("holds a confirmed booking only after its check-in day", () => {
    expect(isNeedsAction(booking("Confirmed", "2026-10-15", "2026-10-17"), TODAY)).toBe(false);
    const missed = booking("Confirmed", "2026-10-14", "2026-10-17");
    expect(isNeedsAction(missed, TODAY)).toBe(true);
    expect(needsActionReason(missed, TODAY)).toBe("Not checked in");
  });

  it("holds a checked-in booking only after its check-out day", () => {
    expect(isNeedsAction(booking("CheckedIn", "2026-10-13", "2026-10-15"), TODAY)).toBe(false);
    const stayed = booking("CheckedIn", "2026-10-12", "2026-10-14");
    expect(isNeedsAction(stayed, TODAY)).toBe(true);
    expect(needsActionReason(stayed, TODAY)).toBe("Not checked out");
  });

  it("ignores an outstanding balance and closed bookings", () => {
    const unpaid = { payment_status: "Partial" };
    expect(isNeedsAction(booking("CheckedOut", "2026-10-01", "2026-10-03", unpaid), TODAY)).toBe(
      false
    );
    expect(isNeedsAction(booking("Cancelled", "2026-10-01", "2026-10-03"), TODAY)).toBe(false);
  });

  it("reads the check-in day in Manila, not UTC", () => {
    // 00:30 on 15 October in Manila is still 14 October in UTC
    const lateNight = booking("Confirmed", "2026-10-14", "2026-10-17", {
      check_in: "2026-10-14T16:30:00.000Z",
    });
    expect(isNeedsAction(lateNight, TODAY)).toBe(false);
  });
});

describe("selectBookings views", () => {
  const pending = booking("Pending", "2026-10-20", "2026-10-22");
  const lostPending = booking("Pending", "2026-10-10", "2026-10-12");
  const confirmedToday = booking("Confirmed", "2026-10-15", "2026-10-16");
  const missedCheckIn = booking("Confirmed", "2026-10-14", "2026-10-16");
  const inHouse = booking("CheckedIn", "2026-10-14", "2026-10-16");
  const overstay = booking("CheckedIn", "2026-10-12", "2026-10-14");
  const past = booking("CheckedOut", "2026-10-01", "2026-10-03");
  const cancelled = booking("Cancelled", "2026-10-18", "2026-10-19");
  const all = [
    pending,
    lostPending,
    confirmedToday,
    missedCheckIn,
    inHouse,
    overstay,
    past,
    cancelled,
  ];

  const view = (search: Parameters<typeof selectBookings>[1]) =>
    ids(selectBookings(all, search, TODAY).bookings).sort();

  it("shows every booking with no view, cancelled ones included", () => {
    expect(view({})).toEqual(ids(all).sort());
  });

  it("shows pending and confirmed bookings from today on as Upcoming", () => {
    expect(view({ view: "upcoming" })).toEqual(ids([pending, confirmedToday]).sort());
  });

  it("shows checked-in bookings as In-house", () => {
    expect(view({ view: "in-house" })).toEqual(ids([inHouse, overstay]).sort());
  });

  it("shows the bookings that wait for staff as Needs action", () => {
    expect(view({ view: "needs-action" })).toEqual(
      ids([pending, lostPending, missedCheckIn, overstay]).sort()
    );
  });

  it("shows checked-out bookings as Past and cancelled ones as Cancelled", () => {
    expect(view({ view: "past" })).toEqual(ids([past]));
    expect(view({ view: "cancelled" })).toEqual(ids([cancelled]));
  });

  it("counts Needs action over every booking", () => {
    expect(selectBookings(all, { view: "past", q: "nobody" }, TODAY).needsActionCount).toBe(4);
  });
});

describe("selectBookings search", () => {
  const santos = booking("Confirmed", "2026-10-20", "2026-10-22", {
    guest_name: "Maria Santos",
    email: "maria@example.com",
    booking_reference: "OKR-20261020-AB12",
    contact_number: "0917 123 4567",
  });
  const airbnb = booking("Pending", "2026-10-21", "2026-10-23", {
    guest_name: "Ken Ito",
    airbnb_confirmation_code: "HMXYZ123",
  });
  const cancelledSantos = booking("Cancelled", "2026-10-25", "2026-10-26", {
    guest_name: "Jose Santos",
  });
  const all = [santos, airbnb, cancelledSantos];

  const found = (q: string, view?: "upcoming") =>
    ids(selectBookings(all, { q, view }, TODAY).bookings).sort();

  it("matches the guest name, email and reference, ignoring case", () => {
    expect(found("santos")).toEqual(ids([santos, cancelledSantos]).sort());
    expect(found("MARIA@EXAMPLE")).toEqual(ids([santos]));
    expect(found("ab12")).toEqual(ids([santos]));
  });

  it("matches the Airbnb confirmation code", () => {
    expect(found("hmxyz")).toEqual(ids([airbnb]));
  });

  it("matches the phone on digits only", () => {
    expect(found("09171234567")).toEqual(ids([santos]));
    expect(found("123-4567")).toEqual(ids([santos]));
  });

  it("does not match every phone when the query has no digits", () => {
    expect(found("nobody")).toEqual([]);
  });

  it("matches the phone only for a phone-like query", () => {
    expect(found("(0917) 123")).toEqual(ids([santos]));
    expect(found("Ito1")).toEqual([]);
  });

  it("searches inside the current view", () => {
    expect(found("santos", "upcoming")).toEqual(ids([santos]));
  });
});

describe("selectBookings filters", () => {
  const airbnb = booking("Confirmed", "2026-10-10", "2026-10-13", {
    booking_source: "Airbnb",
    payment_status: "Completed",
    booking_units: [{ unit_id: "unit-1" }, { unit_id: "unit-2" }] as Booking["booking_units"],
  });
  const walkIn = booking("Pending", "2026-10-13", "2026-10-14", {
    booking_source: "Walk-in",
    payment_status: "Partial",
    booking_units: [{ unit_id: "unit-3" }] as Booking["booking_units"],
  });
  const direct = booking("Confirmed", "2026-10-20", "2026-10-22", { booking_source: "Direct" });
  const all = [airbnb, walkIn, direct];

  const filtered = (search: Parameters<typeof selectBookings>[1]) =>
    ids(selectBookings(all, search, TODAY).bookings).sort();

  it("keeps any picked source, payment status or cabin", () => {
    expect(filtered({ source: ["airbnb", "walk-in"] })).toEqual(ids([airbnb, walkIn]).sort());
    expect(filtered({ payment: ["partial"] })).toEqual(ids([walkIn]));
    expect(filtered({ cabin: ["unit-2", "unit-3"] })).toEqual(ids([airbnb, walkIn]).sort());
  });

  it("keeps a booking with any night in the date range", () => {
    // airbnb has nights 10–12 October; walkIn has the night of 13 October
    expect(filtered({ from: "2026-10-12", to: "2026-10-12" })).toEqual(ids([airbnb]));
    expect(filtered({ from: "2026-10-13", to: "2026-10-13" })).toEqual(ids([walkIn]));
    expect(filtered({ from: "2026-10-21" })).toEqual(ids([direct]));
    expect(filtered({ to: "2026-10-10" })).toEqual(ids([airbnb]));
  });
});

describe("selectBookings sort", () => {
  const early = booking("Pending", "2026-10-16", "2026-10-17");
  const middle = booking("Confirmed", "2026-10-20", "2026-10-21");
  const late = booking("Pending", "2026-11-02", "2026-11-04");
  const all = [middle, late, early];

  const order = (view?: "upcoming" | "needs-action") =>
    ids(selectBookings(all, { view }, TODAY).bookings);

  it("puts the earliest check-in first in Upcoming, In-house and Needs action", () => {
    expect(order("upcoming")).toEqual(ids([early, middle, late]));
    expect(order("needs-action")).toEqual(ids([early, late]));
  });

  it("puts the latest check-in first in All, Past and Cancelled", () => {
    expect(order()).toEqual(ids([late, middle, early]));
  });
});

describe("mainActionFor", () => {
  const website = { booking_source: "Website" } as const;
  const direct = { booking_source: "Direct" } as const;

  it.each([
    ["Pending", "2026-10-20", website, "manager", "Verify payment"],
    ["Pending", "2026-10-20", website, "admin", "Verify payment"],
    ["Pending", "2026-10-20", website, "staff", undefined],
    ["Pending", "2026-10-20", direct, "owner", "Confirm"],
    ["Pending", "2026-10-20", direct, "staff", undefined],
    ["Confirmed", "2026-10-15", direct, "staff", "Check in"],
    ["Confirmed", "2026-10-12", direct, "manager", "Check in"],
    ["Confirmed", "2026-10-16", direct, "manager", undefined],
    ["CheckedIn", "2026-10-13", direct, "staff", "Check out"],
    ["CheckedOut", "2026-10-10", direct, "admin", undefined],
    ["Cancelled", "2026-10-20", direct, "admin", undefined],
    ["Confirmed", "2026-10-15", direct, undefined, undefined],
  ] as const)("gives %s from %s (%o) for %s: %s", (status, checkIn, fields, role, action) => {
    const stay = booking(status, checkIn, "2026-10-25", fields);
    expect(mainActionFor(stay, role, TODAY)).toBe(action);
  });

  it("reads the check-in day in Manila, not UTC", () => {
    // 00:30 on 16 October in Manila is still 15 October in UTC
    const early = booking("Confirmed", "2026-10-16", "2026-10-18", {
      check_in: "2026-10-15T16:30:00.000Z",
    });
    expect(mainActionFor(early, "staff", TODAY)).toBeUndefined();
  });
});

describe("overflowActionsFor", () => {
  const NOW = new Date("2026-10-15T04:00:00Z");
  const due = { total_amount: 5000, payments: [{ amount: 2000, status: "Active" }] };
  const paid = { total_amount: 5000, payments: [{ amount: 5000, status: "Active" }] };
  const items = (
    status: BookingStatus,
    role: "staff" | "manager" | "owner" | "admin" | undefined,
    fields: Partial<Booking> = due,
    actor?: string
  ) =>
    overflowActionsFor(
      booking(status, "2026-10-15", "2026-10-17", fields),
      role,
      TODAY,
      actor,
      NOW
    );

  it.each([
    ["Pending", "manager", due, ["Record payment", "Edit", "Cancel"]],
    ["Pending", "staff", due, ["Record payment", "Edit"]],
    ["Confirmed", "owner", paid, ["Edit", "Cancel"]],
    ["Confirmed", "staff", paid, ["Edit"]],
    ["CheckedIn", "staff", due, ["Record payment", "Edit"]],
    ["CheckedIn", "admin", paid, ["Edit", "Undo check-in"]],
    ["CheckedOut", "staff", due, ["Record payment"]],
    ["CheckedOut", "staff", paid, []],
    ["CheckedOut", "manager", due, ["Record payment", "Undo check-out"]],
    ["Cancelled", "admin", due, []],
    ["Pending", undefined, due, []],
  ] as const)("lists %s for %s (%o): %o", (status, role, fields, expected) => {
    expect(items(status, role, fields)).toEqual(expected);
  });

  it("lets the user who checked in undo it within 2 minutes, not after", () => {
    const changed = (secondsAgo: number) => ({
      ...paid,
      status_changed_by: "staff-1",
      status_changed_at: new Date(NOW.getTime() - secondsAgo * 1000).toISOString(),
    });
    expect(items("CheckedIn", "staff", changed(119), "staff-1")).toContain("Undo check-in");
    expect(items("CheckedOut", "staff", changed(60), "staff-1")).toEqual(["Undo check-out"]);
    expect(items("CheckedIn", "staff", changed(121), "staff-1")).not.toContain("Undo check-in");
    expect(items("CheckedIn", "staff", changed(30), "staff-2")).not.toContain("Undo check-in");
  });
});
