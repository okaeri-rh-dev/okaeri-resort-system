/**
 * Regression: logAuditEventWorker (every server-side audit write) inserted
 * entity_type / entity_id / changes, which audit_logs does not have, and an
 * action like "admin.available_units.query", which audit_logs_action_check
 * rejects. The insert error was only logged, so no Workers audit row was ever
 * written. Runs against local Supabase.
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { logAuditEventWorker } from "../../../functions/lib/audit-logger-workers";
import { shouldRunDatabaseTests, testSupabaseAdmin } from "../setup/test-db";

describe("logAuditEventWorker against the real audit_logs table", () => {
  let shouldRun = false;
  const recordId = crypto.randomUUID();

  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
  });

  afterAll(async () => {
    if (!shouldRun) return;
    await testSupabaseAdmin.from("audit_logs").delete().eq("record_id", recordId);
  });

  it("writes a row an admin can find by event type and record", async () => {
    if (!shouldRun) return;

    await logAuditEventWorker(testSupabaseAdmin as never, {
      action: "booking.unit.assigned",
      entity_type: "booking",
      entity_id: recordId,
      severity: "INFO",
      description: "Assigned 2 units",
      changes: { before: { status: "Pending" }, after: { status: "Confirmed" } },
      metadata: { unit_count: 2 },
    });

    const { data, error } = await testSupabaseAdmin
      .from("audit_logs")
      .select("event_type, table_name, record_id, source, old_data, new_data, description")
      .eq("record_id", recordId);

    expect(error).toBeNull();
    expect(data).toEqual([
      {
        event_type: "booking.unit.assigned",
        table_name: "booking",
        record_id: recordId,
        source: "app",
        old_data: { status: "Pending" },
        new_data: { status: "Confirmed" },
        description: "Assigned 2 units",
      },
    ]);
  });
});
