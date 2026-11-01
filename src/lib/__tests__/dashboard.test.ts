import { describe, expect, it } from "vitest";

import { monthNumbers, movementsOn, outstandingBalance, pendingCount } from "@/lib/dashboard";
import type { Booking, BookingStatus } from "@/types";

process.env.TZ = "America/Los_Angeles";

let nextId = 0;

function booking(
  checkIn: string,
  checkOut: string,
  overrides: Partial<Booking> & { status?: BookingStatus } = {}
): Booking {
  const { status = "Confirmed", ...rest } = overrides;
  nextId += 1;
  return {
    booking_id: `b${nextId}`,
    booking_reference: `REF-${nextId}`,
    guest_name: `Guest ${nextId}`,
    contact_number: null,
    email: null,
    num_guests: 2,
    check_in: checkIn,
    check_out: checkOut,
    total_amount: 5000,
    booking_status: status,
    payment_status: "Pending",
    created_at: null,
    updated_at: null,
    booking_units: [{ unit_id: "u1" } as NonNullable<Booking["booking_units"]>[number]],
    payments: [],
    ...rest,
  };
}

const ids = (bookings: Booking[]) => bookings.map((b) => b.booking_id);

describe("movementsOn", () => {
  it("finds check-ins and check-outs by Manila day, whatever the booking status", () => {
    const arriving = booking("2026-11-10T06:00:00Z", "2026-11-12T04:00:00Z", {
      status: "Confirmed",
    });
    const leavingNotCheckedIn = booking("2026-11-08T06:00:00Z", "2026-11-10T04:00:00Z", {
      status: "Confirmed",
    });
    const other = booking("2026-11-11T06:00:00Z", "2026-11-13T04:00:00Z");

    const day = movementsOn([arriving, leavingNotCheckedIn, other], "2026-11-10");

    expect(day.day).toBe("2026-11-10");
    expect(ids(day.checkIns)).toEqual([arriving.booking_id]);
    expect(ids(day.checkOuts)).toEqual([leavingNotCheckedIn.booking_id]);
  });

  it("hides cancelled bookings and keeps pending ones", () => {
    const cancelled = booking("2026-11-10T06:00:00Z", "2026-11-12T04:00:00Z", {
      status: "Cancelled",
    });
    const pending = booking("2026-11-10T06:00:00Z", "2026-11-12T04:00:00Z", { status: "Pending" });

    expect(ids(movementsOn([cancelled, pending], "2026-11-10").checkIns)).toEqual([
      pending.booking_id,
    ]);
  });

  it("lists as staying only the nights between the check-in and check-out days", () => {
    const stay = booking("2026-11-09T06:00:00Z", "2026-11-12T04:00:00Z");

    expect(ids(movementsOn([stay], "2026-11-09").staying)).toEqual([]);
    expect(ids(movementsOn([stay], "2026-11-10").staying)).toEqual([stay.booking_id]);
    expect(ids(movementsOn([stay], "2026-11-11").staying)).toEqual([stay.booking_id]);
    expect(ids(movementsOn([stay], "2026-11-12").staying)).toEqual([]);
  });

  it("uses the Manila day of a check-in instant that is late on the UTC day", () => {
    // 17:00Z on Nov 9 is 01:00 on Nov 10 in Manila
    const lateArrival = booking("2026-11-09T17:00:00Z", "2026-11-11T04:00:00Z");

    expect(ids(movementsOn([lateArrival], "2026-11-09").checkIns)).toEqual([]);
    expect(ids(movementsOn([lateArrival], "2026-11-10").checkIns)).toEqual([
      lateArrival.booking_id,
    ]);
  });
});

describe("monthNumbers", () => {
  const november = new Date(2026, 10, 1);

  it("counts the booked cabin nights of confirmed bookings only", () => {
    const bookings = [
      booking("2026-11-10T06:00:00Z", "2026-11-12T04:00:00Z", { status: "Confirmed" }),
      booking("2026-11-03T06:00:00Z", "2026-11-04T04:00:00Z", { status: "CheckedOut" }),
      booking("2026-11-20T06:00:00Z", "2026-11-25T04:00:00Z", { status: "Pending" }),
      booking("2026-11-20T06:00:00Z", "2026-11-25T04:00:00Z", { status: "Cancelled" }),
    ];

    const numbers = monthNumbers(bookings, november, 3);

    expect(numbers.bookedCabinNights).toBe(3);
    expect(numbers.occupancy).toBeCloseTo(3 / 90);
  });

  it("counts only the nights inside the month of a stay that crosses into the next month", () => {
    // Nights Nov 29, Nov 30, Dec 1
    const crossing = booking("2026-11-29T06:00:00Z", "2026-12-02T04:00:00Z");

    expect(monthNumbers([crossing], november, 3).bookedCabinNights).toBe(2);
    expect(monthNumbers([crossing], new Date(2026, 11, 1), 3).bookedCabinNights).toBe(1);
  });

  it("counts one cabin night per unit per night of a multi-cabin booking", () => {
    const twoCabins = booking("2026-11-10T06:00:00Z", "2026-11-12T04:00:00Z", {
      booking_units: [
        { unit_id: "u1" } as NonNullable<Booking["booking_units"]>[number],
        { unit_id: "u2" } as NonNullable<Booking["booking_units"]>[number],
      ],
    });

    expect(monthNumbers([twoCabins], november, 3).bookedCabinNights).toBe(4);
  });

  it("counts confirmed bookings by their check-in day", () => {
    const bookings = [
      booking("2026-10-30T06:00:00Z", "2026-11-02T04:00:00Z"),
      booking("2026-11-29T06:00:00Z", "2026-12-02T04:00:00Z"),
      booking("2026-11-10T06:00:00Z", "2026-11-12T04:00:00Z", { status: "CheckedIn" }),
      booking("2026-11-10T06:00:00Z", "2026-11-12T04:00:00Z", { status: "Pending" }),
    ];

    expect(monthNumbers(bookings, november, 3).confirmedCount).toBe(2);
  });
});

describe("outstandingBalance", () => {
  it("subtracts only counted payments, so soft-deleted and refunded ones are owed again", () => {
    const partlyPaid = booking("2026-11-10T06:00:00Z", "2026-11-12T04:00:00Z", {
      total_amount: 5000,
      payments: [
        { amount: 2000, status: "Active" },
        { amount: 1000, status: "Deleted" },
        { amount: 500, status: "Refunded" },
      ],
    });

    expect(outstandingBalance(partlyPaid)).toBe(3000);
  });

  it("is never below 0", () => {
    const overpaid = booking("2026-11-10T06:00:00Z", "2026-11-12T04:00:00Z", {
      total_amount: 5000,
      payments: [{ amount: 6000, status: "Active" }],
    });

    expect(outstandingBalance(overpaid)).toBe(0);
  });
});

describe("pendingCount", () => {
  it("counts the guest bookings that wait in the queue for units", () => {
    const waiting = { is_guest_booking: true, unit_assignment_status: "pending" };
    const bookings = [
      booking("2026-11-10T06:00:00Z", "2026-11-12T04:00:00Z", { status: "Pending", ...waiting }),
      booking("2026-12-10T06:00:00Z", "2026-12-12T04:00:00Z", { status: "Pending", ...waiting }),
      booking("2026-11-10T06:00:00Z", "2026-11-12T04:00:00Z", { status: "Pending" }),
      booking("2026-11-10T06:00:00Z", "2026-11-12T04:00:00Z", {
        status: "Pending",
        is_guest_booking: true,
        unit_assignment_status: "assigned",
      }),
    ];

    expect(pendingCount(bookings)).toBe(2);
  });
});
