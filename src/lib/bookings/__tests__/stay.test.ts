import { describe, expect, it } from "vitest";

import { RESORT_OPERATION_HOURS } from "@/config/settings";
import {
  dayAfter,
  manilaDayOf,
  manilaDayStart,
  nightsBetween,
  pickedDay,
  toStayInstants,
} from "@/lib/bookings";

// src/lib/bookings/__tests__/stay.test.ts
process.env.TZ = "America/Los_Angeles";

const minutesOf = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

describe("stay convention", () => {
  it("runs outside Manila so browser-local mistakes show", () => {
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(480);
  });

  it("stores the check-in day at 14:00 and the check-out day at 12:00 Manila", () => {
    expect(toStayInstants("2026-10-15", "2026-10-17")).toEqual({
      check_in: "2026-10-15T06:00:00.000Z",
      check_out: "2026-10-17T04:00:00.000Z",
    });
  });

  it("rejects a check-out day on or before the check-in day", () => {
    expect(() => toStayInstants("2026-10-15", "2026-10-15")).toThrow(/after the check-in day/);
  });

  it("rejects anything that is not a YYYY-MM-DD day", () => {
    expect(() => toStayInstants("2026-10-15T00:00:00Z", "2026-10-17")).toThrow(/YYYY-MM-DD/);
  });

  it("reads the day the person picked, not the instant", () => {
    expect(pickedDay(new Date(2026, 9, 15))).toBe("2026-10-15");
  });

  it("reads the Manila day of a stored instant", () => {
    expect(manilaDayOf("2026-10-14T16:00:00.000Z")).toBe("2026-10-15");
    expect(manilaDayOf("2026-10-17T04:00:00.000Z")).toBe("2026-10-17");
  });

  it("counts nights as calendar days across a DST change", () => {
    expect(nightsBetween("2026-10-31", "2026-11-02")).toBe(2);
  });

  it("gives the first instant of a Manila day and the next day", () => {
    expect(manilaDayStart("2026-10-15")).toBe("2026-10-14T16:00:00.000Z");
    expect(dayAfter("2026-12-31")).toBe("2027-01-01");
  });
});

describe("RESORT_OPERATION_HOURS", () => {
  const checkIn = minutesOf(RESORT_OPERATION_HOURS.checkInTime);
  const checkOut = minutesOf(RESORT_OPERATION_HOURS.checkOutTime);

  it("has check-out before check-in so same-day turnover does not overlap", () => {
    expect(checkOut).toBeLessThan(checkIn);
  });

  it("keeps both times at 08:00 Manila or later so the UTC date is the Manila date", () => {
    expect(checkOut).toBeGreaterThanOrEqual(8 * 60);
    expect(checkIn).toBeGreaterThanOrEqual(8 * 60);
  });
});
