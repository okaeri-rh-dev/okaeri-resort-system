/**
 * The Payment module (src/lib/payments) against local Supabase.
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  appendVerificationNote,
  createPayment,
  recordProofPayment,
  softDeletePayment,
  updatePayment,
} from "@/lib/payments";

import {
  cleanupTestData,
  createTestBooking,
  shouldRunDatabaseTests,
  testSupabaseAdmin as supabase,
} from "../setup/test-db";

// create_multi_unit_booking sums unit subtotals into total_amount
const bookingTotaling = (total: number) =>
  createTestBooking({ total_amount: total, unit_price: total, subtotal: total });

const proofImage = () =>
  new File([new Uint8Array([137, 80, 78, 71])], "proof.png", { type: "image/png" });

async function rowOf(paymentId: string) {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("payment_id", paymentId)
    .single();
  if (error) throw error;
  return data;
}

async function paymentStatusOf(bookingId: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select("payment_status")
    .eq("booking_id", bookingId)
    .single();
  if (error) throw error;
  return data.payment_status;
}

describe("Payment module", () => {
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

  it("records a cash payment with no proof on the picked Manila day", async () => {
    if (!shouldRun) return;
    const booking = await bookingTotaling(5000);

    const payment = await createPayment(supabase, {
      booking_id: booking.booking_id,
      amount: 2000,
      payment_method: "Cash",
      payment_date: new Date(2026, 9, 15),
    });

    const row = await rowOf(payment.payment_id);
    expect(row.amount).toBe(2000);
    expect(row.proof_url).toBeNull();
    expect(row.status).toBe("Active");
    expect(row.payment_date).toBe("2026-10-15T04:00:00+00:00");
    expect(await paymentStatusOf(booking.booking_id)).toBe("Partial");
  });

  it("uploads proof when a file is given", async () => {
    if (!shouldRun) return;
    const booking = await bookingTotaling(5000);

    const payment = await createPayment(
      supabase,
      {
        booking_id: booking.booking_id,
        amount: 5000,
        payment_method: "GCash",
        payment_date: new Date(2026, 9, 15),
      },
      proofImage()
    );

    expect((await rowOf(payment.payment_id)).proof_url).toContain("payment-proofs");
  });

  it("changes only the fields an update names, keeping the proof", async () => {
    if (!shouldRun) return;
    const booking = await bookingTotaling(5000);
    const payment = await createPayment(
      supabase,
      {
        booking_id: booking.booking_id,
        amount: 2000,
        payment_method: "GCash",
        payment_date: new Date(2026, 9, 15),
        notes: "First half",
      },
      proofImage()
    );
    const proofUrl = (await rowOf(payment.payment_id)).proof_url;

    await updatePayment(supabase, payment.payment_id, { amount: 5000 });

    const row = await rowOf(payment.payment_id);
    expect(row.amount).toBe(5000);
    expect(row.proof_url).toBe(proofUrl);
    expect(row.notes).toBe("First half");
    expect(await paymentStatusOf(booking.booking_id)).toBe("Completed");
  });

  it("stops counting a soft-deleted payment", async () => {
    if (!shouldRun) return;
    const booking = await bookingTotaling(5000);
    const payment = await createPayment(supabase, {
      booking_id: booking.booking_id,
      amount: 5000,
      payment_method: "Cash",
      payment_date: new Date(2026, 9, 15),
    });

    await softDeletePayment(supabase, payment.payment_id);

    expect((await rowOf(payment.payment_id)).status).toBe("Deleted");
    expect(await paymentStatusOf(booking.booking_id)).toBe("Pending");
  });

  it("appends the verification note after existing notes", async () => {
    if (!shouldRun) return;
    const booking = await bookingTotaling(5000);
    const payment = await createPayment(supabase, {
      booking_id: booking.booking_id,
      amount: 5000,
      payment_method: "GCash",
      payment_date: new Date(2026, 9, 15),
      notes: "Ref 12345",
    });

    await appendVerificationNote(
      supabase,
      payment.payment_id,
      "manager@example.com",
      new Date("2026-10-16T02:00:00Z")
    );

    expect((await rowOf(payment.payment_id)).notes).toBe(
      "Ref 12345\nVerified by manager@example.com on 2026-10-16"
    );
  });

  it("records proof against the outstanding balance", async () => {
    if (!shouldRun) return;
    const booking = await bookingTotaling(5000);
    await createPayment(supabase, {
      booking_id: booking.booking_id,
      amount: 1500,
      payment_method: "Cash",
      payment_date: new Date(2026, 9, 15),
    });

    const payment = await recordProofPayment(supabase, booking.booking_id, proofImage());

    const row = await rowOf(payment.payment_id);
    expect(row.amount).toBe(3500);
    expect(row.proof_url).toContain("payment-proofs");
    expect(await paymentStatusOf(booking.booking_id)).toBe("Completed");
  });

  it("refuses proof for a booking with nothing outstanding", async () => {
    if (!shouldRun) return;
    const booking = await bookingTotaling(5000);
    await createPayment(supabase, {
      booking_id: booking.booking_id,
      amount: 5000,
      payment_method: "Cash",
      payment_date: new Date(2026, 9, 15),
    });

    await expect(recordProofPayment(supabase, booking.booking_id, proofImage())).rejects.toThrow(
      "already fully paid"
    );
  });
});
