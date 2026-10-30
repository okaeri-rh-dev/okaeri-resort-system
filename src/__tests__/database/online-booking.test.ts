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
  createTestBooking,
  createTestUnit,
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

async function signInAsStaff() {
  const email = `online-booking-${crypto.randomUUID()}@test.local`;
  const password = "test-password-12345";
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn failed: ${signInError.message}`);
  return { client, userId: data.user.id };
}

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

  it("refuses to run for a signed-in user", async () => {
    if (!shouldRun) return;
    const { client, userId } = await signInAsStaff();

    const { data, error } = await client.rpc("create_guest_booking", guestBookingArgs([2]));
    expect(data).toBeNull();
    expect(error?.message).toMatch(/permission denied/);
    await supabase.auth.admin.deleteUser(userId);
  });

  it("hides cabin requests from the anon key", async () => {
    if (!shouldRun) return;
    await createGuestBooking([2]);
    const anon = createClient(SUPABASE_URL, ANON_KEY);

    const { data } = await anon.from("guest_booking_unit_requests").select("id");
    expect(data ?? []).toEqual([]);
  });
});

async function payDownpayment(bookingId: string) {
  const { data: booking } = await supabase
    .from("bookings")
    .select("downpayment_required")
    .eq("booking_id", bookingId)
    .single();
  const { error } = await supabase
    .from("payments")
    .insert({ booking_id: bookingId, amount: booking!.downpayment_required!, status: "Active" });
  if (error) throw error;
}

async function bookingState(bookingId: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "unit_assignment_status, booking_status, payment_status, total_amount, num_guests, booking_units(unit_id, unit_price, extra_person_charge, subtotal, assigned_guests), booking_unit_availability(unit_id, check_in, check_out, booking_status)"
    )
    .eq("booking_id", bookingId)
    .single();
  if (error) throw error;
  return data;
}

describe("assign_units_to_booking", () => {
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

  it("refuses before the downpayment is recorded", async () => {
    if (!shouldRun) return;
    const bookingId = await createGuestBooking([2]);
    const unit = await createTestUnit();

    const { error } = await supabase.rpc("assign_units_to_booking", {
      p_booking_id: bookingId,
      p_unit_ids: [unit.unit_id],
    });
    expect(error?.message).toMatch(/Payment must be verified/);
  });

  it("assigns cabins at the quoted prices and blocks their dates", async () => {
    if (!shouldRun) return;
    const bookingId = await createGuestBooking([2, 4]);
    await payDownpayment(bookingId);
    const [first, second] = [await createTestUnit(), await createTestUnit()];

    const { error } = await supabase.rpc("assign_units_to_booking", {
      p_booking_id: bookingId,
      p_unit_ids: [first.unit_id, second.unit_id],
    });
    expect(error).toBeNull();

    const state = await bookingState(bookingId);
    expect(state).toMatchObject({
      unit_assignment_status: "assigned",
      booking_status: "Confirmed",
      payment_status: "Partial",
      total_amount: 16000,
      num_guests: 6,
    });
    const units = [...state.booking_units].sort((a, b) => a.subtotal - b.subtotal);
    expect(units).toEqual([
      {
        unit_id: first.unit_id,
        unit_price: 7000,
        extra_person_charge: 0,
        subtotal: 7000,
        assigned_guests: 2,
      },
      {
        unit_id: second.unit_id,
        unit_price: 7000,
        extra_person_charge: 2000,
        subtotal: 9000,
        assigned_guests: 4,
      },
    ]);
    expect(state.booking_unit_availability).toHaveLength(2);
    for (const row of state.booking_unit_availability) {
      expect(row.booking_status).toBe("Confirmed");
      expect(new Date(row.check_in).toISOString()).toBe(STAY.check_in);
      expect(new Date(row.check_out).toISOString()).toBe(STAY.check_out);
    }
  });

  it("refuses the wrong number of cabins and writes nothing", async () => {
    if (!shouldRun) return;
    const bookingId = await createGuestBooking([2, 2]);
    await payDownpayment(bookingId);
    const unit = await createTestUnit();

    const { error } = await supabase.rpc("assign_units_to_booking", {
      p_booking_id: bookingId,
      p_unit_ids: [unit.unit_id],
    });
    expect(error?.message).toMatch(/Must assign exactly 2 cabins, got 1/);
    const state = await bookingState(bookingId);
    expect(state.unit_assignment_status).toBe("pending");
    expect(state.booking_units).toEqual([]);
  });

  it("refuses a cabin already booked for those dates and writes nothing", async () => {
    if (!shouldRun) return;
    const unit = await createTestUnit();
    await createTestBooking({
      unit,
      check_in: new Date(STAY.check_in),
      check_out: new Date(STAY.check_out),
    });
    const bookingId = await createGuestBooking([2]);
    await payDownpayment(bookingId);

    const { error } = await supabase.rpc("assign_units_to_booking", {
      p_booking_id: bookingId,
      p_unit_ids: [unit.unit_id],
    });
    expect(error?.code).toBe("23P01");
    const state = await bookingState(bookingId);
    expect(state.unit_assignment_status).toBe("pending");
    expect(state.booking_units).toEqual([]);
    expect(state.booking_unit_availability).toEqual([]);
  });

  it("refuses a second assignment", async () => {
    if (!shouldRun) return;
    const bookingId = await createGuestBooking([2]);
    await payDownpayment(bookingId);
    const [first, second] = [await createTestUnit(), await createTestUnit()];
    const { error: firstError } = await supabase.rpc("assign_units_to_booking", {
      p_booking_id: bookingId,
      p_unit_ids: [first.unit_id],
    });
    expect(firstError).toBeNull();

    const { error } = await supabase.rpc("assign_units_to_booking", {
      p_booking_id: bookingId,
      p_unit_ids: [second.unit_id],
    });
    expect(error?.message).toMatch(/not found or not in pending state/);
  });

  it("lets staff delete the payment of an assigned booking (D4)", async () => {
    if (!shouldRun) return;
    const bookingId = await createGuestBooking([2]);
    await payDownpayment(bookingId);
    const unit = await createTestUnit();
    const { error: assignError } = await supabase.rpc("assign_units_to_booking", {
      p_booking_id: bookingId,
      p_unit_ids: [unit.unit_id],
    });
    expect(assignError).toBeNull();
    expect((await bookingState(bookingId)).unit_assignment_status).toBe("assigned");

    const { error } = await supabase.from("payments").delete().eq("booking_id", bookingId);
    expect(error).toBeNull();
    expect((await bookingState(bookingId)).payment_status).toBe("Pending");
  });

  it("refuses to run for the anon key", async () => {
    if (!shouldRun) return;
    const anon = createClient(SUPABASE_URL, ANON_KEY);

    const { error } = await anon.rpc("assign_units_to_booking", {
      p_booking_id: crypto.randomUUID(),
      p_unit_ids: [crypto.randomUUID()],
    });
    expect(error?.message).toMatch(/permission denied/);
  });

  it("refuses to run for a signed-in user", async () => {
    if (!shouldRun) return;
    const { client, userId } = await signInAsStaff();

    const { error } = await client.rpc("assign_units_to_booking", {
      p_booking_id: crypto.randomUUID(),
      p_unit_ids: [crypto.randomUUID()],
    });
    expect(error?.message).toMatch(/permission denied/);
    await supabase.auth.admin.deleteUser(userId);
  });
});

describe("duplicate writes", () => {
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

  it("a second active online downpayment for a booking is refused", async () => {
    if (!shouldRun) return;
    const bookingId = await createGuestBooking([2]);
    const downpayment = {
      booking_id: bookingId,
      amount: 3500,
      status: "Active",
      notes: "Online booking downpayment",
    };

    const results = await Promise.all([
      supabase.from("payments").insert(downpayment),
      supabase.from("payments").insert(downpayment),
    ]);

    expect(results.map((result) => result.error?.code ?? null).sort()).toEqual(["23505", null]);
    const { count } = await supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("booking_id", bookingId);
    expect(count).toBe(1);
  });

  it("two submits with one idempotency key create one booking", async () => {
    if (!shouldRun) return;
    const args = guestBookingArgs([2]);
    const secondArgs = {
      ...args,
      p_booking_data: {
        ...args.p_booking_data,
        booking_reference: `${args.p_booking_data.booking_reference}b`,
      },
    };

    const results = await Promise.all([
      supabase.rpc("create_guest_booking", args),
      supabase.rpc("create_guest_booking", secondArgs),
    ]);

    expect(results.map((result) => result.error)).toEqual([null, null]);
    const bookingIds = results.map(
      (result) => (result.data as { booking: { booking_id: string } }).booking.booking_id
    );
    expect(bookingIds[0]).toBe(bookingIds[1]);
    const { count } = await supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .like("booking_reference", `${args.p_booking_data.booking_reference}%`);
    expect(count).toBe(1);
  });

  it("a submit with an expired idempotency key creates a new booking", async () => {
    if (!shouldRun) return;
    const args = guestBookingArgs([2]);
    const firstBookingId = await createGuestBooking([2]);
    const { error: seedError } = await supabase.from("idempotency_keys").insert({
      key: args.p_booking_data.idempotency_key,
      booking_id: firstBookingId,
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    expect(seedError).toBeNull();

    const { data, error } = await supabase.rpc("create_guest_booking", args);

    expect(error).toBeNull();
    expect((data as { booking: { booking_id: string } }).booking.booking_id).not.toBe(
      firstBookingId
    );
  });
});
