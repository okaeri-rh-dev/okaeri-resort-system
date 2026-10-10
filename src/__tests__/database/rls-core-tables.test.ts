/**
 * RLS role-based access tests for the core operational tables.
 *
 * Validates migration 20260725000000_rls_role_based_core_tables.sql: the coarse
 * "any authenticated user = full CRUD" policies are replaced with role-based
 * ones sourced from app_roles. Signs in as one user per role and asserts the
 * allowed/denied CRUD matrix per table.
 *
 * Requires a local Supabase (supabase start). Runs in the DB suite / infra-health.
 *
 * @vitest-environment node
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  testSupabaseAdmin as admin,
  cleanupTestData,
  createTestBooking,
  createTestGuest,
  createTestUnit,
  shouldRunDatabaseTests,
} from "../setup/test-db";

const URL = process.env.TEST_SUPABASE_URL || "http://127.0.0.1:54321";
const ANON = process.env.TEST_SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

type Role = "user" | "staff" | "manager" | "owner" | "admin";
const ROLES_WITH_APP_ROLE: Role[] = ["staff", "manager", "owner", "admin"];
const ALL: Role[] = ["user", ...ROLES_WITH_APP_ROLE];

const STAFF_PLUS: Role[] = ["staff", "manager", "owner", "admin"];
const MANAGER_PLUS: Role[] = ["manager", "owner", "admin"];
const OWNER_PLUS: Role[] = ["owner", "admin"];

// Expected allowed-role sets per table + operation (the proposed matrix).
const MATRIX: Record<string, Record<"select" | "insert" | "update" | "delete", Role[]>> = {
  // Levels reflect actual per-operation reachability (see migration header):
  // staff can create/update bookings, delete via the create-error rollback, and
  // upload payment proofs (payments INSERT). Payment edit/verify/delete and
  // guest edit/delete are gated to their manager+ pages.
  bookings: { select: STAFF_PLUS, insert: STAFF_PLUS, update: STAFF_PLUS, delete: STAFF_PLUS },
  guests: { select: STAFF_PLUS, insert: STAFF_PLUS, update: MANAGER_PLUS, delete: MANAGER_PLUS },
  payments: {
    select: STAFF_PLUS,
    insert: STAFF_PLUS,
    update: MANAGER_PLUS,
    delete: MANAGER_PLUS,
  },
  units: { select: STAFF_PLUS, insert: OWNER_PLUS, update: OWNER_PLUS, delete: OWNER_PLUS },
  expenses: { select: OWNER_PLUS, insert: OWNER_PLUS, update: OWNER_PLUS, delete: OWNER_PLUS },
  maintenance_logs: {
    select: STAFF_PLUS,
    insert: STAFF_PLUS,
    update: STAFF_PLUS,
    delete: MANAGER_PLUS,
  },
};

const clients: Partial<Record<Role, SupabaseClient>> = {};
const userIds: Partial<Record<Role, string>> = {};
const seeded: Record<string, { pk: string; id: string }> = {};

let shouldRun = false;

async function makeUser(role: Role) {
  const email = `rls-${role}-${Date.now()}@example.com`;
  const password = "Test-Password-123!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser(${role}) failed: ${error?.message}`);
  userIds[role] = data.user.id;

  if (ROLES_WITH_APP_ROLE.includes(role)) {
    const { error: rErr } = await admin
      .from("app_roles")
      .insert({
        user_id: data.user.id,
        email,
        role: role as Exclude<Role, "user">,
        is_active: true,
      });
    if (rErr) throw new Error(`app_roles insert(${role}) failed: ${rErr.message}`);
  }

  const c = createClient(URL, ANON);
  const { error: sErr } = await c.auth.signInWithPassword({ email, password });
  if (sErr) throw new Error(`signIn(${role}) failed: ${sErr.message}`);
  clients[role] = c;
}

describe("RLS role-based access on core tables", () => {
  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) return;

    await cleanupTestData({ includeTestFixtures: true });
    for (const role of ALL) await makeUser(role);

    // Seed one row per table via the admin (service-role) client, which bypasses RLS.
    const unit = await createTestUnit({});
    const guest = await createTestGuest({});
    const booking = await createTestBooking({
      unit,
      guest,
      booking_reference: `RLS${Date.now() % 1000000}`,
      payment_status: "Pending",
      unit_price: 5000,
      subtotal: 5000,
    });
    seeded.units = { pk: "unit_id", id: unit.unit_id };
    seeded.guests = { pk: "guest_id", id: guest.guest_id };
    seeded.bookings = { pk: "booking_id", id: booking.booking_id };

    const { data: pay } = await admin
      .from("payments")
      .insert({ booking_id: booking.booking_id, amount: 1000, payment_method: "Cash" })
      .select("payment_id")
      .single();
    if (pay) seeded.payments = { pk: "payment_id", id: pay.payment_id };

    const { data: exp } = await admin
      .from("expenses")
      .insert({
        amount: 500,
        category: "Utilities",
        description: "RLS seed",
        expense_date: "2026-01-15",
      })
      .select("expense_id")
      .single();
    if (exp) seeded.expenses = { pk: "expense_id", id: exp.expense_id };

    const { data: ml } = await admin
      .from("maintenance_logs")
      .insert({ unit_id: unit.unit_id, issue_description: "RLS seed" })
      .select("log_id")
      .single();
    if (ml) seeded.maintenance_logs = { pk: "log_id", id: ml.log_id };
  }, 60000);

  afterAll(async () => {
    if (!shouldRun) return;
    const ids = Object.values(userIds).filter(Boolean);
    if (ids.length) await admin.from("app_roles").delete().in("user_id", ids);
    for (const id of ids) await admin.auth.admin.deleteUser(id).catch(() => {});
    // Remove the RLS seed rows cleanupTestData does not pattern-match.
    await admin.from("expenses").delete().eq("description", "RLS seed");
    await admin.from("maintenance_logs").delete().eq("issue_description", "RLS seed");
    await admin.from("maintenance_logs").delete().eq("issue_description", "RLD");
    await cleanupTestData({ includeTestFixtures: true });
  });

  for (const table of Object.keys(MATRIX)) {
    describe(table, () => {
      it("SELECT visibility matches the matrix", async () => {
        if (!shouldRun) return;
        for (const role of ALL) {
          const { data } = await clients[role]!.from(table).select("*").limit(5);
          const canRead = (data?.length ?? 0) > 0;
          expect(
            canRead,
            `${role} SELECT ${table} expected ${MATRIX[table].select.includes(role)}`
          ).toBe(MATRIX[table].select.includes(role));
        }
      });

      it("INSERT permission matches the matrix", async () => {
        if (!shouldRun) return;
        for (const role of ALL) {
          // Minimal row: we only care whether RLS blocked it (code 42501), not
          // whether the row is otherwise valid.
          const { error } = await clients[role]!.from(table).insert(insertRow(table));
          const rlsAllowed = error?.code !== "42501";
          expect(
            rlsAllowed,
            `${role} INSERT ${table} expected ${MATRIX[table].insert.includes(role)} (err=${error?.code})`
          ).toBe(MATRIX[table].insert.includes(role));
        }
      });

      it("UPDATE permission matches the matrix", async () => {
        if (!shouldRun) return;
        const { pk, id } = seeded[table];
        for (const role of ALL) {
          // RLS denies UPDATE by filtering the row out (0 rows affected), not by
          // erroring — so a returned row means the update was permitted.
          const { data } = await clients[role]!.from(table)
            .update(updatePatch(table))
            .eq(pk, id)
            .select();
          const updated = (data?.length ?? 0) > 0;
          expect(
            updated,
            `${role} UPDATE ${table} expected ${MATRIX[table].update.includes(role)}`
          ).toBe(MATRIX[table].update.includes(role));
        }
      });

      it("DELETE permission matches the matrix", async () => {
        if (!shouldRun) return;
        const pk = seeded[table].pk;
        for (const role of ALL) {
          // Fresh throwaway row per attempt (admin bypasses RLS to create it).
          const id = await createThrowaway(table);
          const { data } = await clients[role]!.from(table).delete().eq(pk, id).select();
          const deleted = (data?.length ?? 0) > 0;
          expect(
            deleted,
            `${role} DELETE ${table} expected ${MATRIX[table].delete.includes(role)}`
          ).toBe(MATRIX[table].delete.includes(role));
          // Clean up rows a denied role left behind.
          if (!deleted)
            await admin
              .from(table as never)
              .delete()
              .eq(pk, id);
        }
      });
    });
  }
});

// Create a valid throwaway row via the admin (service-role) client, which
// bypasses RLS, and return its primary-key value. Used for DELETE tests.
let refSeq = 0;
async function createThrowaway(table: string): Promise<string> {
  // Unique identifiers per call — the createTest* helpers default to Date.now(),
  // which collides when called rapidly in a loop. Names match cleanupTestData's
  // fixture patterns ("test...@example.com", "Test Unit...") so they get removed.
  const tag = () => `${refSeq++}${Date.now() % 100000}`;
  const freshGuest = () => {
    const t = tag();
    return createTestGuest({
      email: `test-rls-${t}@example.com`,
      guest_name: `Test Guest RLS ${t}`,
    });
  };
  const freshUnit = () => {
    const t = tag();
    return createTestUnit({ unit_code: `TR${t}`.slice(0, 10), unit_name: `Test Unit RLS ${t}` });
  };
  const booking = async () =>
    createTestBooking({
      guest: await freshGuest(),
      unit: await freshUnit(),
      booking_reference: `RL${tag()}`.slice(0, 20),
      payment_status: "Pending",
      unit_price: 5000,
      subtotal: 5000,
    });
  switch (table) {
    case "bookings":
      return (await booking()).booking_id;
    case "guests":
      return (await freshGuest()).guest_id;
    case "units":
      return (await freshUnit()).unit_id;
    case "payments": {
      const b = await booking();
      const { data } = await admin
        .from("payments")
        .insert({ booking_id: b.booking_id, amount: 10, payment_method: "Cash" })
        .select("payment_id")
        .single();
      return data!.payment_id;
    }
    case "expenses": {
      const { data } = await admin
        .from("expenses")
        .insert({
          amount: 10,
          category: "Utilities",
          description: "RLD",
          expense_date: "2026-01-15",
        })
        .select("expense_id")
        .single();
      return data!.expense_id;
    }
    case "maintenance_logs": {
      const { data } = await admin
        .from("maintenance_logs")
        .insert({ issue_description: "RLD" })
        .select("log_id")
        .single();
      return data!.log_id;
    }
    default:
      throw new Error(`no throwaway factory for ${table}`);
  }
}

// Benign, real-column patches for UPDATE tests (applied to the seeded row).
function updatePatch(table: string): Record<string, unknown> {
  switch (table) {
    case "bookings":
      return { num_guests: 2 };
    case "guests":
      return { guest_name: "RLS upd" };
    case "payments":
      return { notes: "RLS upd" };
    case "units":
      return { unit_status: "Available" };
    case "expenses":
      return { notes: "RLS upd" };
    case "maintenance_logs":
      return { notes: "RLS upd" };
    default:
      return {};
  }
}

// Minimal insert payloads — deliberately partial. RLS WITH CHECK is evaluated
// regardless of other column validity, so a denied role yields 42501 while an
// allowed role yields success or a non-RLS error (both mean RLS permitted).
function insertRow(table: string): Record<string, unknown> {
  switch (table) {
    case "bookings":
      // Keep booking_reference <= 20 chars so a denied role hits RLS (42501),
      // not string truncation (22001), before the policy is evaluated.
      return {
        booking_reference: `RLS${Date.now() % 1000000}`,
        guest_name: "RLS",
        email: "rls@example.com",
      };
    case "guests":
      return { guest_name: "RLS", email: `rls-${Date.now()}@example.com` };
    case "payments":
      return { amount: 1, payment_method: "Cash" };
    case "units":
      return { unit_name: `RLS-${Date.now()}`, unit_code: `R${Date.now() % 100000}` };
    case "expenses":
      return { amount: 1, category: "Utilities", description: "RLS", expense_date: "2026-01-15" };
    case "maintenance_logs":
      return { issue_description: "RLS" };
    default:
      return {};
  }
}
