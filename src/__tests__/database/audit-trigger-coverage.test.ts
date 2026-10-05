// src/__tests__/database/audit-trigger-coverage.test.ts
/**
 * Every public base table must carry the audit trigger (audit_trigger_func,
 * AFTER INSERT OR UPDATE OR DELETE, FOR EACH ROW) or be listed in
 * UNAUDITED_TABLES with a reason. A new table therefore fails this test until
 * someone decides whether its mutations belong in the audit trail.
 *
 * Catalog queries go through psql: PostgREST does not expose pg_catalog.
 *
 * @vitest-environment node
 */

import { execFileSync } from "node:child_process";

import { beforeAll, describe, expect, it } from "vitest";

import { shouldRunDatabaseTests } from "../setup/test-db";

const UNAUDITED_TABLES: Record<string, string> = {
  audit_logs: "the audit store itself",
  audit_logs_archive: "archived audit rows, written only by archive_audit_logs",
  bookings_conflict_backup: "one-off snapshot from a conflict cleanup, no writers",
  idempotency_keys: "short-lived request dedupe rows purged by cron; auditing would flood the log",
  booking_unit_availability:
    "derived from booking_units by its sync triggers; booking_units is audited",
  guest_assignments: "no writers in the app or functions",
  guest_booking_unit_requests:
    "online booking flow, absent in prod and deferred (plan 2026-10-03, Decisions & Deferrals)",
};

const PG_HOST = "127.0.0.1";
const PG_PORT = "54322";
const PG_USER = "postgres";
const PG_DB = "postgres";
const PG_PASSWORD = process.env.PGPASSWORD ?? "postgres";

// tgtype bits: ROW=1, BEFORE=2, INSERT=4, DELETE=8, UPDATE=16.
// 29 = row-level AFTER INSERT OR DELETE OR UPDATE.
const AFTER_ROW_IUD = 29;

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
    ["-h", PG_HOST, "-p", PG_PORT, "-U", PG_USER, "-d", PG_DB, "-tA", "-v", "ON_ERROR_STOP=1"],
    {
      input: sql,
      env: { ...process.env, PGPASSWORD: PG_PASSWORD },
      encoding: "utf8",
    }
  );
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

const PUBLIC_BASE_TABLES = `
  SELECT c.oid, c.relname
  FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace
    AND c.relkind IN ('r', 'p')
    AND NOT c.relispartition
`;

const AUDIT_TRIGGERS = `
  SELECT t.tgrelid, t.tgargs, t.tgnargs
  FROM pg_trigger t
  WHERE t.tgfoid = 'public.audit_trigger_func'::regproc
    AND NOT t.tgisinternal
    AND t.tgenabled <> 'D'
    AND (t.tgtype & 31) = ${AFTER_ROW_IUD}
`;

describe("audit trigger coverage", () => {
  let canRun = false;

  beforeAll(async () => {
    const dbReady = await shouldRunDatabaseTests();
    canRun = dbReady && psqlAvailable();
    if (!canRun)
      console.log("⏭️  Skipping audit-trigger-coverage tests — database or psql unavailable");
  });

  it("every public base table is audited or allowlisted", () => {
    if (!canRun) return;

    const uncovered = runPsql(`
      WITH tables AS (${PUBLIC_BASE_TABLES}), triggers AS (${AUDIT_TRIGGERS})
      SELECT relname FROM tables
      WHERE oid NOT IN (SELECT tgrelid FROM triggers)
      ORDER BY relname;
    `);

    const missingDecision = uncovered.filter((table) => !(table in UNAUDITED_TABLES));
    expect(missingDecision).toEqual([]);
  });

  it("every allowlisted table exists and is still unaudited", () => {
    if (!canRun) return;

    const tables = new Set(runPsql(`SELECT relname FROM (${PUBLIC_BASE_TABLES}) t;`));
    const audited = new Set(
      runPsql(`
        WITH tables AS (${PUBLIC_BASE_TABLES}), triggers AS (${AUDIT_TRIGGERS})
        SELECT relname FROM tables WHERE oid IN (SELECT tgrelid FROM triggers);
      `)
    );

    const staleEntries = Object.keys(UNAUDITED_TABLES).filter(
      (table) => !tables.has(table) || audited.has(table)
    );
    expect(staleEntries).toEqual([]);
  });

  it("every audit trigger resolves record_id to a real column", () => {
    if (!canRun) return;

    // Mirrors audit_trigger_func: the trigger argument wins, then
    // <table>_id, <table minus trailing s>_id, id, log_id.
    const unresolved = runPsql(`
      WITH tables AS (${PUBLIC_BASE_TABLES}), triggers AS (${AUDIT_TRIGGERS})
      SELECT tables.relname
      FROM tables JOIN triggers ON triggers.tgrelid = tables.oid
      WHERE NOT EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = tables.oid AND a.attnum > 0 AND NOT a.attisdropped
          AND a.attname = ANY (ARRAY[
            CASE WHEN triggers.tgnargs > 0
              THEN split_part(encode(triggers.tgargs, 'escape'), '\\000', 1) END,
            tables.relname || '_id',
            regexp_replace(tables.relname, 's$', '') || '_id',
            'id',
            'log_id'
          ])
      )
      ORDER BY tables.relname;
    `);

    expect(unresolved).toEqual([]);
  });

  it("an app_roles grant writes an audit row keyed by user_id", () => {
    if (!canRun) return;

    const userId = "00000000-0000-0000-0000-a0d17a000018";
    const rows = runPsql(`
      BEGIN;
      INSERT INTO auth.users (id, email) VALUES ('${userId}', 'audit-coverage-test@example.com');
      INSERT INTO public.app_roles (user_id, email, role)
        VALUES ('${userId}', 'audit-coverage-test@example.com', 'staff');
      SELECT action || ':' || record_id FROM public.audit_logs
        WHERE table_name = 'app_roles' AND record_id = '${userId}';
      ROLLBACK;
    `).filter((line) => line.includes(":"));

    expect(rows).toEqual([`INSERT:${userId}`]);
  });
});
