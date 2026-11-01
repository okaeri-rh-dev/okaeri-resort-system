import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockEnv, queryChain } from "../setup";

describe("POST /api/pricing/calculate when the price lookup fails", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@supabase/supabase-js", () => ({
      createClient: () => ({ from: () => queryChain({ data: null, error: null }) }),
    }));
    vi.doMock("../../../../functions/lib/pricing", () => ({
      calculateBookingPrice: async () => {
        throw new Error('permission denied for table "seasonal_rates"');
      },
    }));
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns only the error code and a fixed message", async () => {
    const { onRequest } = await import("../../../../functions/api/pricing/calculate");
    const request = new Request("https://okaeri-resort.pages.dev/api/pricing/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ check_in: "2099-01-10", check_out: "2099-01-12", guest_count: 2 }),
    });

    const response = await onRequest({ request: request as never, env: mockEnv });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "CALCULATION_ERROR",
      message: "Failed to calculate pricing",
    });
  });
});
