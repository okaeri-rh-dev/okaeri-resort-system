/**
 * An Airbnb booking starts Confirmed and is fully paid on entry by one
 * "Airbnb payout" payment for its total (docs/adr/0006).
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createBooking, manilaDayOf, updateBooking, type StaffBookingSource } from "@/lib/bookings";

import { createRoleClients, type RoleClients } from "../setup/role-clients";
import {
  cleanupTestData,
  createTestUnit,
  testSupabaseAdmin as service,
  shouldRunDatabaseTests,
} from "../setup/test-db";

let shouldRun = false;
let roleClients: RoleClients;
let dayOffset = 500;

async function newBooking(booking_source: StaffBookingSource, subtotals: number[]) {
  dayOffset += 3;
  const checkIn = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000);
  const units = await Promise.all(
    subtotals.map(async (subtotal) => ({
      unit_id: (await createTestUnit({})).unit_id,
      unit_price: subtotal,
      weekend_surcharge: 0,
      extra_person_charge: 0,
      subtotal,
      assigned_guests: 1,
    }))
  );
  return createBooking(service, {
    guest: { guest_name: "Airbnb Guest", email: null, contact_number: null },
    check_in: manilaDayOf(checkIn.toISOString()),
    check_out: manilaDayOf(new Date(checkIn.getTime() + 24 * 60 * 60 * 1000).toISOString()),
    units,
    payment_method: null,
    booking_source,
  });
}

async function paymentsOf(bookingId: string) {
  const { data, error } = await service
    .from("payments")
    .select("amount, payment_method, payment_date, status")
    .eq("booking_id", bookingId);
  if (error) throw error;
  return data;
}

describe("Airbnb booking", () => {
  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) return;
    await cleanupTestData({ includeTestFixtures: true });
    roleClients = await createRoleClients("airbnb");
  }, 60000);

  afterAll(async () => {
    if (!shouldRun) return;
    await roleClients.cleanup();
    await cleanupTestData({ includeTestFixtures: true });
  });

  it("starts Confirmed and fully paid by one Airbnb payout dated the entry day", async () => {
    if (!shouldRun) return;
    const booking = await newBooking("Airbnb", [4200.25, 3150.25]);

    expect(booking).toMatchObject({
      booking_status: "Confirmed",
      payment_status: "Completed",
      total_amount: 7350.5,
    });
    const payments = await paymentsOf(booking.booking_id);
    expect(payments).toEqual([
      expect.objectContaining({
        amount: 7350.5,
        payment_method: "Airbnb payout",
        status: "Active",
      }),
    ]);
    expect(manilaDayOf(payments[0].payment_date!)).toBe(manilaDayOf(booking.created_at!));
  });

  it("leaves a Direct booking Pending with no payment", async () => {
    if (!shouldRun) return;
    const booking = await newBooking("Direct", [2500]);

    expect(booking).toMatchObject({ booking_status: "Pending", payment_status: "Pending" });
    expect(await paymentsOf(booking.booking_id)).toEqual([]);
  });

  it("its payout payment follows a manager's new total", async () => {
    if (!shouldRun) return;
    const booking = await newBooking("Airbnb", [4000]);

    const updated = await updateBooking(roleClients.byRole.manager, booking.booking_id, {
      total_amount: 1500.5,
    });

    expect(updated.payment_status).toBe("Completed");
    expect(await paymentsOf(booking.booking_id)).toEqual([
      expect.objectContaining({
        amount: 1500.5,
        payment_method: "Airbnb payout",
        status: "Active",
      }),
    ]);
  });

  it("a total of zero soft-deletes its payout payment, and a new total restores it", async () => {
    if (!shouldRun) return;
    const booking = await newBooking("Airbnb", [4000]);
    const manager = roleClients.byRole.manager;

    await updateBooking(manager, booking.booking_id, { total_amount: 0 });
    expect(await paymentsOf(booking.booking_id)).toEqual([
      expect.objectContaining({ amount: 4000, status: "Deleted" }),
    ]);

    const restored = await updateBooking(manager, booking.booking_id, { total_amount: 2000 });
    expect(restored.payment_status).toBe("Completed");
    expect(await paymentsOf(booking.booking_id)).toEqual([
      expect.objectContaining({ amount: 2000, status: "Active" }),
    ]);
  });

  it("a new total leaves a Direct booking's payments alone", async () => {
    if (!shouldRun) return;
    const booking = await newBooking("Direct", [2500]);
    const { error } = await service
      .from("payments")
      .insert({ booking_id: booking.booking_id, amount: 1000, payment_method: "Cash" });
    if (error) throw error;

    await updateBooking(roleClients.byRole.manager, booking.booking_id, { total_amount: 3000 });

    expect(await paymentsOf(booking.booking_id)).toEqual([
      expect.objectContaining({ amount: 1000, payment_method: "Cash", status: "Active" }),
    ]);
  });
});
