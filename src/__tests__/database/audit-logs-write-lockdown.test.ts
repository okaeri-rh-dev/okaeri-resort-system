/**
 * Audit tables accept writes only from the audit trigger and the service role.
 *
 * Before the lockdown, anon could insert audit_logs rows with user_id NULL,
 * any signed-in user could insert any row, and audit_logs_archive accepted
 * inserts from anyone. Legitimate writers (audit_trigger_func, SECURITY DEFINER,
 * and the Pages functions' service-role client) bypass RLS, so neither table
 * needs a client-facing INSERT path.
 *
 * Requires a local Supabase (supabase start). Runs in the DB suite / infra-health.
 *
 * @vitest-environment node
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { testSupabaseAdmin as admin, shouldRunDatabaseTests } from "../setup/test-db";

const URL = process.env.TEST_SUPABASE_URL || "http://127.0.0.1:54321";
const ANON = process.env.TEST_SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

const PROBE_TABLE = "forged_audit_probe";
const FIXTURE_GUEST_ID = "00000000-0000-0000-0000-a0d17e000019";
const PASSWORD = "Test-Password-123!";

let shouldRun = false;
const createdUserIds: string[] = [];
const signedIn: Record<"roleless" | "admin", SupabaseClient | undefined> = {
  roleless: undefined,
  admin: undefined,
};

const forgedRow = {
  action: "INSERT",
  source: "app",
  table_name: PROBE_TABLE,
  description: "forged",
};

async function signInNewUser(label: "roleless" | "admin") {
  const email = `audit-lockdown-${label}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser(${label}) failed: ${error?.message}`);
  createdUserIds.push(data.user.id);

  if (label === "admin") {
    const { error: roleError } = await admin
      .from("app_roles")
      .insert({ user_id: data.user.id, email, role: "admin", is_active: true });
    if (roleError) throw new Error(`app_roles insert failed: ${roleError.message}`);
  }

  const client = createClient(URL, ANON);
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (signInError) throw new Error(`signIn(${label}) failed: ${signInError.message}`);
  signedIn[label] = client;
}

async function deleteFixtures() {
  await admin.from("audit_logs").delete().eq("table_name", PROBE_TABLE);
  await admin.from("audit_logs_archive").delete().eq("table_name", PROBE_TABLE);
  await admin.from("guests").delete().eq("guest_id", FIXTURE_GUEST_ID);
  await admin
    .from("audit_logs")
    .delete()
    .eq("table_name", "guests")
    .eq("record_id", FIXTURE_GUEST_ID);
}

async function probeRowCount(table: "audit_logs" | "audit_logs_archive") {
  const { count, error } = await admin
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("table_name", PROBE_TABLE);
  if (error) throw new Error(`count(${table}) failed: ${error.message}`);
  return count ?? 0;
}

describe("audit tables reject client writes", () => {
  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) return;
    await deleteFixtures();
    await signInNewUser("roleless");
    await signInNewUser("admin");
  });

  afterAll(async () => {
    if (!shouldRun) return;
    await deleteFixtures();
    await admin.from("app_roles").delete().in("user_id", createdUserIds);
    for (const userId of createdUserIds) await admin.auth.admin.deleteUser(userId);
  });

  it("rejects an anonymous insert into audit_logs", async () => {
    if (!shouldRun) return;
    const anon = createClient(URL, ANON);
    const { error } = await anon.from("audit_logs").insert(forgedRow);
    expect(error).not.toBeNull();
    expect(await probeRowCount("audit_logs")).toBe(0);
  });

  it.each(["roleless", "admin"] as const)(
    "rejects a %s user's insert into audit_logs",
    async (label) => {
      if (!shouldRun) return;
      const { error } = await signedIn[label]!.from("audit_logs").insert(forgedRow);
      expect(error).not.toBeNull();
      expect(await probeRowCount("audit_logs")).toBe(0);
    }
  );

  it("rejects anonymous and signed-in inserts into audit_logs_archive", async () => {
    if (!shouldRun) return;
    const anon = createClient(URL, ANON);
    const anonResult = await anon.from("audit_logs_archive").insert(forgedRow);
    const userResult = await signedIn.roleless!.from("audit_logs_archive").insert(forgedRow);
    expect(anonResult.error).not.toBeNull();
    expect(userResult.error).not.toBeNull();
    expect(await probeRowCount("audit_logs_archive")).toBe(0);
  });

  it("still lets the service role write audit_logs (Pages functions' audit logger)", async () => {
    if (!shouldRun) return;
    const { error } = await admin.from("audit_logs").insert(forgedRow);
    expect(error).toBeNull();
    expect(await probeRowCount("audit_logs")).toBe(1);
  });

  it("still records table changes through the audit trigger", async () => {
    if (!shouldRun) return;
    const { error } = await admin.from("guests").insert({
      guest_id: FIXTURE_GUEST_ID,
      guest_name: "Audit Lockdown Guest",
      email: "audit-lockdown-guest@example.com",
      phone_number: "+639000000019",
    });
    expect(error).toBeNull();

    const { data, error: readError } = await admin
      .from("audit_logs")
      .select("action")
      .eq("table_name", "guests")
      .eq("record_id", FIXTURE_GUEST_ID);
    expect(readError).toBeNull();
    expect(data?.map((row) => row.action)).toContain("INSERT");
  });

  it("still lets an admin read audit_logs", async () => {
    if (!shouldRun) return;
    const { error } = await signedIn.admin!.from("audit_logs").select("audit_id").limit(1);
    expect(error).toBeNull();
  });
});
