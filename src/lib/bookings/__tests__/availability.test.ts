import { describe, expect, it } from "vitest";

import { unavailableReason, type UnitAvailability } from "@/lib/bookings";

process.env.TZ = "America/Los_Angeles";

const results: UnitAvailability[] = [
  {
    unit_id: "free",
    unit_name: "Cabin 1",
    is_available: true,
    reason: null,
    conflicting_bookings: 0,
    next_available_date: null,
  },
  {
    unit_id: "booked",
    unit_name: "Cabin 3",
    is_available: false,
    reason: "Booked",
    conflicting_bookings: 1,
    next_available_date: "2026-12-23T04:00:00.000Z",
  },
  {
    unit_id: "blocked",
    unit_name: "Cabin 2",
    is_available: false,
    reason: "Blocked",
    conflicting_bookings: 1,
    next_available_date: "2026-12-23T04:00:00.000Z",
  },
];

describe("unavailableReason", () => {
  it("runs outside Manila so browser-local mistakes show", () => {
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(480);
  });

  it("is null while availability is still loading", () => {
    expect(unavailableReason(undefined, "booked")).toBeNull();
  });

  it("is null for a free unit", () => {
    expect(unavailableReason(results, "free")).toBeNull();
  });

  it("says the Manila day a booked unit frees up", () => {
    expect(unavailableReason(results, "booked")).toBe("Booked until Dec 23");
  });

  it("says Blocked for a blocked unit, even when it is also booked", () => {
    expect(unavailableReason(results, "blocked")).toBe("Blocked");
  });

  it("marks a unit missing from the result as not bookable", () => {
    expect(unavailableReason(results, "unknown")).toBe("Not available");
  });
});
