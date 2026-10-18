/**
 * Audit rows older than 24 months lose their personal data (RA 10173 retention).
 * Actor columns are cleared on every row; data columns everywhere except a keep-list
 * of tables without personal data. Anonymized rows carry metadata.anonymized_at.
 *
 * Requires a local Supabase (supabase start). Runs in the DB suite / infra-health.
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { psqlAvailable, runPsql } from "../setup/psql";
import { testSupabaseAdmin as admin, shouldRunDatabaseTests } from "../setup/test-db";

const PROBE = "anon-probe";
let staffUserId = "";

type ProbeRow = {
  record_id: string;
  user_email: string | null;
  ip_address: unknown;
  user_agent: string | null;
  old_data: unknown;
  new_data: unknown;
  description: string | null;
  metadata: Record<string, unknown> | null;
  user_id: string | null;
  changed_fields: string[] | null;
};

function insertProbe(
  table: "audit_logs" | "audit_logs_archive",
  recordId: string,
  tableName: string,
  age: string
) {
  runPsql(`
    INSERT INTO public.${table} (audit_id, action, source, table_name, record_id, user_id, user_email,
      ip_address, user_agent, old_data, new_data, description, metadata, changed_fields, created_at)
    VALUES (gen_random_uuid(), 'UPDATE', 'db', '${tableName}', '${PROBE}-${recordId}',
      '${staffUserId}', 'staff@example.com', '10.0.0.1', 'probe-agent',
      '{"email":"old@example.com"}', '{"email":"new@example.com"}', 'changed guest@example.com',
      '{"ip":"10.0.0.1"}', ARRAY['email'], now() - interval '${age}');
  `);
}

async function probe(
  table: "audit_logs" | "audit_logs_archive",
  recordId: string
): Promise<ProbeRow> {
  const { data, error } = await admin
    .from(table)
    .select(
      "record_id, user_email, ip_address, user_agent, old_data, new_data, description, metadata, user_id, changed_fields"
    )
    .eq("record_id", `${PROBE}-${recordId}`)
    .single();
  if (error || !data) throw new Error(`probe ${recordId} missing: ${error?.message}`);
  return data as ProbeRow;
}

describe("anonymize_audit_logs", () => {
  let canRun = false;

  beforeAll(async () => {
    canRun = (await shouldRunDatabaseTests()) && psqlAvailable();
    if (!canRun) {
      console.log("⏭️  Skipping audit anonymization tests — database or psql unavailable");
      return;
    }
    // audit_logs.user_id references auth.users, so the probe rows need a real user.
    const { data: created, error } = await admin.auth.admin.createUser({
      email: `anon-probe-${Date.now()}@example.com`,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(`createUser failed: ${error?.message}`);
    staffUserId = created.user.id;
    runPsql(`
      DELETE FROM public.audit_logs WHERE record_id LIKE '${PROBE}-%';
      DELETE FROM public.audit_logs_archive WHERE record_id LIKE '${PROBE}-%';
    `);
    insertProbe("audit_logs", "guest-old", "guests", "25 months");
    insertProbe("audit_logs", "guest-recent", "guests", "23 months");
    insertProbe("audit_logs", "unit-old", "units", "25 months");
    insertProbe("audit_logs", "legacy-old", "auth_events", "25 months");
    insertProbe("audit_logs_archive", "archived-old", "bookings", "25 months");
  });

  afterAll(async () => {
    if (!canRun) return;
    runPsql(`
      DELETE FROM public.audit_logs WHERE record_id LIKE '${PROBE}-%';
      DELETE FROM public.audit_logs_archive WHERE record_id LIKE '${PROBE}-%';
    `);
    if (staffUserId) await admin.auth.admin.deleteUser(staffUserId);
  });

  it("only the service role can execute it", () => {
    if (!canRun) return;
    const fn = "public.anonymize_audit_logs(interval)";
    expect(
      runPsql(`
        SELECT has_function_privilege('anon', '${fn}', 'EXECUTE'),
               has_function_privilege('authenticated', '${fn}', 'EXECUTE'),
               has_function_privilege('service_role', '${fn}', 'EXECUTE');
      `)
    ).toEqual(["f|f|t"]);
  });

  it("anonymizes old rows, keeps recent ones, and is idempotent", async () => {
    if (!canRun) return;
    const { data: first, error } = await admin.rpc("anonymize_audit_logs");
    expect(error).toBeNull();
    expect(first?.[0]?.anonymized_count).toBeGreaterThanOrEqual(4);
    expect(first?.[0]?.audit_logs_bytes).toBeGreaterThan(0);

    const guestOld = await probe("audit_logs", "guest-old");
    expect(guestOld).toMatchObject({
      user_email: null,
      ip_address: null,
      user_agent: null,
      old_data: null,
      new_data: null,
      description: null,
      user_id: staffUserId,
      changed_fields: ["email"],
    });
    expect(Object.keys(guestOld.metadata ?? {})).toEqual(["anonymized_at"]);

    const guestRecent = await probe("audit_logs", "guest-recent");
    expect(guestRecent).toMatchObject({
      user_email: "staff@example.com",
      old_data: { email: "old@example.com" },
      metadata: { ip: "10.0.0.1" },
    });

    const unitOld = await probe("audit_logs", "unit-old");
    expect(unitOld).toMatchObject({
      user_email: null,
      ip_address: null,
      user_agent: null,
      old_data: { email: "old@example.com" },
      new_data: { email: "new@example.com" },
      description: "changed guest@example.com",
    });
    expect(unitOld.metadata).toMatchObject({ ip: "10.0.0.1", anonymized_at: expect.any(String) });

    const legacyOld = await probe("audit_logs", "legacy-old");
    expect(legacyOld).toMatchObject({ user_email: null, old_data: null, description: null });

    const archivedOld = await probe("audit_logs_archive", "archived-old");
    expect(archivedOld).toMatchObject({ user_email: null, old_data: null, new_data: null });

    const { data: second } = await admin.rpc("anonymize_audit_logs");
    expect(second?.[0]?.anonymized_count).toBe(0);
  });
});
