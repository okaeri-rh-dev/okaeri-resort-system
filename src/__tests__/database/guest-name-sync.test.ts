/**
 * A guest rename reaches the guest's bookings, which keep their own guest_name copy
 * for the bookings and payments lists (issue 360). Anonymized bookings stay removed.
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRoleClients, type RoleClients } from "../setup/role-clients";
import {
  testSupabaseAdmin as admin,
  cleanupTestData,
  createTestBooking,
  createTestGuest,
  shouldRunDatabaseTests,
} from "../setup/test-db";

async function bookingGuestName(bookingId: string) {
  const { data, error } = await admin
    .from("bookings")
    .select("guest_name")
    .eq("booking_id", bookingId)
    .single();
  if (error) throw error;
  return data.guest_name;
}

let roleClients: RoleClients;
let shouldRun = false;

describe("guest name sync trigger", () => {
  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) return;
    await cleanupTestData({ includeTestFixtures: true });
    roleClients = await createRoleClients("guest-name-sync");
  }, 60000);

  afterAll(async () => {
    if (!shouldRun) return;
    await roleClients.cleanup();
    await cleanupTestData({ includeTestFixtures: true });
  });

  it("shows the new name on the guest's bookings when a manager renames the guest", async () => {
    if (!shouldRun) return;
    const guest = await createTestGuest({ guest_name: "Maria Santos" });
    const first = await createTestBooking({ guest });
    const second = await createTestBooking({ guest });

    const { error } = await roleClients.byRole.manager
      .from("guests")
      .update({ guest_name: "Maria Santos-Cruz" })
      .eq("guest_id", guest.guest_id)
      .select()
      .single();
    expect(error).toBeNull();

    expect(await bookingGuestName(first.booking_id)).toBe("Maria Santos-Cruz");
    expect(await bookingGuestName(second.booking_id)).toBe("Maria Santos-Cruz");
  });

  it("keeps an anonymized booking removed when the guest is renamed", async () => {
    if (!shouldRun) return;
    const guest = await createTestGuest({ guest_name: "Jose Reyes" });
    const booking = await createTestBooking({ guest });
    const { error: anonymizeError } = await admin.rpc("anonymize_booking", {
      p_booking_id: booking.booking_id,
    });
    expect(anonymizeError).toBeNull();

    const { error } = await roleClients.byRole.manager
      .from("guests")
      .update({ guest_name: "Jose Reyes Jr." })
      .eq("guest_id", guest.guest_id)
      .select()
      .single();
    expect(error).toBeNull();

    expect(await bookingGuestName(booking.booking_id)).toBe("Removed guest");
  });
});
