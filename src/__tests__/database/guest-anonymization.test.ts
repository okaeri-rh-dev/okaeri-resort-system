/**
 * Guest retention (RA 10173): anonymize_guest / anonymize_booking clear personal columns,
 * keep money and dates, and scrub the guest's audit rows in the same transaction.
 * See docs/plans/2026-10-21-guest-retention-design.md.
 *
 * Dates come from the database clock: src/test/setup.ts pins Date.now() to 2025.
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { psqlAvailable, runPsql } from "../setup/psql";
import {
  testSupabaseAdmin as admin,
  cleanupTestData,
  createTestBooking,
  createTestGuest,
  shouldRunDatabaseTests,
} from "../setup/test-db";

let canRun = false;
const guestIds: string[] = [];

async function guestWithStay(monthsAgo: number, bookingStatus = "CheckedOut") {
  const guest = await createTestGuest();
  guestIds.push(guest.guest_id);
  const booking = await createTestBooking({ guest, booking_status: bookingStatus });
  runPsql(`
    UPDATE public.bookings
    SET check_in = now() - interval '${monthsAgo} months' - interval '2 days',
        check_out = now() - interval '${monthsAgo} months',
        special_requests = 'call ${guest.email}',
        internal_notes = 'regular',
        payment_proof_url = 'bookings/${booking.booking_id}/proof.jpg'
    WHERE booking_id = '${booking.booking_id}';
    UPDATE public.booking_units SET guest_names = ARRAY['${guest.guest_name}'], unit_notes = 'near pool'
    WHERE booking_id = '${booking.booking_id}';
  `);
  return { guest, booking };
}

async function pay(bookingId: string, amount: number, proofUrl: string | null = null) {
  const { error } = await admin.from("payments").insert({
    booking_id: bookingId,
    amount,
    status: "Active",
    payment_method: "Cash",
    notes: "paid by guest",
    proof_url: proofUrl,
  });
  if (error) throw new Error(`payment insert failed: ${error.message}`);
}

function auditRowsMentioning(text: string): number {
  const [count] = runPsql(`
    SELECT count(*) FROM (
      SELECT old_data, new_data, description FROM public.audit_logs
      UNION ALL SELECT old_data, new_data, description FROM public.audit_logs_archive
    ) a
    WHERE concat(a.old_data::text, a.new_data::text, a.description) LIKE '%${text}%';
  `);
  return Number(count);
}

beforeAll(async () => {
  canRun = (await shouldRunDatabaseTests()) && psqlAvailable();
  if (!canRun) {
    console.log("⏭️  Skipping guest anonymization tests — database or psql unavailable");
    return;
  }
  await cleanupTestData({ includeTestFixtures: true });
});

afterAll(async () => {
  if (!canRun) return;
  await cleanupTestData({ includeTestFixtures: true });
  if (guestIds.length) {
    runPsql(`DELETE FROM public.guests WHERE guest_id IN ('${guestIds.join("','")}');`);
  }
});

describe("anonymize_guest", () => {
  it("only the service role can execute the functions", () => {
    if (!canRun) return;
    for (const fn of ["public.anonymize_guest(uuid)", "public.anonymize_booking(uuid)"]) {
      expect(
        runPsql(`
          SELECT has_function_privilege('anon', '${fn}', 'EXECUTE'),
                 has_function_privilege('authenticated', '${fn}', 'EXECUTE'),
                 has_function_privilege('service_role', '${fn}', 'EXECUTE');
        `)
      ).toEqual(["f|f|t"]);
    }
  });

  it("clears personal columns, keeps money and dates, and returns proof paths", async () => {
    if (!canRun) return;
    const { guest, booking } = await guestWithStay(25);
    await pay(booking.booking_id, 5000, "REF_1.png");

    const { data, error } = await admin.rpc("anonymize_guest", { p_guest_id: guest.guest_id });

    expect(error).toBeNull();
    expect((data ?? []).map((row) => row.proof_path).sort()).toEqual([
      "REF_1.png",
      `bookings/${booking.booking_id}/proof.jpg`,
    ]);

    const { data: guestRow } = await admin
      .from("guests")
      .select("guest_name, email, phone_number, total_spent, anonymized_at")
      .eq("guest_id", guest.guest_id)
      .single();
    expect(guestRow).toMatchObject({
      guest_name: "Removed guest",
      email: null,
      phone_number: null,
    });
    expect(guestRow?.anonymized_at).not.toBeNull();

    const { data: bookingRow } = await admin
      .from("bookings")
      .select(
        "guest_name, email, contact_number, special_requests, internal_notes, payment_proof_url, total_amount, booking_reference, anonymized_at"
      )
      .eq("booking_id", booking.booking_id)
      .single();
    expect(bookingRow).toMatchObject({
      guest_name: "Removed guest",
      email: null,
      contact_number: null,
      special_requests: null,
      internal_notes: null,
      payment_proof_url: null,
      total_amount: booking.total_amount,
      booking_reference: booking.booking_reference,
    });
    expect(bookingRow?.anonymized_at).not.toBeNull();

    const { data: unitRows } = await admin
      .from("booking_units")
      .select("guest_names, unit_notes, subtotal")
      .eq("booking_id", booking.booking_id);
    expect(unitRows).toEqual([{ guest_names: null, unit_notes: null, subtotal: 5000 }]);

    const { data: paymentRows } = await admin
      .from("payments")
      .select("notes, proof_url, amount")
      .eq("booking_id", booking.booking_id);
    expect(paymentRows).toEqual([{ notes: null, proof_url: null, amount: 5000 }]);
  });

  it("scrubs the guest's audit rows of any age, including the ones it writes", async () => {
    if (!canRun) return;
    const { guest } = await guestWithStay(25);
    const other = await guestWithStay(1);
    runPsql(`
      INSERT INTO public.audit_logs (audit_id, action, source, table_name, record_id, changed_fields, old_data, created_at)
      VALUES (gen_random_uuid(), 'UPDATE', 'db', 'guests', '${guest.guest_id}', ARRAY['email'],
              '{"email":"${guest.email}"}', now() - interval '1 month');
      INSERT INTO public.audit_logs_archive (audit_id, action, source, table_name, record_id, changed_fields, old_data, created_at)
      VALUES (gen_random_uuid(), 'UPDATE', 'db', 'guests', '${guest.guest_id}', ARRAY['email'],
              '{"email":"${guest.email}"}', now() - interval '1 month');
    `);
    expect(auditRowsMentioning(guest.email!)).toBeGreaterThan(0);

    const { error } = await admin.rpc("anonymize_guest", { p_guest_id: guest.guest_id });

    expect(error).toBeNull();
    expect(auditRowsMentioning(guest.email!)).toBe(0);
    expect(auditRowsMentioning(guest.guest_name)).toBe(0);
    expect(auditRowsMentioning(other.guest.email!)).toBeGreaterThan(0);
  });

  // A negative "months ago" puts the stay in the future on the database clock.
  it("refuses a guest with a current or future booking", async () => {
    if (!canRun) return;
    const { guest } = await guestWithStay(-1, "Confirmed");

    const { error } = await admin.rpc("anonymize_guest", { p_guest_id: guest.guest_id });

    expect(error?.code).toBe("PT409");
  });

  it("ignores a cancelled future booking", async () => {
    if (!canRun) return;
    const { guest } = await guestWithStay(-1, "Cancelled");

    const { error } = await admin.rpc("anonymize_guest", { p_guest_id: guest.guest_id });

    expect(error).toBeNull();
  });

  it("reports an unknown guest as PT404", async () => {
    if (!canRun) return;
    const { error } = await admin.rpc("anonymize_guest", {
      p_guest_id: "00000000-0000-0000-0000-000000000001",
    });

    expect(error?.code).toBe("PT404");
  });

  it("is a no-op the second time", async () => {
    if (!canRun) return;
    const { guest } = await guestWithStay(25);
    await admin.rpc("anonymize_guest", { p_guest_id: guest.guest_id });
    const [before] = runPsql(
      `SELECT anonymized_at FROM public.guests WHERE guest_id = '${guest.guest_id}';`
    );

    const { data, error } = await admin.rpc("anonymize_guest", { p_guest_id: guest.guest_id });

    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect(
      runPsql(`SELECT anonymized_at FROM public.guests WHERE guest_id = '${guest.guest_id}';`)
    ).toEqual([before]);
  });
});
