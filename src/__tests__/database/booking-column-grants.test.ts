/**
 * Signed-in users may update only the booking columns the app edits; money and
 * payment columns change only through server-side writers.
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { cancelBooking, updateBooking } from "@/lib/bookings";
import type { TablesUpdate } from "@/types/database.types";

import { createRoleClients, type RoleClients } from "../setup/role-clients";
import {
  cleanupTestData,
  createTestBooking,
  createTestGuest,
  createTestUnit,
  shouldRunDatabaseTests,
} from "../setup/test-db";

const SERVER_ONLY_PATCHES: TablesUpdate<"bookings">[] = [
  { payment_status: "Partial" },
  { total_amount: 0.01 },
  { downpayment_required: 0 },
  { pricing_snapshot: { unit_breakdown: [] } },
];

let roleClients: RoleClients;
let bookingId: string;
let shouldRun = false;

describe("booking column grants", () => {
  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) return;

    await cleanupTestData({ includeTestFixtures: true });
    roleClients = await createRoleClients("grants");
    const booking = await createTestBooking({
      unit: await createTestUnit({}),
      guest: await createTestGuest({}),
      booking_reference: `GRT${Date.now() % 1000000}`,
      payment_status: "Pending",
      unit_price: 5000,
      subtotal: 5000,
    });
    bookingId = booking.booking_id;
  }, 60000);

  afterAll(async () => {
    if (!shouldRun) return;
    await roleClients.cleanup();
    await cleanupTestData({ includeTestFixtures: true });
  });

  it.each(SERVER_ONLY_PATCHES)("staff cannot update %o", async (patch) => {
    if (!shouldRun) return;
    const { error } = await roleClients.byRole.staff
      .from("bookings")
      .update(patch)
      .eq("booking_id", bookingId);
    expect(error?.code).toBe("42501");
  });

  it("admin cannot update payment_status directly either", async () => {
    if (!shouldRun) return;
    const { error } = await roleClients.byRole.admin
      .from("bookings")
      .update({ payment_status: "Completed" })
      .eq("booking_id", bookingId);
    expect(error?.code).toBe("42501");
  });

  it("staff can still edit a booking and change its status", async () => {
    if (!shouldRun) return;
    const staff = roleClients.byRole.staff;
    await updateBooking(staff, bookingId, {
      guest_name: "Grant Test",
      email: "grant-test@example.com",
      contact_number: "09170000000",
      num_guests: 2,
      payment_method: "Cash",
      special_requests: "none",
      is_walk_in: true,
      stay: { check_in: "2027-01-10", check_out: "2027-01-11" },
    });
    const cancelled = await cancelBooking(staff, bookingId);
    expect(cancelled.booking_status).toBe("Cancelled");
  });
});
