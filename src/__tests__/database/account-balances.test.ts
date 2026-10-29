/**
 * get_all_account_balances must return the account fields the Accounts page
 * filters, sorts and edits on, for active and inactive accounts.
 *
 * @vitest-environment node
 */

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupTestData,
  createTestBooking,
  shouldRunDatabaseTests,
  testSupabaseAdmin as supabase,
} from "../setup/test-db";

const ANON_KEY =
  process.env.TEST_SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const SUPABASE_URL = process.env.TEST_SUPABASE_URL || "http://127.0.0.1:54321";

const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
const activeCode = `TA-${suffix}`;
const inactiveCode = `TI-${suffix}`;
const paymentsCode = `TP-${suffix}`;

describe("get_all_account_balances", () => {
  let shouldRun = false;
  let activeAccountId: string;
  let inactiveAccountId: string;
  let paymentsAccountId: string;

  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) return;

    const { data, error } = await supabase
      .from("accounts")
      .insert([
        {
          account_name: `Test Active ${suffix}`,
          account_code: activeCode,
          account_type: "Bank",
          description: "Payroll account",
          initial_balance: 1000,
          is_active: true,
          display_order: 7,
        },
        {
          account_name: `Test Inactive ${suffix}`,
          account_code: inactiveCode,
          account_type: "Cash",
          initial_balance: 250,
          is_active: false,
          display_order: 3,
        },
        {
          account_name: `Test Payments ${suffix}`,
          account_code: paymentsCode,
          account_type: "E-Wallet",
          initial_balance: 0,
        },
      ])
      .select("account_id, account_code");
    if (error) throw error;

    activeAccountId = data.find((row) => row.account_code === activeCode)!.account_id;
    inactiveAccountId = data.find((row) => row.account_code === inactiveCode)!.account_id;
    paymentsAccountId = data.find((row) => row.account_code === paymentsCode)!.account_id;

    const booking = await createTestBooking();
    const { error: paymentsError } = await supabase.from("payments").insert(
      [
        { amount: 300, status: "Active" },
        { amount: 200, status: "Deleted" },
        { amount: 100, status: "Refunded" },
      ].map((payment) => ({
        ...payment,
        booking_id: booking.booking_id,
        account_id: paymentsAccountId,
        payment_method: "Cash",
      }))
    );
    if (paymentsError) throw paymentsError;
  });

  afterAll(async () => {
    if (!shouldRun) return;
    await cleanupTestData({ includeTestFixtures: true });
    await supabase
      .from("accounts")
      .delete()
      .in("account_code", [activeCode, inactiveCode, paymentsCode]);
  });

  it("returns is_active, display_order and description for each account", async () => {
    if (!shouldRun) return;

    const { data, error } = await supabase.rpc("get_all_account_balances", {});
    expect(error).toBeNull();

    const active = data!.find((row) => row.account_id === activeAccountId);
    expect(active).toMatchObject({
      is_active: true,
      display_order: 7,
      description: "Payroll account",
      current_balance: 1000,
    });
    for (const row of data!) {
      expect(typeof row.is_active).toBe("boolean");
      expect(typeof row.display_order).toBe("number");
    }
  });

  it("includes inactive accounts so the page can show them on request", async () => {
    if (!shouldRun) return;

    const { data } = await supabase.rpc("get_all_account_balances", {});
    const inactive = data!.find((row) => row.account_id === inactiveAccountId);

    expect(inactive).toMatchObject({ is_active: false, display_order: 3, current_balance: 250 });
  });

  it("keeps get_account_balance working on top of it", async () => {
    if (!shouldRun) return;

    const { data, error } = await supabase.rpc("get_account_balance", {
      p_account_id: activeAccountId,
    });

    expect(error).toBeNull();
    expect(data).toBe(1000);
  });

  it("counts only active payments, not deleted or refunded ones", async () => {
    if (!shouldRun) return;

    const { data } = await supabase.rpc("get_all_account_balances", {});
    const account = data!.find((row) => row.account_id === paymentsAccountId);

    expect(account).toMatchObject({ total_payments: 300, current_balance: 300 });
  });

  it("cannot be called by an anonymous caller", async () => {
    if (!shouldRun) return;
    const anon = createClient(SUPABASE_URL, ANON_KEY);

    const { error } = await anon.rpc("get_all_account_balances", {});

    expect(error).not.toBeNull();
  });
});
