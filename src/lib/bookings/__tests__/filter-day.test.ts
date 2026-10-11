import { describe, expect, it } from "vitest";

import { filterDay } from "@/lib/bookings";

// src/lib/bookings/__tests__/filter-day.test.ts
process.env.TZ = "America/Los_Angeles";

describe("filterDay", () => {
  it("runs in a time zone far from Manila", () => {
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(480);
  });

  it("keeps a Manila day", () => {
    expect(filterDay("2026-10-15")).toBe("2026-10-15");
  });

  it("reads a legacy persisted ISO value as its Manila day", () => {
    expect(filterDay("2026-10-14T16:00:00.000Z")).toBe("2026-10-15");
  });
});
