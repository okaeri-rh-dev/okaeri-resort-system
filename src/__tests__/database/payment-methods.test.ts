/**
 * Payment methods: an admin creates and edits a method with the Settings form's payload.
 *
 * Requires a local Supabase (supabase start).
 *
 * @vitest-environment node
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createRoleClients, type RoleClients } from "../setup/role-clients";
import { testSupabaseAdmin as admin, shouldRunDatabaseTests } from "../setup/test-db";

const TEST_PROVIDER_PREFIX = "dbtest-pm-";

let shouldRun = false;
let roles: RoleClients;

const PAYMENT_METHOD_COLUMNS = [
  "account_name",
  "account_number",
  "bank_name",
  "created_at",
  "display_name",
  "display_order",
  "icon_name",
  "id",
  "instructions",
  "is_active",
  "method_type",
  "provider_name",
  "qr_code_storage_path",
  "qr_code_url",
  "updated_at",
];

const formPayload = {
  method_type: "e-wallet",
  provider_name: `${TEST_PROVIDER_PREFIX}${Date.now()}`,
  display_name: "Test Wallet",
  account_name: "Okaeri Resort",
  account_number: "0917-000-0000",
  bank_name: null,
  icon_name: "Smartphone",
  display_order: 50,
  instructions: null,
  is_active: true,
};

describe("payment_methods", () => {
  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) return;
    roles = await createRoleClients("payment-methods");
  }, 60000);

  afterEach(async () => {
    if (!shouldRun) return;
    await admin.from("payment_methods").delete().like("provider_name", `${TEST_PROVIDER_PREFIX}%`);
  });

  afterAll(async () => {
    if (!shouldRun) return;
    await roles.cleanup();
  });

  it("admin creates and edits a method without an icon colour", async () => {
    if (!shouldRun) return;
    const client = roles.byRole.admin;

    const { data: created, error: createError } = await client
      .from("payment_methods")
      .insert(formPayload)
      .select()
      .single();
    expect(createError).toBeNull();
    expect(Object.keys(created!).sort()).toEqual(PAYMENT_METHOD_COLUMNS);

    const { data: updated, error: updateError } = await client
      .from("payment_methods")
      .update({ ...formPayload, display_name: "Renamed Wallet", icon_name: "Wallet" })
      .eq("id", created!.id)
      .select()
      .single();
    expect(updateError).toBeNull();
    expect(updated).toMatchObject({ display_name: "Renamed Wallet", icon_name: "Wallet" });
  });
});
