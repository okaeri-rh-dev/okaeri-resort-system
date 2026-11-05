/**
 * An Airbnb booking starts Confirmed and is fully paid on entry by one
 * "Airbnb payout" payment for its total (docs/adr/0006).
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  BOOKING_SEARCH_COLUMNS,
  createBooking,
  DUPLICATE_CONFIRMATION_CODE_MESSAGE,
  manilaDayOf,
  updateBooking,
  type StaffBookingSource,
} from "@/lib/bookings";
import { ilikeAnyFilter } from "@/lib/search-filter";

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

async function newBooking(
  booking_source: StaffBookingSource,
  subtotals: number[],
  airbnb_confirmation_code?: string
) {
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
    airbnb_confirmation_code,
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

    const cancelled = await updateBooking(manager, booking.booking_id, { total_amount: 0 });
    expect(cancelled.payment_status).toBe("Pending");
    expect(await paymentsOf(booking.booking_id)).toEqual([
      expect.objectContaining({ amount: 4000, status: "Deleted" }),
    ]);

    const restored = await updateBooking(manager, booking.booking_id, { total_amount: 2000 });
    expect(restored.payment_status).toBe("Completed");
    expect(await paymentsOf(booking.booking_id)).toEqual([
      expect.objectContaining({ amount: 2000, status: "Active" }),
    ]);
  });

  it("a new total follows the active payout, not one staff deleted", async () => {
    if (!shouldRun) return;
    const booking = await newBooking("Airbnb", [4000]);
    const deleted = await service
      .from("payments")
      .update({ status: "Deleted" })
      .eq("booking_id", booking.booking_id);
    if (deleted.error) throw deleted.error;
    const manual = await service
      .from("payments")
      .insert({ booking_id: booking.booking_id, amount: 4000, payment_method: "Airbnb payout" });
    if (manual.error) throw manual.error;

    const updated = await updateBooking(roleClients.byRole.manager, booking.booking_id, {
      total_amount: 3000,
    });

    expect(updated.payment_status).toBe("Completed");
    expect(await paymentsOf(booking.booking_id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ amount: 4000, status: "Deleted" }),
        expect.objectContaining({ amount: 3000, status: "Active" }),
      ])
    );
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

  it("a change of source to Airbnb pays the booking by one payout for its total", async () => {
    if (!shouldRun) return;
    const booking = await newBooking("Direct", [2500.5]);

    const updated = await updateBooking(roleClients.byRole.staff, booking.booking_id, {
      booking_source: "Airbnb",
    });

    expect(updated.payment_status).toBe("Completed");
    const payments = await paymentsOf(booking.booking_id);
    expect(payments).toEqual([
      expect.objectContaining({
        amount: 2500.5,
        payment_method: "Airbnb payout",
        status: "Active",
      }),
    ]);
    expect(manilaDayOf(payments[0].payment_date!)).toBe(manilaDayOf(updated.updated_at!));
  });

  it("a change of source from Airbnb soft-deletes the payout and keeps other payments", async () => {
    if (!shouldRun) return;
    const booking = await newBooking("Airbnb", [4000]);
    const { error } = await service
      .from("payments")
      .insert({ booking_id: booking.booking_id, amount: 500, payment_method: "Cash" });
    if (error) throw error;

    const updated = await updateBooking(roleClients.byRole.staff, booking.booking_id, {
      booking_source: "Direct",
    });

    expect(updated.payment_status).toBe("Partial");
    expect(await paymentsOf(booking.booking_id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          amount: 4000,
          payment_method: "Airbnb payout",
          status: "Deleted",
        }),
        expect.objectContaining({ amount: 500, payment_method: "Cash", status: "Active" }),
      ])
    );
  });

  it("a change back to Airbnb reactivates the one payout at the current total", async () => {
    if (!shouldRun) return;
    const booking = await newBooking("Airbnb", [4000]);
    const manager = roleClients.byRole.manager;

    await updateBooking(manager, booking.booking_id, { booking_source: "Direct" });
    await updateBooking(manager, booking.booking_id, { total_amount: 3500 });
    const updated = await updateBooking(manager, booking.booking_id, { booking_source: "Airbnb" });

    expect(updated.payment_status).toBe("Completed");
    expect(await paymentsOf(booking.booking_id)).toEqual([
      expect.objectContaining({ amount: 3500, payment_method: "Airbnb payout", status: "Active" }),
    ]);
  });

  it("one edit of total and source to Airbnb ends with the payout at the new total", async () => {
    if (!shouldRun) return;
    const booking = await newBooking("Direct", [4000]);

    const updated = await updateBooking(roleClients.byRole.manager, booking.booking_id, {
      booking_source: "Airbnb",
      total_amount: 3200,
    });

    expect(updated.payment_status).toBe("Completed");
    expect(await paymentsOf(booking.booking_id)).toEqual([
      expect.objectContaining({ amount: 3200, payment_method: "Airbnb payout", status: "Active" }),
    ]);
  });

  it("a change between sources other than Airbnb leaves payments alone", async () => {
    if (!shouldRun) return;
    const booking = await newBooking("Direct", [2500]);

    const updated = await updateBooking(roleClients.byRole.staff, booking.booking_id, {
      booking_source: "Walk-in",
    });

    expect(updated.payment_status).toBe("Pending");
    expect(await paymentsOf(booking.booking_id)).toEqual([]);
  });

  it("a change of source to Airbnb on a total of zero creates no payout", async () => {
    if (!shouldRun) return;
    const booking = await newBooking("Direct", [0]);

    await updateBooking(roleClients.byRole.staff, booking.booking_id, {
      booking_source: "Airbnb",
    });

    expect(await paymentsOf(booking.booking_id)).toEqual([]);
  });

  it("stores its confirmation code and rejects a code already used", async () => {
    if (!shouldRun) return;
    const booking = await newBooking("Airbnb", [4000], "HMDUPE001");

    expect(booking.airbnb_confirmation_code).toBe("HMDUPE001");
    await expect(newBooking("Airbnb", [4000], "HMDUPE001")).rejects.toThrow(
      DUPLICATE_CONFIRMATION_CODE_MESSAGE
    );
  });

  it("staff add a code in an edit, but not one another booking has", async () => {
    if (!shouldRun) return;
    await newBooking("Airbnb", [4000], "HMTAKEN01");
    const booking = await newBooking("Airbnb", [4000]);
    const staff = roleClients.byRole.staff;

    const updated = await updateBooking(staff, booking.booking_id, {
      airbnb_confirmation_code: "HMEDIT001",
    });
    expect(updated.airbnb_confirmation_code).toBe("HMEDIT001");

    await expect(
      updateBooking(staff, booking.booking_id, { airbnb_confirmation_code: "HMTAKEN01" })
    ).rejects.toThrow(DUPLICATE_CONFIRMATION_CODE_MESSAGE);
  });

  it("many bookings can have no code", async () => {
    if (!shouldRun) return;
    await newBooking("Airbnb", [4000]);
    await expect(newBooking("Airbnb", [4000])).resolves.toBeDefined();
  });

  it("the bookings search finds a booking by its confirmation code", async () => {
    if (!shouldRun) return;
    const booking = await newBooking("Airbnb", [4000], "HMSEARCH1");

    const { data, error } = await roleClients.byRole.staff
      .from("bookings")
      .select("booking_id")
      .or(ilikeAnyFilter(BOOKING_SEARCH_COLUMNS, "hmsearch"));

    expect(error).toBeNull();
    expect(data).toEqual([{ booking_id: booking.booking_id }]);
  });
});
