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

const SUPABASE_URL = process.env.TEST_SUPABASE_URL || "http://127.0.0.1:54321";
const ANON = process.env.TEST_SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const SERVICE_ROLE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || "";

const PASSWORD = "Test-Password-123!";

let shouldRun = false;
let userId = "";
let email = "";
let accessToken = "";

const PASSWORD_UPDATED = {
  tableName: "authentication",
  description: "Password updated successfully",
  category: "AUTHENTICATION",
  severity: "WARNING",
};

function postAuditEvent(token: string, event: Record<string, unknown> = PASSWORD_UPDATED) {
  return onRequestPost({
    request: new Request("http://localhost/api/audit/log-with-ip", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "CF-Connecting-IP": "203.0.113.9",
      },
      body: JSON.stringify(event),
    }),
    env: { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY },
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
      SUPABASE_URL,
      ANON
    ).auth.signInWithPassword({ email, password: PASSWORD });
    if (signInError || !session.session) throw new Error(`signIn failed: ${signInError?.message}`);
    accessToken = session.session.access_token;
  });

  afterAll(async () => {
    if (!shouldRun) return;
    if (userId) await admin.from("audit_logs").delete().eq("user_id", userId);
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("saves the event with the verified user's id, email and IP", async () => {
    if (!shouldRun) return;

    const response = await postAuditEvent(accessToken);

    expect(response.status).toBe(200);
    const { data: rows } = await admin
      .from("audit_logs")
      .select("user_id, user_email, ip_address, description, category, severity")
      .eq("user_id", userId);
    expect(rows).toEqual([
      {
        user_id: userId,
        user_email: email,
        ip_address: "203.0.113.9",
        description: "Password updated successfully",
        category: "AUTHENTICATION",
        severity: "WARNING",
      },
    ]);
  });

  it("rejects a token that is not a signed-in user", async () => {
    if (!shouldRun) return;

    const response = await postAuditEvent(ANON);

    expect(response.status).toBe(401);
  });

  it("rejects an event the app does not send, and saves nothing", async () => {
    if (!shouldRun) return;
    await admin.from("audit_logs").delete().eq("user_id", userId);

    const response = await postAuditEvent(accessToken, {
      tableName: "bookings",
      description: "Booking deleted",
      category: "BOOKING",
      severity: "CRITICAL",
    });

    expect(response.status).toBe(400);
    const { count } = await admin
      .from("audit_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    expect(count).toBe(0);
  });
});
