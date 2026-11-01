/**
 * POST /api/audit/log-with-ip saves the event as the verified caller.
 *
 * audit_logs takes no client INSERT since 20261012000000, so the endpoint must
 * write with the service role and stamp user_id / user_email itself.
 *
 * Requires a local Supabase (supabase start). Runs in the DB suite / infra-health.
 *
 * @vitest-environment node
 */

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { onRequestPost } from "../../../functions/api/audit/log-with-ip";
import { testSupabaseAdmin as admin, shouldRunDatabaseTests } from "../setup/test-db";

const URL = process.env.TEST_SUPABASE_URL || "http://127.0.0.1:54321";
const ANON = process.env.TEST_SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const SERVICE_ROLE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || "";

const PROBE_TABLE = "log_with_ip_probe";
const PASSWORD = "Test-Password-123!";

let shouldRun = false;
let userId = "";
let email = "";
let accessToken = "";

function postAuditEvent(token: string) {
  return onRequestPost({
    request: new Request("http://localhost/api/audit/log-with-ip", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "CF-Connecting-IP": "203.0.113.9",
      },
      body: JSON.stringify({
        tableName: PROBE_TABLE,
        description: "Password updated",
        category: "authentication",
      }),
    }),
    env: { SUPABASE_URL: URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY },
  });
}

describe("POST /api/audit/log-with-ip", () => {
  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) return;

    email = `log-with-ip-${Date.now()}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
    userId = data.user.id;

    const { data: session, error: signInError } = await createClient(
      URL,
      ANON
    ).auth.signInWithPassword({ email, password: PASSWORD });
    if (signInError || !session.session) throw new Error(`signIn failed: ${signInError?.message}`);
    accessToken = session.session.access_token;
  });

  afterAll(async () => {
    if (!shouldRun) return;
    await admin.from("audit_logs").delete().eq("table_name", PROBE_TABLE);
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("saves the event with the verified user's id, email and IP", async () => {
    if (!shouldRun) return;

    const response = await postAuditEvent(accessToken);

    expect(response.status).toBe(200);
    const { data: rows } = await admin
      .from("audit_logs")
      .select("user_id, user_email, ip_address, description")
      .eq("table_name", PROBE_TABLE);
    expect(rows).toEqual([
      {
        user_id: userId,
        user_email: email,
        ip_address: "203.0.113.9",
        description: "Password updated",
      },
    ]);
  });

  it("rejects a token that is not a signed-in user", async () => {
    if (!shouldRun) return;

    const response = await postAuditEvent(ANON);

    expect(response.status).toBe(401);
  });
});
