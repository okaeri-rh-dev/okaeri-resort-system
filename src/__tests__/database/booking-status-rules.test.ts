/**
 * The database allows only the status moves of ADR 0007, each for its roles,
 * and records who made the last status change and when.
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { AppRoleName } from "@/types/app-role";
import type { BookingStatus } from "@/types/booking-status";

import { createRoleClients, type RoleClients } from "../setup/role-clients";
import {
  cleanupTestData,
  createTestBooking,
  testSupabaseAdmin as service,
  shouldRunDatabaseTests,
} from "../setup/test-db";

const DAY_MS = 24 * 60 * 60 * 1000;

let roleClients: RoleClients;
let shouldRun = false;

async function bookingIn(status: BookingStatus, checkInDaysFromToday = 0) {
  return createTestBooking({
    booking_status: status,
    check_in: new Date(Date.now() + checkInDaysFromToday * DAY_MS),
  });
}

const moveAs = (role: AppRoleName, bookingId: string, status: BookingStatus) =>
  roleClients.byRole[role]
    .from("bookings")
    .update({ booking_status: status })
    .eq("booking_id", bookingId)
    .select("booking_status, status_changed_by, status_changed_at")
    .single();

describe("booking status rules", () => {
  beforeAll(async () => {
    vi.useRealTimers(); // the check-in day rule reads the database clock
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) return;
    await cleanupTestData({ includeTestFixtures: true });
    roleClients = await createRoleClients("status-rules");
  }, 60000);

  afterAll(async () => {
    if (!shouldRun) return;
    await roleClients.cleanup();
    await cleanupTestData({ includeTestFixtures: true });
  });

  it.each([
    ["Pending", "Confirmed", "manager"],
    ["Pending", "Confirmed", "owner"],
    ["Pending", "Confirmed", "admin"],
    ["Confirmed", "CheckedIn", "staff"],
    ["Confirmed", "CheckedIn", "manager"],
    ["CheckedIn", "CheckedOut", "staff"],
    ["CheckedIn", "CheckedOut", "manager"],
    ["Pending", "Cancelled", "manager"],
    ["Confirmed", "Cancelled", "manager"],
  ] as const)("allows %s → %s for %s", async (from, to, role) => {
    if (!shouldRun) return;
    const booking = await bookingIn(from);

    const { data, error } = await moveAs(role, booking.booking_id, to);

    expect(error).toBeNull();
    expect(data?.booking_status).toBe(to);
  });

  it.each([
    ["Pending", "Confirmed", "staff"],
    ["Pending", "Cancelled", "staff"],
    ["Confirmed", "Cancelled", "staff"],
    ["Confirmed", "Pending", "manager"],
    ["Pending", "CheckedIn", "manager"],
    ["Confirmed", "CheckedOut", "manager"],
    ["CheckedIn", "Cancelled", "manager"],
    ["CheckedOut", "Cancelled", "admin"],
    ["Cancelled", "Pending", "admin"],
    ["Cancelled", "Confirmed", "admin"],
  ] as const)("refuses %s → %s for %s", async (from, to, role) => {
    if (!shouldRun) return;
    const booking = await bookingIn(from);

    const { error } = await moveAs(role, booking.booking_id, to);

    expect(error?.code).toBe("42501");
    const { data } = await service
      .from("bookings")
      .select("booking_status")
      .eq("booking_id", booking.booking_id)
      .single();
    expect(data?.booking_status).toBe(from);
  });

  it.each(["staff", "admin"] as const)(
    "refuses check-in before the check-in day for %s",
    async (role) => {
      if (!shouldRun) return;
      const booking = await bookingIn("Confirmed", 1);

      const { error } = await moveAs(role, booking.booking_id, "CheckedIn");

      expect(error?.code).toBe("42501");
    }
  );

  it("records who changed the status and when", async () => {
    if (!shouldRun) return;
    const booking = await bookingIn("Confirmed");
    const {
      data: { user },
    } = await roleClients.byRole.staff.auth.getUser();
    const before = Date.now();

    const { data } = await moveAs("staff", booking.booking_id, "CheckedIn");

    expect(data?.status_changed_by).toBe(user?.id);
    expect(new Date(data?.status_changed_at ?? 0).getTime()).toBeGreaterThanOrEqual(
      before - 60_000
    );
  });

  it("judges the check-in day by the stored day, not one moved in the same update", async () => {
    if (!shouldRun) return;
    const booking = await bookingIn("Confirmed", 1);

    const { error } = await roleClients.byRole.manager
      .from("bookings")
      .update({ check_in: new Date().toISOString(), booking_status: "CheckedIn" })
      .eq("booking_id", booking.booking_id);

    expect(error?.code).toBe("42501");
  });

  const shiftCheckIn = (role: AppRoleName, bookingId: string, checkIn: string, hours: number) =>
    roleClients.byRole[role]
      .from("bookings")
      .update({ check_in: new Date(Date.parse(checkIn) + hours * 60 * 60 * 1000).toISOString() })
      .eq("booking_id", bookingId);

  it("refuses staff a new check-in day on a Confirmed booking", async () => {
    if (!shouldRun) return;
    const booking = await createTestBooking({ booking_status: "Confirmed" });

    const { error } = await shiftCheckIn("staff", booking.booking_id, booking.check_in, -24);

    expect(error?.code).toBe("42501");
  });

  it.each([
    ["manager", "Confirmed", -24],
    ["staff", "Pending", -24],
    ["staff", "Confirmed", 1],
  ] as const)(
    "lets %s move the check-in of a %s booking by %i hours",
    async (role, status, hours) => {
      if (!shouldRun) return;
      const booking = await createTestBooking({
        booking_status: status,
        check_in: new Date("2030-03-10T06:00:00Z"),
      });

      const { error } = await shiftCheckIn(role, booking.booking_id, booking.check_in, hours);

      expect(error).toBeNull();
    }
  );
});
