/**
 * Every booking has a booking source (GLOSSARY.md). The old is_walk_in and
 * is_guest_booking flags follow it, and staff cannot set or remove Website.
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createBooking,
  manilaDayOf,
  updateBooking,
  type NewBooking,
  type StaffBookingSource,
} from "@/lib/bookings";

import { createRoleClients, type RoleClients } from "../setup/role-clients";
import {
  cleanupTestData,
  createTestUnit,
  testSupabaseAdmin as service,
  shouldRunDatabaseTests,
} from "../setup/test-db";

let roleClients: RoleClients;
let shouldRun = false;
let dayOffset = 400;

async function newBooking(booking_source: StaffBookingSource) {
  const { unit_id } = await createTestUnit({});
  dayOffset += 3;
  const checkIn = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000);
  const booking: NewBooking = {
    guest: { guest_name: "Source Test", email: null, contact_number: null },
    check_in: manilaDayOf(checkIn.toISOString()),
    check_out: manilaDayOf(new Date(checkIn.getTime() + 24 * 60 * 60 * 1000).toISOString()),
    units: [
      {
        unit_id,
        unit_price: 2500,
        weekend_surcharge: 0,
        extra_person_charge: 0,
        subtotal: 2500,
        assigned_guests: 1,
      },
    ],
    payment_method: null,
    booking_source,
  };
  return createBooking(service, booking);
}

describe("booking source", () => {
  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) return;
    await cleanupTestData({ includeTestFixtures: true });
    roleClients = await createRoleClients("source");
  }, 60000);

  afterAll(async () => {
    if (!shouldRun) return;
    await roleClients.cleanup();
    await cleanupTestData({ includeTestFixtures: true });
  });

  it.each([
    ["Airbnb", false],
    ["Direct", false],
    ["Walk-in", true],
  ] as const)("stores %s with is_walk_in %s", async (source, isWalkIn) => {
    if (!shouldRun) return;
    const booking = await newBooking(source);
    expect(booking).toMatchObject({
      booking_source: source,
      is_walk_in: isWalkIn,
      is_guest_booking: false,
    });
  });

  it("gives a booking without a source one from its old flags", async () => {
    if (!shouldRun) return;
    const { data, error } = await service
      .from("bookings")
      .insert([
        {
          booking_reference: `SRC-W${Date.now() % 1000000}`,
          guest_name: "Legacy Walk-in",
          check_in: "2028-03-01",
          check_out: "2028-03-02",
          num_guests: 1,
          total_amount: 2500,
          is_walk_in: true,
        },
        {
          booking_reference: `SRC-G${Date.now() % 1000000}`,
          guest_name: "Legacy Online",
          check_in: "2028-03-01",
          check_out: "2028-03-02",
          num_guests: 1,
          total_amount: 2500,
          is_guest_booking: true,
        },
      ])
      .select("booking_source")
      .order("booking_source");
    expect(error).toBeNull();
    expect(data?.map((row) => row.booking_source)).toEqual(["Walk-in", "Website"]);
  });

  it("keeps the flags in step when staff change the source", async () => {
    if (!shouldRun) return;
    const staff = roleClients.byRole.staff;
    const { booking_id } = await newBooking("Direct");

    const walkIn = await updateBooking(staff, booking_id, { booking_source: "Walk-in" });
    expect(walkIn).toMatchObject({ booking_source: "Walk-in", is_walk_in: true });

    const airbnb = await updateBooking(staff, booking_id, { booking_source: "Airbnb" });
    expect(airbnb).toMatchObject({ booking_source: "Airbnb", is_walk_in: false });
  });

  it("does not let staff set Website", async () => {
    if (!shouldRun) return;
    const { booking_id } = await newBooking("Direct");
    await expect(
      updateBooking(roleClients.byRole.staff, booking_id, { booking_source: "Website" })
    ).rejects.toThrow(/Website/);
  });

  it("does not let staff remove Website", async () => {
    if (!shouldRun) return;
    const { booking_id } = await newBooking("Direct");
    await service
      .from("bookings")
      .update({ booking_source: "Website" })
      .eq("booking_id", booking_id);

    await expect(
      updateBooking(roleClients.byRole.staff, booking_id, { booking_source: "Direct" })
    ).rejects.toThrow(/Website/);

    const website = await updateBooking(roleClients.byRole.staff, booking_id, {
      guest_name: "Still Website",
    });
    expect(website).toMatchObject({ booking_source: "Website", is_guest_booking: true });
  });
});
