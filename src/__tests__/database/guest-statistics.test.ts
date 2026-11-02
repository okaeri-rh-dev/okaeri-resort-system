/**
 * The guest statistics trigger keeps total_bookings and total_spent right for
 * every role that can change a booking, and for both guests when a booking
 * moves to another guest.
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { cancelBooking } from "@/lib/bookings";

import { createRoleClients, type RoleClients } from "../setup/role-clients";
import {
  testSupabaseAdmin as admin,
  cleanupTestData,
  createTestBooking,
  createTestGuest,
  shouldRunDatabaseTests,
} from "../setup/test-db";

async function guestTotals(guestId: string) {
  const { data, error } = await admin
    .from("guests")
    .select("total_bookings, total_spent")
    .eq("guest_id", guestId)
    .single();
  if (error) throw error;
  return data;
}

let roleClients: RoleClients;
let shouldRun = false;

describe("guest statistics trigger", () => {
  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) return;
    await cleanupTestData({ includeTestFixtures: true });
    roleClients = await createRoleClients("guest-stats");
  }, 60000);

  afterAll(async () => {
    if (!shouldRun) return;
    await roleClients.cleanup();
    await cleanupTestData({ includeTestFixtures: true });
  });

  it("updates the guest's totals when staff cancel a booking", async () => {
    if (!shouldRun) return;
    const guest = await createTestGuest();
    const booking = await createTestBooking({ guest, total_amount: 5000 });
    expect(await guestTotals(guest.guest_id)).toMatchObject({
      total_bookings: 1,
      total_spent: 5000,
    });

    await cancelBooking(roleClients.byRole.staff, booking.booking_id);

    expect(await guestTotals(guest.guest_id)).toMatchObject({
      total_bookings: 0,
      total_spent: 0,
    });
  });

  it("recomputes both the old and the new guest when a booking changes guest", async () => {
    if (!shouldRun) return;
    const oldGuest = await createTestGuest();
    const newGuest = await createTestGuest();
    const booking = await createTestBooking({ guest: oldGuest, total_amount: 5000 });

    const { error } = await admin
      .from("bookings")
      .update({ guest_id: newGuest.guest_id })
      .eq("booking_id", booking.booking_id);
    expect(error).toBeNull();

    expect(await guestTotals(oldGuest.guest_id)).toMatchObject({
      total_bookings: 0,
      total_spent: 0,
    });
    expect(await guestTotals(newGuest.guest_id)).toMatchObject({
      total_bookings: 1,
      total_spent: 5000,
    });
  });
});
