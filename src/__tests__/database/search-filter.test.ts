/**
 * List search: PostgREST accepts the `ilikeAnyFilter` string for searches with reserved characters.
 *
 * Requires a local Supabase (supabase start).
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ilikeAnyFilter } from "@/lib/search-filter";

import { testSupabaseAdmin as admin, shouldRunDatabaseTests } from "../setup/test-db";

const EXPENSE_SEARCH_COLUMNS = ["description", "category", "notes"];
const TEST_DESCRIPTION = 'dbtest-search food, drinks say "hi"';

let shouldRun = false;

describe("ilikeAnyFilter against PostgREST", () => {
  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) return;
    const { error } = await admin.from("expenses").insert({
      description: TEST_DESCRIPTION,
      category: "supplies",
      amount: 1,
      expense_date: "2026-01-01",
    });
    expect(error).toBeNull();
  }, 60000);

  afterAll(async () => {
    if (!shouldRun) return;
    await admin.from("expenses").delete().eq("description", TEST_DESCRIPTION);
  });

  it.each(["food, drinks", 'say "hi"', "dbtest-search"])(
    "finds the expense when searching %s",
    async (searchQuery) => {
      if (!shouldRun) return;
      const { data, error } = await admin
        .from("expenses")
        .select("description")
        .or(ilikeAnyFilter(EXPENSE_SEARCH_COLUMNS, searchQuery));

      expect(error).toBeNull();
      expect(data?.map((row) => row.description)).toContain(TEST_DESCRIPTION);
    }
  );

  it("returns no rows instead of an error for brackets, dots and a backslash", async () => {
    if (!shouldRun) return;
    const { data, error } = await admin
      .from("expenses")
      .select("description")
      .or(ilikeAnyFilter(EXPENSE_SEARCH_COLUMNS, "dbtest-search (a.b) \\ c"));

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
