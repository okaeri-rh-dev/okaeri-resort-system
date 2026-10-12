// src/__tests__/database/online-booking.test.ts
/**
 * Online booking: create_guest_booking, assign_units_to_booking and the
 * guest_booking_unit_requests table (migration 20261013000000).
 *
 * @vitest-environment node
 */

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanupTestData,
  shouldRunDatabaseTests,
  testSupabaseAdmin as supabase,
} from "../setup/test-db";

const SUPABASE_URL = process.env.TEST_SUPABASE_URL || "http://localhost:54321";
const ANON_KEY =
  process.env.TEST_SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

// Manila 2027-03-10 14:00 to 2027-03-12 12:00 (docs/adr/0002)
const STAY = { check_in: "2027-03-10T06:00:00.000Z", check_out: "2027-03-12T04:00:00.000Z" };
const NIGHTLY_SUBTOTAL = 7000;
const EXTRA_PERSON_FEE = 500;

function guestBookingArgs(guests: number[]) {
  const unit_breakdown = guests.map((count, index) => {
    const extra = Math.max(0, count - 2) * EXTRA_PERSON_FEE * 2;
    const total = NIGHTLY_SUBTOTAL + extra;
    return {
      unit_index: index + 1,
      guests: count,
      subtotal: NIGHTLY_SUBTOTAL,
      extra_person_fees: extra,
      total,
      downpayment: total / 2,
    };
  });
  const total = unit_breakdown.reduce((sum, unit) => sum + unit.total, 0);

  return {
    p_turnstile_token: "test-token",
    p_booking_data: {
      booking_reference: `TB-OB-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      guest_name: "Online Test Guest",
      email: "online-guest-test@example.com",
      phone_number: "+639171234567",
      ...STAY,
      special_requests: null,
      total_amount: total,
      downpayment_required: total / 2,
      discount_percent: null,
      discount_amount: null,
      pricing_snapshot: { total, downpayment_required: total / 2, unit_breakdown },
      payment_proof_url: "TEMP-test_1.png",
      idempotency_key: crypto.randomUUID(),
    },
    p_unit_requests: guests.map((count) => ({ guests_per_unit: count })),
    p_guest_data: null,
  };
}

async function createGuestBooking(guests: number[]): Promise<string> {
  const { data, error } = await supabase.rpc("create_guest_booking", guestBookingArgs(guests));
  if (error) throw error;
  return (data as { booking: { booking_id: string } }).booking.booking_id;
}

describe("create_guest_booking", () => {
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

  it("stores a pending guest booking with its cabin requests and pricing", async () => {
    if (!shouldRun) return;
    const bookingId = await createGuestBooking([2, 4]);

    const { data: booking, error } = await supabase
      .from("bookings")
      .select(
        "is_guest_booking, unit_assignment_status, requested_unit_count, unit_count, num_guests, total_amount, downpayment_required, pricing_snapshot, payment_proof_url, payment_status, booking_status, check_in, guest_booking_unit_requests(guests_per_unit)"
      )
      .eq("booking_id", bookingId)
      .single();
    expect(error).toBeNull();

    expect(booking).toMatchObject({
      is_guest_booking: true,
      unit_assignment_status: "pending",
      requested_unit_count: 2,
      unit_count: 2,
      num_guests: 6,
      total_amount: 16000,
      downpayment_required: 8000,
      payment_proof_url: "TEMP-test_1.png",
      payment_status: "Pending",
      booking_status: "Pending",
    });
    expect(new Date(booking!.check_in).toISOString()).toBe(STAY.check_in);
    expect((booking!.pricing_snapshot as { total: number }).total).toBe(16000);
    expect(booking!.guest_booking_unit_requests.map((r) => r.guests_per_unit).sort()).toEqual([
      2, 4,
    ]);
  });

  it("records the idempotency key against the booking", async () => {
    if (!shouldRun) return;
    const args = guestBookingArgs([2]);
    const { data, error } = await supabase.rpc("create_guest_booking", args);
    expect(error).toBeNull();

    const { data: key } = await supabase
      .from("idempotency_keys")
      .select("booking_id")
      .eq("key", args.p_booking_data.idempotency_key)
      .single();
    expect(key?.booking_id).toBe((data as { booking: { booking_id: string } }).booking.booking_id);
  });

  it("refuses an empty cabin list", async () => {
    if (!shouldRun) return;
    const args = { ...guestBookingArgs([2]), p_unit_requests: [] };

    const { error } = await supabase.rpc("create_guest_booking", args);
    expect(error?.message).toMatch(/between 1 and 10 cabins/);
  });

  it("refuses to run for the anon key", async () => {
    if (!shouldRun) return;
    const anon = createClient(SUPABASE_URL, ANON_KEY);

    const { data, error } = await anon.rpc("create_guest_booking", guestBookingArgs([2]));
    expect(data).toBeNull();
    expect(error?.message).toMatch(/permission denied/);
  });

  it("hides cabin requests from the anon key", async () => {
    if (!shouldRun) return;
    await createGuestBooking([2]);
    const anon = createClient(SUPABASE_URL, ANON_KEY);

    const { data } = await anon.from("guest_booking_unit_requests").select("id");
    expect(data ?? []).toEqual([]);
  });
});
