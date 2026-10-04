/**
 * Regression: check_unit_availability had a 3-arg overload (reading the dropped
 * bookings.unit_id) beside a 4-arg one whose last parameter defaults to NULL, so
 * PostgREST could not choose (PGRST203) and every 3-arg call failed, on prod too.
 * Migration 20261004000000 drops the 3-arg overload.
 *
 * @vitest-environment node
 */

import { beforeAll, describe, expect, it } from "vitest";

import { shouldRunDatabaseTests, testSupabaseAdmin } from "../setup/test-db";

describe("check_unit_availability", () => {
  let shouldRun = false;

  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
  });

  it("answers a three-argument call", async () => {
    if (!shouldRun) return;

    const { data, error } = await testSupabaseAdmin.rpc("check_unit_availability", {
      p_unit_id: "00000000-0000-4000-8000-000000000000",
      p_check_in: "2030-01-01T06:00:00Z",
      p_check_out: "2030-01-02T04:00:00Z",
    });

    expect(error).toBeNull();
    expect(data).toBe(true);
  });
});
