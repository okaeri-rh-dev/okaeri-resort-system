// src/__tests__/database/booking-stays.test.ts
/**
 * Stay normalization, availability backfill and the create/availability RPCs.
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanupTestData,
  createTestBooking,
  createTestUnit,
  shouldRunDatabaseTests,
  testSupabaseAdmin as supabase,
} from "../setup/test-db";

const iso = (value: string) => new Date(value).toISOString();

async function stayOf(bookingId: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select("check_in, check_out, booking_unit_availability(check_in, check_out, booking_status)")
    .eq("booking_id", bookingId)
    .single();
  if (error) throw error;
  return data;
}

describe("normalize_booking_stays", () => {
  let shouldRun = false;

  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
  });

  beforeEach(async () => {
    if (shouldRun) await cleanupTestData({ includeTestFixtures: true });
  });

  afterAll(async () => {
    if (shouldRun) await cleanupTestData({ includeTestFixtures: true });
  });

  it("moves a midnight stay to the Manila day at 14:00 / 12:00, availability included", async () => {
    if (!shouldRun) return;
    const booking = await createTestBooking({
      check_in: new Date("2026-12-19T16:00:00Z"), // Manila midnight, Dec 20
      check_out: new Date("2026-12-22T03:00:00Z"), // 11:00 Manila, Dec 22
    });

    const { error } = await supabase.rpc("normalize_booking_stays");
    expect(error).toBeNull();

    const stay = await stayOf(booking.booking_id);
    expect(iso(stay.check_in)).toBe("2026-12-20T06:00:00.000Z");
    expect(iso(stay.check_out)).toBe("2026-12-22T04:00:00.000Z");
    expect(iso(stay.booking_unit_availability[0].check_in)).toBe("2026-12-20T06:00:00.000Z");
    expect(iso(stay.booking_unit_availability[0].check_out)).toBe("2026-12-22T04:00:00.000Z");
  });

  it("changes nothing on a second run", async () => {
    if (!shouldRun) return;
    await createTestBooking({ check_in: new Date("2026-12-19T16:00:00Z") });
    await supabase.rpc("normalize_booking_stays");

    const { data, error } = await supabase.rpc("normalize_booking_stays");
    expect(error).toBeNull();
    expect(data).toEqual([{ normalized_bookings: 0, backfilled_availability: 0 }]);
  });

  it("backfills a missing availability row with the booking's status", async () => {
    if (!shouldRun) return;
    const booking = await createTestBooking({ booking_status: "Confirmed" });
    await supabase.from("booking_unit_availability").delete().eq("booking_id", booking.booking_id);

    await supabase.rpc("normalize_booking_stays");

    const stay = await stayOf(booking.booking_id);
    expect(stay.booking_unit_availability).toHaveLength(1);
    expect(stay.booking_unit_availability[0].booking_status).toBe("Confirmed");
  });

  it("refuses to run while two Confirmed bookings overlap on a unit", async () => {
    if (!shouldRun) return;
    const unit = await createTestUnit();
    const checkIn = new Date("2026-12-20T06:00:00Z");
    const checkOut = new Date("2026-12-22T04:00:00Z");
    await createTestBooking({ unit, check_in: checkIn, check_out: checkOut });
    const second = await createTestBooking({
      unit,
      check_in: checkIn,
      check_out: checkOut,
      booking_status: "Pending",
    });
    // Confirm the second booking without an availability row, as old dialog bookings were
    await supabase.from("booking_unit_availability").delete().eq("booking_id", second.booking_id);
    await supabase
      .from("bookings")
      .update({ booking_status: "Confirmed" })
      .eq("booking_id", second.booking_id);

    const { error } = await supabase.rpc("normalize_booking_stays");
    expect(error?.message).toMatch(/Confirmed bookings overlap/);
  });
});

describe("create_multi_unit_booking and check_multi_unit_availability", () => {
  let shouldRun = false;

  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
  });

  beforeEach(async () => {
    if (shouldRun) await cleanupTestData({ includeTestFixtures: true });
  });

  it("stores the payment method", async () => {
    if (!shouldRun) return;
    const unit = await createTestUnit();
    const { data: bookingId, error } = await supabase.rpc("create_multi_unit_booking", {
      p_booking_data: {
        booking_reference: `TB-PM-${Date.now()}`,
        guest_name: "Payment Method Guest",
        num_guests: 2,
        check_in: "2026-12-20T06:00:00Z",
        check_out: "2026-12-22T04:00:00Z",
        payment_method: "GCash",
      },
      p_units: [
        {
          unit_id: unit.unit_id,
          unit_price: 5000,
          subtotal: 5000,
          assigned_guests: 2,
        },
      ],
    });
    expect(error).toBeNull();

    const { data } = await supabase
      .from("bookings")
      .select("payment_method")
      .eq("booking_id", bookingId!)
      .single();
    expect(data?.payment_method).toBe("GCash");
  });

  it("reports the day a booked unit frees up", async () => {
    if (!shouldRun) return;
    const unit = await createTestUnit();
    await createTestBooking({
      unit,
      check_in: new Date("2026-12-20T06:00:00Z"),
      check_out: new Date("2026-12-23T04:00:00Z"),
    });

    const { data, error } = await supabase.rpc("check_multi_unit_availability", {
      p_unit_ids: [unit.unit_id],
      p_check_in: "2026-12-21T06:00:00Z",
      p_check_out: "2026-12-22T04:00:00Z",
    });
    expect(error).toBeNull();
    expect(data?.[0].is_available).toBe(false);
    expect(iso(data![0].next_available_date!)).toBe("2026-12-23T04:00:00.000Z");
  });
});
