// @vitest-environment node
import { addDays, format } from "date-fns";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getAvailabilityStatus } from "../../../functions/api/public/v1/availability";

describe("getAvailabilityStatus", () => {
  it.each([
    [0, "booked"],
    [1, "limited"],
    [2, "moderate"],
    [3, "full"],
  ] as const)("maps %i of 3 free cabins to %s", (count, status) => {
    expect(getAvailabilityStatus(count, 3)).toBe(status);
  });

  it("grades against the real cabin count, not a fixed 3", () => {
    expect(getAvailabilityStatus(3, 4)).toBe("moderate");
    expect(getAvailabilityStatus(4, 4)).toBe("full");
  });
});

describe("GET /api/public/v1/availability", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@supabase/supabase-js");
  });

  it("returns the cabin count from the database", async () => {
    const start = format(new Date(), "yyyy-MM-dd");
    const end = format(addDays(new Date(), 1), "yyyy-MM-dd");
    vi.resetModules();
    vi.doMock("@supabase/supabase-js", () => ({
      createClient: () => ({
        rpc: async () => ({
          data: [
            { date: start, available_count: 0, total_units: 5 },
            { date: end, available_count: 5, total_units: 5 },
          ],
          error: null,
        }),
      }),
    }));
    const { onRequest } = await import("../../../functions/api/public/v1/availability");

    const response = await onRequest({
      request: new Request(
        `https://api.example.com/api/public/v1/availability?start=${start}&end=${end}`
      ),
      env: { SUPABASE_URL: "http://localhost", SUPABASE_ANON_KEY: "anon" },
      waitUntil: () => undefined,
    });

    const body = (await response.json()) as {
      totalUnits: number;
      availability: { status: string }[];
    };
    expect(body.totalUnits).toBe(5);
    expect(body.availability.map((day) => day.status)).toEqual(["booked", "full"]);
  });
});
