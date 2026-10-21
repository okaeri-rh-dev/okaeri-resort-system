import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { AppRoleName } from "@/types/app-role";
import type { Database } from "@/types/database.types";

import { testSupabaseAdmin as admin } from "./test-db";

const URL = process.env.TEST_SUPABASE_URL || "http://127.0.0.1:54321";
const ANON_KEY =
  process.env.TEST_SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

export type TestClient = SupabaseClient<Database>;

export interface RoleClients {
  anon: TestClient;
  byRole: Record<AppRoleName, TestClient>;
  cleanup: () => Promise<void>;
}

const APP_ROLES: AppRoleName[] = ["staff", "manager", "owner", "admin"];

/**
 * Signs in one fresh user per app role (plus an anon client) for RLS tests.
 * Call `cleanup` in afterAll to remove the users and their app_roles rows.
 */
export async function createRoleClients(prefix: string): Promise<RoleClients> {
  const userIds: string[] = [];
  const byRole = {} as Record<AppRoleName, TestClient>;

  for (const role of APP_ROLES) {
    const email = `${prefix}-${role}-${Date.now()}@example.com`;
    const password = "Test-Password-123!";
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`createUser(${role}) failed: ${error?.message}`);
    userIds.push(data.user.id);

    const { error: roleError } = await admin
      .from("app_roles")
      .insert({ user_id: data.user.id, email, role, is_active: true });
    if (roleError) throw new Error(`app_roles insert(${role}) failed: ${roleError.message}`);

    const client = createClient<Database>(URL, ANON_KEY, { auth: { persistSession: false } });
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw new Error(`signIn(${role}) failed: ${signInError.message}`);
    byRole[role] = client;
  }

  return {
    anon: createClient<Database>(URL, ANON_KEY, { auth: { persistSession: false } }),
    byRole,
    cleanup: async () => {
      if (userIds.length) await admin.from("app_roles").delete().in("user_id", userIds);
      for (const id of userIds) await admin.auth.admin.deleteUser(id).catch(() => {});
    },
  };
}
