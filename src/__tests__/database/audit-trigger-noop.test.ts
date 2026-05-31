// src/__tests__/database/audit-trigger-noop.test.ts
/**
 * Regression test for audit_trigger_func() no-op UPDATE handling.
 *
 * Locks in the behavior introduced by
 * supabase/migrations/20260530_fix_audit_trigger_skip_noop_updates.sql:
 *   - A genuinely no-op UPDATE on an audited table must succeed without
 *     raising the valid_changed_fields constraint violation, and must NOT
 *     produce an audit_logs row.
 *   - A real UPDATE must still produce an audit_logs row with the actual
 *     changed columns listed in changed_fields.
 *
 * The no-op case requires single-transaction semantics so that NOW() is
 * constant across the INSERT (which sets updated_at via the BEFORE trigger)
 * and the no-op UPDATE (whose BEFORE trigger sets the same NOW() again).
 * Across separate transactions, updated_at advances and the UPDATE is no
 * longer a no-op from the audit trigger's perspective. The Supabase JS
 * client cannot batch multiple statements in one transaction, so the
 * no-op test shells out to psql (already a dev-workflow dependency).
 * The real-UPDATE test runs through the Supabase admin client.
 *
 * @vitest-environment node
 */

import { execFileSync } from "node:child_process";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { shouldRunDatabaseTests, testSupabaseAdmin as supabase } from "../setup/test-db";

// Stable fixture UUID, valid hex only. Chosen to not collide with any
// production data and to be easy to clean up explicitly by primary key.
const FIXTURE_GUEST_ID = "00000000-0000-0000-0000-a0d17a000017";
const FIXTURE_NAME = "Audit Noop Test Fixture";
const FIXTURE_EMAIL = "audit-noop-test@example.com";
const FIXTURE_PHONE = "+639000000017";

const PG_HOST = "127.0.0.1";
const PG_PORT = "54322";
const PG_USER = "postgres";
const PG_DB = "postgres";
const PG_PASSWORD = process.env.PGPASSWORD ?? "postgres";

function psqlAvailable(): boolean {
  try {
    execFileSync("psql", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function runPsql(sql: string): string {
  return execFileSync(
    "psql",
    ["-h", PG_HOST, "-p", PG_PORT, "-U", PG_USER, "-d", PG_DB, "-tA", "-v", "ON_ERROR_STOP=1"],
    {
      input: sql,
      env: { ...process.env, PGPASSWORD: PG_PASSWORD },
      encoding: "utf8",
    }
  );
}

async function deleteFixtureAuditAndGuest() {
  // Delete the guest row first — that fires the DELETE audit trigger,
  // which writes one final audit row. Then wipe all audit_logs for the
  // fixture so nothing leaks into the next test.
  await supabase.from("guests").delete().eq("guest_id", FIXTURE_GUEST_ID);
  await supabase
    .from("audit_logs")
    .delete()
    .eq("table_name", "guests")
    .eq("record_id", FIXTURE_GUEST_ID);
}

describe("audit_trigger_func() — no-op UPDATE handling", () => {
  let shouldRun = false;
  let hasPsql = false;

  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) {
      // eslint-disable-next-line no-console
      console.log("⏭️  Skipping audit-trigger-noop tests — test database not configured");
      return;
    }
    hasPsql = psqlAvailable();
    await deleteFixtureAuditAndGuest();
  });

  afterAll(async () => {
    if (shouldRun) await deleteFixtureAuditAndGuest();
  });

  beforeEach(async () => {
    if (shouldRun) await deleteFixtureAuditAndGuest();
  });

  it("(psql) single-txn no-op UPDATE succeeds without raising and writes no audit row", () => {
    if (!shouldRun) return;
    if (!hasPsql) {
      // eslint-disable-next-line no-console
      console.log("⏭️  Skipping no-op test — psql not on PATH");
      return;
    }

    // Single transaction so NOW() is constant — the no-op UPDATE truly has
    // no diff (updated_at gets re-set to the same value). Pre-fix the
    // UPDATE raised valid_changed_fields; post-fix it short-circuits.
    // ROLLBACK keeps the test side-effect-free.
    const output = runPsql(`
      BEGIN;
      INSERT INTO guests (guest_id, guest_name, email, phone_number)
      VALUES ('${FIXTURE_GUEST_ID}', '${FIXTURE_NAME}', '${FIXTURE_EMAIL}', '${FIXTURE_PHONE}');
      UPDATE guests SET guest_name = guest_name WHERE guest_id = '${FIXTURE_GUEST_ID}';
      SELECT COUNT(*) FROM audit_logs
        WHERE table_name='guests' AND record_id='${FIXTURE_GUEST_ID}';
      ROLLBACK;
    `);

    // psql also emits command tags (BEGIN, INSERT 0 1, UPDATE 1, ROLLBACK)
    // on stdout alongside the SELECT result, so pick out the lone numeric
    // line. One row for the INSERT, zero for the no-op UPDATE.
    const numericLines = output
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^\d+$/.test(l));
    expect(numericLines).toEqual(["1"]);
  });

  it("real UPDATE still writes an audit row with changed_fields populated", async () => {
    if (!shouldRun) return;

    const { error: insertErr } = await supabase.from("guests").insert({
      guest_id: FIXTURE_GUEST_ID,
      guest_name: FIXTURE_NAME,
      email: FIXTURE_EMAIL,
      phone_number: FIXTURE_PHONE,
    });
    expect(insertErr).toBeNull();

    const renamed = `${FIXTURE_NAME} (renamed)`;
    const { error: updateErr } = await supabase
      .from("guests")
      .update({ guest_name: renamed })
      .eq("guest_id", FIXTURE_GUEST_ID);
    expect(updateErr).toBeNull();

    const { data: rows, error: selErr } = await supabase
      .from("audit_logs")
      .select("action, changed_fields")
      .eq("table_name", "guests")
      .eq("record_id", FIXTURE_GUEST_ID)
      .order("created_at", { ascending: true });

    expect(selErr).toBeNull();
    expect(rows).toHaveLength(2);
    expect(rows![0].action).toBe("INSERT");
    expect(rows![1].action).toBe("UPDATE");
    expect(rows![1].changed_fields).toContain("guest_name");
  });
});
