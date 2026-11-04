/**
 * Only managers and above change a booking's total; the new total is split
 * across cabins in proportion to their current subtotals.
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { updateBooking } from "@/lib/bookings";

import { createRoleClients, type RoleClients } from "../setup/role-clients";
import {
  testSupabaseAdmin as admin,
  cleanupTestData,
  createTestMultiUnitBooking,
  shouldRunDatabaseTests,
} from "../setup/test-db";

let roleClients: RoleClients;
let shouldRun = false;

// Two cabins at 2,000 (one with a 500 weekend surcharge) and 4,000: total 6,000.
async function twoCabinBooking() {
  const booking = await createTestMultiUnitBooking(2);
  const [first] = booking.booking_units;
  const { error } = await admin
    .from("booking_units")
    .update({ unit_price: 1500, weekend_surcharge: 500, subtotal: 2000 })
    .eq("booking_unit_id", first.booking_unit_id);
  if (error) throw error;
  return booking.booking_id;
}

async function cabinSubtotals(bookingId: string) {
  const { data, error } = await admin
    .from("booking_units")
    .select("subtotal")
    .eq("booking_id", bookingId)
    .order("subtotal");
  if (error) throw error;
  return data.map((unit) => unit.subtotal);
}

describe("changing a booking's total", () => {
  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) return;
    roleClients = await createRoleClients("total");
  }, 60000);

  beforeEach(async () => {
    if (shouldRun) await cleanupTestData({ includeTestFixtures: true });
  });

  afterAll(async () => {
    if (!shouldRun) return;
    await roleClients.cleanup();
    await cleanupTestData({ includeTestFixtures: true });
  });

  it("a manager's new total is split in proportion and sums exactly", async () => {
    if (!shouldRun) return;
    const bookingId = await twoCabinBooking();

    const updated = await updateBooking(roleClients.byRole.manager, bookingId, {
      total_amount: 1000,
    });

    expect(updated.total_amount).toBe(1000);
    expect(await cabinSubtotals(bookingId)).toEqual([333.33, 666.67]);
  });

  it("a total of zero sets every cabin to zero", async () => {
    if (!shouldRun) return;
    const bookingId = await twoCabinBooking();

    const updated = await updateBooking(roleClients.byRole.manager, bookingId, {
      total_amount: 0,
    });

    expect(updated.total_amount).toBe(0);
    expect(await cabinSubtotals(bookingId)).toEqual([0, 0]);
  });

  it("staff cannot change the total", async () => {
    if (!shouldRun) return;
    const bookingId = await twoCabinBooking();

    await expect(
      updateBooking(roleClients.byRole.staff, bookingId, { total_amount: 1000 })
    ).rejects.toThrow(/only a manager/i);
    expect(await cabinSubtotals(bookingId)).toEqual([2000, 4000]);
  });

  it("payment status follows the new total", async () => {
    if (!shouldRun) return;
    const bookingId = await twoCabinBooking();
    const { error } = await admin
      .from("payments")
      .insert({ booking_id: bookingId, amount: 1000, payment_method: "Cash", status: "Active" });
    if (error) throw error;

    const manager = roleClients.byRole.manager;
    expect((await updateBooking(manager, bookingId, { total_amount: 1000 })).payment_status).toBe(
      "Completed"
    );
    expect((await updateBooking(manager, bookingId, { total_amount: 1500 })).payment_status).toBe(
      "Partial"
    );
  });
});
