/**
 * Shared document numbers and the shared letterhead: allocation, yearly counts and RLS per role.
 *
 * Requires a local Supabase (supabase start).
 *
 * @vitest-environment node
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createRoleClients, type RoleClients } from "../setup/role-clients";
import { testSupabaseAdmin as admin, shouldRunDatabaseTests } from "../setup/test-db";

const MANAGER_PLUS = ["manager", "owner", "admin"] as const;
const FUTURE_YEAR = 2099;

const manilaYear = () =>
  new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", year: "numeric" }).format(new Date());

const LETTERHEAD = {
  resort_name: "Test Resort",
  address_line_1: "1 Test St.",
  city: "San Juan",
  province: "La Union",
  zip_code: "2514",
  phone: "+63 917 000 0001",
  email: "test@example.com",
};

let shouldRun = false;
let roles: RoleClients;

describe("document numbers and letterhead", () => {
  beforeAll(async () => {
    // The global setup fixes the clock in 2025; the database counts in the real Manila year.
    vi.useRealTimers();
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) return;
    roles = await createRoleClients("document-numbers");
  }, 60000);

  afterEach(async () => {
    if (!shouldRun) return;
    await admin.from("document_number_sequences").delete().neq("year", 0);
    await admin.from("letterhead").delete().eq("id", true);
  });

  afterAll(async () => {
    if (!shouldRun) return;
    await roles.cleanup();
  });

  it("starts each type at 0001 in the current Manila year", async () => {
    if (!shouldRun) return;
    const manager = roles.byRole.manager;
    const year = manilaYear();

    const { data: quotation } = await manager.rpc("allocate_document_number", {
      p_document_type: "quotation",
    });
    const { data: invoice } = await manager.rpc("allocate_document_number", {
      p_document_type: "invoice",
    });

    expect(quotation).toBe(`QUO-${year}-0001`);
    expect(invoice).toBe(`INV-${year}-0001`);
  });

  it("counts quotations and invoices independently", async () => {
    if (!shouldRun) return;
    const manager = roles.byRole.manager;
    const year = manilaYear();

    await manager.rpc("allocate_document_number", { p_document_type: "quotation" });
    await manager.rpc("allocate_document_number", { p_document_type: "quotation" });
    const { data: invoice } = await manager.rpc("allocate_document_number", {
      p_document_type: "invoice",
    });
    const { data: quotation } = await manager.rpc("allocate_document_number", {
      p_document_type: "quotation",
    });

    expect(invoice).toBe(`INV-${year}-0001`);
    expect(quotation).toBe(`QUO-${year}-0003`);
  });

  it("starts a new year at 0001", async () => {
    if (!shouldRun) return;
    await admin.rpc("next_document_number", {
      p_document_type: "invoice",
      p_year: FUTURE_YEAR - 1,
    });
    await admin.rpc("next_document_number", {
      p_document_type: "invoice",
      p_year: FUTURE_YEAR - 1,
    });

    const { data } = await admin.rpc("next_document_number", {
      p_document_type: "invoice",
      p_year: FUTURE_YEAR,
    });

    expect(data).toBe(`INV-${FUTURE_YEAR}-0001`);
  });

  it("gives distinct numbers to concurrent allocations", async () => {
    if (!shouldRun) return;
    const clients = MANAGER_PLUS.map((role) => roles.byRole[role]);

    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        clients[i % clients.length].rpc("allocate_document_number", {
          p_document_type: "quotation",
        })
      )
    );

    expect(results.map((result) => result.error)).toEqual(Array(12).fill(null));
    expect(new Set(results.map((result) => result.data)).size).toBe(12);
  });

  it.each(["staff", "anon"] as const)("%s cannot take a number", async (role) => {
    if (!shouldRun) return;
    const client = role === "anon" ? roles.anon : roles.byRole.staff;

    const { data, error } = await client.rpc("allocate_document_number", {
      p_document_type: "quotation",
    });

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it.each(["staff", "anon", "manager"] as const)(
    "%s cannot call the year-taking function",
    async (role) => {
      if (!shouldRun) return;
      const client = role === "anon" ? roles.anon : roles.byRole[role];

      const { error } = await client.rpc("next_document_number", {
        p_document_type: "quotation",
        p_year: FUTURE_YEAR,
      });

      expect(error).not.toBeNull();
    }
  );

  it.each(MANAGER_PLUS)("%s saves and reads the letterhead", async (role) => {
    if (!shouldRun) return;
    const client = roles.byRole[role];

    const { error } = await client.from("letterhead").upsert(LETTERHEAD);
    const { data } = await client.from("letterhead").select().maybeSingle();

    expect(error).toBeNull();
    expect(data).toMatchObject({ ...LETTERHEAD, tagline: "", logo_base64: "" });
  });

  it.each(["staff", "anon"] as const)("%s cannot read or edit the letterhead", async (role) => {
    if (!shouldRun) return;
    const client = role === "anon" ? roles.anon : roles.byRole.staff;
    await admin.from("letterhead").insert(LETTERHEAD);

    const { data: read } = await client.from("letterhead").select();
    const { error: upsertError } = await client
      .from("letterhead")
      .upsert({ ...LETTERHEAD, resort_name: "Hijacked" });
    const { data: row } = await admin.from("letterhead").select("resort_name").single();

    expect(read ?? []).toEqual([]);
    expect(upsertError).not.toBeNull();
    expect(row?.resort_name).toBe(LETTERHEAD.resort_name);
  });

  it("keeps one letterhead row", async () => {
    if (!shouldRun) return;
    const { error } = await admin.from("letterhead").insert({ ...LETTERHEAD, id: false });

    expect(error).not.toBeNull();
  });
});
