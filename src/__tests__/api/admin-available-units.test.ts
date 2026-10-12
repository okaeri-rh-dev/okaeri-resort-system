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

type BookedRow = { unit_id: string; booking_status: string };
let bookedRows: BookedRow[] = [];
let overlapBounds: { lt?: [string, string]; gt?: [string, string] } = {};

// Overlapping booking_unit_availability rows; applies the status filter and records the bounds.
function availabilityQuery() {
  let rows = bookedRows;
  const query = {
    select: () => query,
    in: (column: string, values: string[]) => {
      rows = rows.filter((row) => values.includes(row[column as keyof BookedRow]));
      return query;
    },
    lt: (column: string, value: string) => {
      overlapBounds.lt = [column, value];
      return query;
    },
    gt: async (column: string, value: string) => {
      overlapBounds.gt = [column, value];
      return { data: rows.map(({ unit_id }) => ({ unit_id })), error: null };
    },
  };
  return query;
}

const fakeSupabase = {
  auth: { getUser: async () => ({ data: { user: { id: "staff-1" } }, error: null }) },
  from: (table: string) => {
    if (table === "units") return unitsQuery();
    if (table === "booking_unit_availability") return availabilityQuery();
    throw new Error(`unexpected table ${table}`);
  },
};

describe("GET /api/admin/available-units", () => {
  beforeEach(() => {
    bookedRows = [];
    overlapBounds = {};
    vi.resetModules();
    vi.doMock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => fakeSupabase) }));
    vi.doMock("../../../functions/lib/audit-logger-workers", () => ({
      logAuditEventWorker: vi.fn(async () => undefined),
    }));
  });

  async function getAvailableUnits(): Promise<Response> {
    const { onRequest } = await import("../../../functions/api/admin/available-units");
    const request = new Request(
      "https://api.example.com/api/admin/available-units?check_in_date=2026-12-20&check_out_date=2026-12-22",
      { headers: { Authorization: "Bearer test-token" } }
    );

    return onRequest({
      request: request as never,
      env: { SUPABASE_URL: "http://localhost", SUPABASE_SERVICE_ROLE_KEY: "key" },
    });
  }

  it("returns units mapped from the real units columns", async () => {
    const response = await getAvailableUnits();

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

  it.each(["Confirmed", "CheckedIn"])(
    "excludes a unit with an overlapping %s stay",
    async (status) => {
      bookedRows = [{ unit_id: "unit-1", booking_status: status }];

      const response = await getAvailableUnits();

      expect(response.status).toBe(200);
      const body = (await response.json()) as { units: unknown[] };
      expect(body.units).toEqual([]);
    }
  );

  it("keeps a unit whose overlapping booking is still Pending", async () => {
    bookedRows = [{ unit_id: "unit-1", booking_status: "Pending" }];

    const response = await getAvailableUnits();

    const body = (await response.json()) as { units: unknown[] };
    expect(body.units).toHaveLength(1);
  });

  it("compares against the stay at 14:00 / 12:00 Manila", async () => {
    await getAvailableUnits();

    expect(overlapBounds.lt).toEqual(["check_in", "2026-12-22T04:00:00.000Z"]);
    expect(overlapBounds.gt).toEqual(["check_out", "2026-12-20T06:00:00.000Z"]);
  });
});
