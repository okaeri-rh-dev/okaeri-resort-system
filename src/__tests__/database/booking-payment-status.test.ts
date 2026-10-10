/**
 * Booking payment status is derived in the database from the booking's
 * payments (docs/adr/0001-booking-payment-status-derived-in-database.md).
 *
 * @vitest-environment node
 */

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanupTestData,
  createTestBooking,
  shouldRunDatabaseTests,
  testSupabaseAdmin as supabase,
} from "../setup/test-db";

const ANON_KEY =
  process.env.TEST_SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const SUPABASE_URL = process.env.TEST_SUPABASE_URL || "http://127.0.0.1:54321";

// create_multi_unit_booking sums unit subtotals into total_amount
const bookingTotaling = (total: number) =>
  createTestBooking({ total_amount: total, unit_price: total, subtotal: total });

async function paymentStatusOf(bookingId: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select("payment_status")
    .eq("booking_id", bookingId)
    .single();
  if (error) throw error;
  return data.payment_status;
}

async function recordPayment(bookingId: string, amount: number, status = "Active") {
  const { data, error } = await supabase
    .from("payments")
    .insert({ booking_id: bookingId, amount, payment_method: "Cash", status })
    .select("payment_id")
    .single();
  if (error) throw error;
  return data.payment_id;
}

describe("booking payment status", () => {
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

  it("is Pending with no payments, Partial below the total and Completed at it", async () => {
    if (!shouldRun) return;
    const booking = await bookingTotaling(5000);

    expect(await paymentStatusOf(booking.booking_id)).toBe("Pending");

    await recordPayment(booking.booking_id, 2000);
    expect(await paymentStatusOf(booking.booking_id)).toBe("Partial");

    await recordPayment(booking.booking_id, 3000);
    expect(await paymentStatusOf(booking.booking_id)).toBe("Completed");
  });

  it("counts a cash payment with no proof", async () => {
    if (!shouldRun) return;
    const booking = await bookingTotaling(3000);

    await recordPayment(booking.booking_id, 3000);

    expect(await paymentStatusOf(booking.booking_id)).toBe("Completed");
  });

  it("stops counting a payment once it is soft-deleted", async () => {
    if (!shouldRun) return;
    const booking = await bookingTotaling(5000);
    await recordPayment(booking.booking_id, 2000);
    const paymentId = await recordPayment(booking.booking_id, 3000);

    await supabase.from("payments").update({ status: "Deleted" }).eq("payment_id", paymentId);

    expect(await paymentStatusOf(booking.booking_id)).toBe("Partial");
  });

  it("is Refunded when the only payments were refunded", async () => {
    if (!shouldRun) return;
    const booking = await bookingTotaling(5000);
    const paymentId = await recordPayment(booking.booking_id, 5000);

    await supabase.from("payments").update({ status: "Refunded" }).eq("payment_id", paymentId);

    expect(await paymentStatusOf(booking.booking_id)).toBe("Refunded");
  });

  it("recomputes after a payment is deleted", async () => {
    if (!shouldRun) return;
    const booking = await bookingTotaling(5000);
    const paymentId = await recordPayment(booking.booking_id, 5000);

    await supabase.from("payments").delete().eq("payment_id", paymentId);

    expect(await paymentStatusOf(booking.booking_id)).toBe("Pending");
  });

  it("recomputes both bookings when a payment moves between them", async () => {
    if (!shouldRun) return;
    const from = await bookingTotaling(4000);
    const to = await bookingTotaling(4000);
    const paymentId = await recordPayment(from.booking_id, 4000);

    await supabase
      .from("payments")
      .update({ booking_id: to.booking_id })
      .eq("payment_id", paymentId);

    expect(await paymentStatusOf(from.booking_id)).toBe("Pending");
    expect(await paymentStatusOf(to.booking_id)).toBe("Completed");
  });

  it("recomputes when the booking's total changes", async () => {
    if (!shouldRun) return;
    const booking = await bookingTotaling(5000);
    await recordPayment(booking.booking_id, 5000);

    await supabase
      .from("bookings")
      .update({ total_amount: 6000 })
      .eq("booking_id", booking.booking_id);

    expect(await paymentStatusOf(booking.booking_id)).toBe("Partial");
  });

  it("cannot be refreshed directly by an anonymous caller", async () => {
    if (!shouldRun) return;
    const booking = await bookingTotaling(5000);
    const anon = createClient(SUPABASE_URL, ANON_KEY);

    const { error } = await anon.rpc("refresh_booking_payment_status", {
      p_booking_id: booking.booking_id,
    });

    expect(error).not.toBeNull();
  });

  it("updates when staff record a payment under RLS", async () => {
    if (!shouldRun) return;
    const booking = await bookingTotaling(5000);
    const email = `payment-status-staff-${Date.now()}@example.com`;
    const password = "Test-Password-123!";
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError || !created.user) throw createError;
    const staffUserId = created.user.id;

    try {
      await supabase
        .from("app_roles")
        .insert({ user_id: staffUserId, email, role: "staff", is_active: true });
      const staff = createClient(SUPABASE_URL, ANON_KEY);
      await staff.auth.signInWithPassword({ email, password });

      const { error } = await staff
        .from("payments")
        .insert({ booking_id: booking.booking_id, amount: 5000, payment_method: "Cash" });

      expect(error).toBeNull();
      expect(await paymentStatusOf(booking.booking_id)).toBe("Completed");
    } finally {
      await supabase.from("app_roles").delete().eq("user_id", staffUserId);
      await supabase.auth.admin.deleteUser(staffUserId);
    }
  });
});
