/**
 * audit_trigger_func() records the signed-in user's email, so trigger rows in
 * the audit viewer name the editor instead of "System". Writes without a user
 * JWT (service role, cron) keep a null email.
 *
 * Requires a local Supabase (supabase start).
 *
 * @vitest-environment node
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { testSupabaseAdmin as admin, shouldRunDatabaseTests } from "../setup/test-db";

const URL = process.env.TEST_SUPABASE_URL || "http://127.0.0.1:54321";
const ANON = process.env.TEST_SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

const FIXTURE_GUEST_ID = "00000000-0000-0000-0000-a0d17e000018";
const MANAGER_EMAIL = `audit-email-manager-${Date.now()}@example.com`;
const MANAGER_PASSWORD = "Test-Password-123!";

let shouldRun = false;
let managerId: string | undefined;
let manager: SupabaseClient;

async function deleteFixture() {
  await admin.from("guests").delete().eq("guest_id", FIXTURE_GUEST_ID);
  await admin
    .from("audit_logs")
    .delete()
    .eq("table_name", "guests")
    .eq("record_id", FIXTURE_GUEST_ID);
}

async function fixtureAuditRows() {
  const { data, error } = await admin
    .from("audit_logs")
    .select("action, user_id, user_email")
    .eq("table_name", "guests")
    .eq("record_id", FIXTURE_GUEST_ID)
    .order("created_at", { ascending: true });
  expect(error).toBeNull();
  return data ?? [];
}

describe("audit_trigger_func() user_email", () => {
  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) return;
    await deleteFixture();

    const { data, error } = await admin.auth.admin.createUser({
      email: MANAGER_EMAIL,
      password: MANAGER_PASSWORD,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
    managerId = data.user.id;

    const { error: roleErr } = await admin
      .from("app_roles")
      .insert({ user_id: managerId, email: MANAGER_EMAIL, role: "manager", is_active: true });
    if (roleErr) throw new Error(`app_roles insert failed: ${roleErr.message}`);

    manager = createClient(URL, ANON);
    const { error: signInErr } = await manager.auth.signInWithPassword({
      email: MANAGER_EMAIL,
      password: MANAGER_PASSWORD,
    });
    if (signInErr) throw new Error(`signIn failed: ${signInErr.message}`);

    const { error: insertErr } = await admin.from("guests").insert({
      guest_id: FIXTURE_GUEST_ID,
      guest_name: "Audit Email Fixture",
      email: "audit-email-fixture@example.com",
      phone_number: "+639000000018",
    });
    if (insertErr) throw new Error(`guest insert failed: ${insertErr.message}`);
  });

  afterAll(async () => {
    if (!shouldRun) return;
    await deleteFixture();
    if (managerId) {
      await admin.from("app_roles").delete().eq("user_id", managerId);
      await admin.auth.admin.deleteUser(managerId);
    }
  });

  it("leaves user_email null for a service-role write", async () => {
    if (!shouldRun) return;

    const [insertRow] = await fixtureAuditRows();
    expect(insertRow.action).toBe("INSERT");
    expect(insertRow.user_email).toBeNull();
  });

  it("records the signed-in user's email and id on an edit", async () => {
    if (!shouldRun) return;

    const { error } = await manager
      .from("guests")
      .update({ guest_name: "Audit Email Fixture (renamed)" })
      .eq("guest_id", FIXTURE_GUEST_ID);
    expect(error).toBeNull();

    const updateRow = (await fixtureAuditRows()).find((row) => row.action === "UPDATE");
    expect(updateRow?.user_id).toBe(managerId);
    expect(updateRow?.user_email).toBe(MANAGER_EMAIL);
  });
});
