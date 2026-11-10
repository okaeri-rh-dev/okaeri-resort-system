/**
 * Undo check-in (CheckedIn → Confirmed) and undo check-out (CheckedOut → CheckedIn):
 * the user who made the change within 2 minutes, or a manager at any time (docs/adr/0007).
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { manilaDayOf } from "@/lib/bookings/stay";
import type { AppRoleName } from "@/types/app-role";
import type { BookingStatus } from "@/types/booking-status";

import { createRoleClients, type RoleClients, type TestClient } from "../setup/role-clients";
import {
  cleanupTestData,
  createTestBooking,
  testSupabaseAdmin as service,
  shouldRunDatabaseTests,
} from "../setup/test-db";

const DAY_MS = 24 * 60 * 60 * 1000;
const BLOCKED_NIGHT_CODE = "BLOCK";
const EXCLUSION_CODE = "23P01";

let roleClients: RoleClients;
let otherStaff: RoleClients;
let shouldRun = false;

const move = (client: TestClient, bookingId: string, status: BookingStatus) =>
  client
    .from("bookings")
    .update({ booking_status: status })
    .eq("booking_id", bookingId)
    .select("booking_status")
    .single();

const moveAs = (role: AppRoleName, bookingId: string, status: BookingStatus) =>
  move(roleClients.byRole[role], bookingId, status);

async function statusOf(bookingId: string) {
  const { data } = await service
    .from("bookings")
    .select("booking_status")
    .eq("booking_id", bookingId)
    .single();
  return data?.booking_status;
}

async function checkedInBy(role: AppRoleName) {
  const booking = await createTestBooking({ booking_status: "Confirmed", check_in: new Date() });
  const { error } = await moveAs(role, booking.booking_id, "CheckedIn");
  if (error) throw new Error(`check in failed: ${error.message}`);
  return booking;
}

async function backdateStatusChange(bookingId: string, minutesAgo: number) {
  const { error } = await service
    .from("bookings")
    .update({ status_changed_at: new Date(Date.now() - minutesAgo * 60_000).toISOString() })
    .eq("booking_id", bookingId);
  if (error) throw new Error(`backdate failed: ${error.message}`);
}

describe("booking status undo", () => {
  beforeAll(async () => {
    vi.useRealTimers(); // the 2-minute window reads the database clock
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) return;
    await cleanupTestData({ includeTestFixtures: true });
    roleClients = await createRoleClients("status-undo");
    otherStaff = await createRoleClients("status-undo-other");
  }, 60000);

  afterAll(async () => {
    if (!shouldRun) return;
    await roleClients.cleanup();
    await otherStaff.cleanup();
    await cleanupTestData({ includeTestFixtures: true });
  });

  it("lets staff undo their own check-in within 2 minutes", async () => {
    if (!shouldRun) return;
    const booking = await checkedInBy("staff");

    const { data, error } = await moveAs("staff", booking.booking_id, "Confirmed");

    expect(error).toBeNull();
    expect(data?.booking_status).toBe("Confirmed");
  });

  it("lets staff undo their own check-out within 2 minutes", async () => {
    if (!shouldRun) return;
    const booking = await checkedInBy("staff");
    await moveAs("staff", booking.booking_id, "CheckedOut");

    const { error } = await moveAs("staff", booking.booking_id, "CheckedIn");

    expect(error).toBeNull();
    expect(await statusOf(booking.booking_id)).toBe("CheckedIn");
  });

  it("refuses a staff undo after 2 minutes", async () => {
    if (!shouldRun) return;
    const booking = await checkedInBy("staff");
    await backdateStatusChange(booking.booking_id, 3);

    const { error } = await moveAs("staff", booking.booking_id, "Confirmed");

    expect(error?.code).toBe("42501");
    expect(await statusOf(booking.booking_id)).toBe("CheckedIn");
  });

  it("refuses another staff user's undo", async () => {
    if (!shouldRun) return;
    const booking = await checkedInBy("staff");

    const { error } = await move(otherStaff.byRole.staff, booking.booking_id, "Confirmed");

    expect(error?.code).toBe("42501");
    expect(await statusOf(booking.booking_id)).toBe("CheckedIn");
  });

  it("lets a manager undo anyone's check-in at any time", async () => {
    if (!shouldRun) return;
    const booking = await checkedInBy("staff");
    await backdateStatusChange(booking.booking_id, 60 * 24);

    const { error } = await moveAs("manager", booking.booking_id, "Confirmed");

    expect(error).toBeNull();
    expect(await statusOf(booking.booking_id)).toBe("Confirmed");
  });

  it("refuses an undo that skips a step", async () => {
    if (!shouldRun) return;
    const booking = await createTestBooking({ booking_status: "CheckedOut" });

    const { error } = await moveAs("manager", booking.booking_id, "Confirmed");

    expect(error?.code).toBe("42501");
  });

  it("refuses undo check-out when a block now holds those nights", async () => {
    if (!shouldRun) return;
    const booking = await createTestBooking({ booking_status: "CheckedOut" });
    const unitId = booking.booking_units[0].unit_id;
    const firstNight = manilaDayOf(booking.check_in);
    const { error: blockError } = await service.from("availability_blackouts").insert({
      unit_id: unitId,
      start_date: firstNight,
      end_date: firstNight,
      reason: "dbtest-undo maintenance",
    });
    if (blockError) throw new Error(`seed block failed: ${blockError.message}`);

    try {
      const { error } = await moveAs("manager", booking.booking_id, "CheckedIn");

      expect(error?.code).toBe(BLOCKED_NIGHT_CODE);
      expect(await statusOf(booking.booking_id)).toBe("CheckedOut");
    } finally {
      await service.from("availability_blackouts").delete().eq("unit_id", unitId);
    }
  });

  it("refuses undo check-out when another live booking now holds those nights", async () => {
    if (!shouldRun) return;
    const booking = await createTestBooking({ booking_status: "CheckedOut" });
    const { data: unit } = await service
      .from("units")
      .select()
      .eq("unit_id", booking.booking_units[0].unit_id)
      .single();
    await createTestBooking({
      booking_status: "Confirmed",
      unit: unit!,
      check_in: new Date(booking.check_in),
      check_out: new Date(new Date(booking.check_in).getTime() + DAY_MS),
    });

    const { error } = await moveAs("manager", booking.booking_id, "CheckedIn");

    expect(error?.code).toBe(EXCLUSION_CODE);
    expect(await statusOf(booking.booking_id)).toBe("CheckedOut");
  });
});
