/**
 * referenced_payment_proof_paths() lists every payment-proof file a booking or payment
 * still links to, as bucket paths. The orphaned-proof sweep never deletes these.
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { psqlAvailable, runPsql } from "../setup/psql";
import {
  testSupabaseAdmin as admin,
  cleanupTestData,
  createTestBooking,
  shouldRunDatabaseTests,
} from "../setup/test-db";

let canRun = false;

beforeAll(async () => {
  canRun = (await shouldRunDatabaseTests()) && psqlAvailable();
  if (!canRun) {
    console.log("⏭️  Skipping referenced proof path tests — database or psql unavailable");
    return;
  }
  await cleanupTestData({ includeTestFixtures: true });
});

afterAll(async () => {
  if (!canRun) return;
  await cleanupTestData({ includeTestFixtures: true });
});

describe("referenced_payment_proof_paths", () => {
  it("only the service role can execute it", () => {
    if (!canRun) return;
    expect(
      runPsql(`
        SELECT has_function_privilege('anon', 'public.referenced_payment_proof_paths()', 'EXECUTE'),
               has_function_privilege('authenticated', 'public.referenced_payment_proof_paths()', 'EXECUTE'),
               has_function_privilege('service_role', 'public.referenced_payment_proof_paths()', 'EXECUTE');
      `)
    ).toEqual(["f|f|t"]);
  });

  it("returns booking and payment proofs as bucket paths, whether stored as a path or a URL", async () => {
    if (!canRun) return;
    const booking = await createTestBooking();
    runPsql(`
      UPDATE public.bookings SET payment_proof_url = 'TEMP-booking1_1700000000000.png'
      WHERE booking_id = '${booking.booking_id}';
    `);
    const { error } = await admin.from("payments").insert([
      {
        booking_id: booking.booking_id,
        amount: 1000,
        status: "Active",
        payment_method: "GCash",
        proof_url:
          "http://127.0.0.1:54321/storage/v1/object/sign/payment-proofs/TEMP-payment1_1700000000000.jpg?token=abc",
      },
      { booking_id: booking.booking_id, amount: 500, status: "Active", payment_method: "Cash" },
    ]);
    if (error) throw new Error(`payment insert failed: ${error.message}`);

    const { data, error: rpcError } = await admin.rpc("referenced_payment_proof_paths");

    expect(rpcError).toBeNull();
    const paths = (data ?? []).map((row) => row.file_path);
    expect(paths).toContain("TEMP-booking1_1700000000000.png");
    expect(paths).toContain("TEMP-payment1_1700000000000.jpg");
    expect(paths).not.toContain(null);
  });
});
