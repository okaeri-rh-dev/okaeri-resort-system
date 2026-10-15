/**
 * Maintenance SQL functions: audit archive/restore, audit trigger attach/detach,
 * and the payment-proof cleanup the weekly cron calls.
 *
 * All five failed `supabase db lint` (wrong columns, a bad format string, an
 * ambiguous overload), and anon/authenticated could execute every one of them,
 * most as SECURITY DEFINER. They are service-role only now.
 *
 * Catalog queries and DDL go through psql: PostgREST does not expose pg_catalog.
 *
 * Requires a local Supabase (supabase start). Runs in the DB suite / infra-health.
 *
 * @vitest-environment node
 */

import { execFileSync } from "node:child_process";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  testSupabaseAdmin as admin,
  createTestBooking,
  shouldRunDatabaseTests,
} from "../setup/test-db";

const PG_PASSWORD = process.env.PGPASSWORD ?? "postgres";
const PROBE_TABLE = "maintenance_fn_probe";
const PUBLIC_URL_PREFIX = "http://127.0.0.1:54321/storage/v1/object/public/payment-proofs/";
const DAY_MS = 24 * 60 * 60 * 1000;

// src/test/setup.ts pins Date.now() to 2025; retention compares against the database clock.
let dbNowMs = 0;

const SERVICE_ROLE_ONLY = [
  "archive_audit_logs(timestamptz, boolean)",
  "archive_logs_older_than_months(integer, boolean)",
  "monthly_archive_until(timestamptz, boolean)",
  "restore_logs_from_archive(timestamptz, timestamptz)",
  "attach_audit_trigger(text)",
  "detach_audit_trigger(text)",
  "cleanup_expired_payment_proofs()",
];

const DROPPED_OVERLOADS = [
  "archive_audit_logs(timestamptz)",
  "archive_logs_older_than_months(integer)",
  "monthly_archive_until(date)",
  "restore_logs_from_archive(date)",
];

function psqlAvailable(): boolean {
  try {
    execFileSync("psql", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function runPsql(sql: string): string[] {
  const output = execFileSync(
    "psql",
    [
      "-h",
      "127.0.0.1",
      "-p",
      "54322",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-tA",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: sql, env: { ...process.env, PGPASSWORD: PG_PASSWORD }, encoding: "utf8" }
  );
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function backdateBooking(bookingId: string, column: "updated_at", daysAgo: number) {
  runPsql(`
    SET session_replication_role = replica;
    UPDATE public.bookings SET ${column} = now() - interval '${daysAgo} days'
    WHERE booking_id = '${bookingId}';
  `);
}

async function pastBooking(
  status: "CheckedOut" | "Cancelled" | "Confirmed",
  checkOutDaysAgo: number,
  proofPath: string
) {
  const checkOut = new Date(dbNowMs - checkOutDaysAgo * DAY_MS);
  const booking = await createTestBooking({
    check_in: new Date(checkOut.getTime() - 2 * DAY_MS),
    check_out: checkOut,
    booking_status: status,
  });
  const { error } = await admin
    .from("bookings")
    .update({ payment_proof_url: `${PUBLIC_URL_PREFIX}${proofPath}?t=1` })
    .eq("booking_id", booking.booking_id);
  if (error) throw new Error(`proof update failed: ${error.message}`);
  return booking;
}

describe("maintenance SQL functions", () => {
  let canRun = false;
  const bookingIds: string[] = [];

  beforeAll(async () => {
    canRun = (await shouldRunDatabaseTests()) && psqlAvailable();
    if (!canRun) {
      console.log("⏭️  Skipping maintenance function tests — database or psql unavailable");
      return;
    }
    dbNowMs = Number(runPsql("SELECT floor(extract(epoch FROM now()) * 1000);")[0]);
  });

  afterAll(async () => {
    if (!canRun) return;
    runPsql(`DROP TABLE IF EXISTS public.${PROBE_TABLE};`);
    await admin.from("audit_logs").delete().eq("table_name", PROBE_TABLE);
    await admin.from("audit_logs_archive").delete().eq("table_name", PROBE_TABLE);
    if (bookingIds.length > 0) {
      await admin.from("payments").delete().in("booking_id", bookingIds);
      await admin.from("booking_units").delete().in("booking_id", bookingIds);
      await admin.from("bookings").delete().in("booking_id", bookingIds);
    }
  });

  it("only the service role can execute them", () => {
    if (!canRun) return;
    const rows = runPsql(
      SERVICE_ROLE_ONLY.map(
        (fn) =>
          `SELECT '${fn}', has_function_privilege('anon', 'public.${fn}', 'EXECUTE'),
                  has_function_privilege('authenticated', 'public.${fn}', 'EXECUTE'),
                  has_function_privilege('service_role', 'public.${fn}', 'EXECUTE');`
      ).join("\n")
    );
    expect(rows).toEqual(SERVICE_ROLE_ONLY.map((fn) => `${fn}|f|f|t`));
  });

  it("drops the ambiguous 1-arg overloads", () => {
    if (!canRun) return;
    const rows = runPsql(
      DROPPED_OVERLOADS.map((fn) => `SELECT to_regprocedure('public.${fn}') IS NULL;`).join("\n")
    );
    expect(rows).toEqual(DROPPED_OVERLOADS.map(() => "t"));
  });

  it("archives and restores audit rows by date", async () => {
    if (!canRun) return;
    const { error: insertError } = await admin.from("audit_logs").insert({
      action: "INSERT",
      source: "app",
      table_name: PROBE_TABLE,
      description: "ancient",
      created_at: "2000-01-15T00:00:00Z",
    });
    expect(insertError).toBeNull();

    const { data: dryRun, error: dryRunError } = await admin.rpc("archive_logs_older_than_months", {
      months_old: 1200,
    });
    expect(dryRunError).toBeNull();
    expect(dryRun).toEqual([expect.objectContaining({ archived_count: 0 })]);

    const { data: monthly, error: monthlyError } = await admin.rpc("monthly_archive_until", {
      final_cutoff_date: "2000-02-01T00:00:00Z",
      dry_run: false,
    });
    expect(monthlyError).toBeNull();
    expect(monthly).toEqual([{ month_archived: "2000-01-01", logs_archived: 1 }]);

    const { count: archived } = await admin
      .from("audit_logs_archive")
      .select("*", { count: "exact", head: true })
      .eq("table_name", PROBE_TABLE);
    expect(archived).toBe(1);

    const { error: restoreError } = await admin.rpc("restore_logs_from_archive", {
      start_date: "2000-01-01T00:00:00Z",
      end_date: "2000-02-01T00:00:00Z",
    });
    expect(restoreError).toBeNull();
    const { count: restored } = await admin
      .from("audit_logs")
      .select("*", { count: "exact", head: true })
      .eq("table_name", PROBE_TABLE);
    expect(restored).toBe(1);
  });

  it("attaches and detaches the audit trigger", () => {
    if (!canRun) return;
    const triggerCount = `SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.${PROBE_TABLE}'::regclass AND tgname = 'audit_trigger_${PROBE_TABLE}';`;
    runPsql(`CREATE TABLE public.${PROBE_TABLE} (id int primary key);`);

    runPsql(`SELECT public.attach_audit_trigger('${PROBE_TABLE}');`);
    expect(runPsql(triggerCount)).toEqual(["1"]);

    runPsql(`SELECT public.detach_audit_trigger('${PROBE_TABLE}');`);
    expect(runPsql(triggerCount)).toEqual(["0"]);
  });

  it("clears expired payment proofs and returns their bucket paths", async () => {
    if (!canRun) return;
    const checkedOutOld = await pastBooking("CheckedOut", 100, "bookings/old/proof.jpg");
    const checkedOutRecent = await pastBooking("CheckedOut", 10, "bookings/recent/proof.jpg");
    const cancelledOld = await pastBooking("Cancelled", 5, "GUEST-REF_1.png");
    const cancelledRecent = await pastBooking("Cancelled", 5, "GUEST-REF_2.png");
    const confirmedOld = await pastBooking("Confirmed", 200, "bookings/confirmed/proof.jpg");
    bookingIds.push(
      ...[checkedOutOld, checkedOutRecent, cancelledOld, cancelledRecent, confirmedOld].map(
        (booking) => booking.booking_id
      )
    );
    backdateBooking(cancelledOld.booking_id, "updated_at", 40);
    backdateBooking(cancelledRecent.booking_id, "updated_at", 10);

    const { error: paymentError } = await admin.from("payments").insert({
      booking_id: checkedOutOld.booking_id,
      amount: 100,
      proof_url: `${PUBLIC_URL_PREFIX}bookings/old/proof.jpg?t=1`,
      status: "Active",
    });
    expect(paymentError).toBeNull();

    const { data, error } = await admin.rpc("cleanup_expired_payment_proofs");
    expect(error).toBeNull();
    expect((data ?? []).map((row) => row.file_path).sort()).toEqual([
      "GUEST-REF_1.png",
      "bookings/old/proof.jpg",
    ]);

    const { data: remaining } = await admin
      .from("bookings")
      .select("booking_id, payment_proof_url")
      .in("booking_id", bookingIds)
      .not("payment_proof_url", "is", null);
    expect((remaining ?? []).map((row) => row.booking_id).sort()).toEqual(
      [checkedOutRecent, cancelledRecent, confirmedOld].map((booking) => booking.booking_id).sort()
    );

    const { data: payment } = await admin
      .from("payments")
      .select("proof_url")
      .eq("booking_id", checkedOutOld.booking_id)
      .single();
    expect(payment?.proof_url).toBeNull();
  });
});
