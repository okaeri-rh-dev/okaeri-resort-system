/**
 * Regression: GET /api/admin/available-units ordered by and mapped from
 * columns that do not exist on `units` (unit_number, max_capacity,
 * base_price, floor_level, view_type). PostgREST rejects an unknown order
 * column, so the endpoint returned 500 and unit assignment could not load.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/types/database.types";

type UnitRow = Database["public"]["Tables"]["units"]["Row"];

const unitColumns: Array<keyof UnitRow> = [
  "amenities",
  "base_occupancy",
  "base_rate",
  "created_at",
  "extra_person_rate",
  "max_occupancy",
  "unit_code",
  "unit_id",
  "unit_name",
  "unit_status",
  "unit_type",
  "updated_at",
  "weekend_rate",
];

const cabin: UnitRow = {
  amenities: null,
  base_occupancy: 2,
  base_rate: 3500,
  created_at: null,
  extra_person_rate: 500,
  max_occupancy: 4,
  unit_code: "C1",
  unit_id: "unit-1",
  unit_name: "Cabin 1",
  unit_status: "Available",
  unit_type: "cabin",
  updated_at: null,
  weekend_rate: 4000,
};

function unitsQuery() {
  const query = {
    select: () => query,
    eq: () => query,
    order: async (column: string) =>
      unitColumns.includes(column as keyof UnitRow)
        ? { data: [cabin], error: null }
        : { data: null, error: { message: `column units.${column} does not exist` } },
  };
  return query;
}

function bookingUnitsQuery() {
  const query = {
    select: () => query,
    eq: () => query,
    lt: () => query,
    gt: async () => ({ data: [], error: null }),
  };
  return query;
}

const fakeSupabase = {
  auth: { getUser: async () => ({ data: { user: { id: "staff-1" } }, error: null }) },
  from: (table: string) => (table === "units" ? unitsQuery() : bookingUnitsQuery()),
};

describe("GET /api/admin/available-units", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => fakeSupabase) }));
    vi.doMock("../../../functions/lib/audit-logger-workers", () => ({
      logAuditEventWorker: vi.fn(async () => undefined),
    }));
  });

  it("returns units mapped from the real units columns", async () => {
    const { onRequest } = await import("../../../functions/api/admin/available-units");
    const request = new Request(
      "https://api.example.com/api/admin/available-units?check_in_date=2026-12-20&check_out_date=2026-12-22",
      { headers: { Authorization: "Bearer test-token" } }
    );

    const response = await onRequest({
      request: request as never,
      env: { SUPABASE_URL: "http://localhost", SUPABASE_SERVICE_ROLE_KEY: "key" },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { units: unknown[] };
    expect(body.units).toEqual([
      {
        unit_id: "unit-1",
        unit_number: "C1",
        unit_type: "cabin",
        max_capacity: 4,
        rate_per_night: 3500,
        floor_level: null,
        view_type: null,
      },
    ]);
  });
});
