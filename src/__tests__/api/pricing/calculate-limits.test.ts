import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockEnv, queryChain } from "../setup";

let pricingConfigResult: unknown;

const quoteRequest = (body: object) =>
  new Request("https://okaeri-resort.pages.dev/api/pricing/calculate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/pricing/calculate limits", () => {
  beforeEach(() => {
    vi.resetModules();
    pricingConfigResult = { data: null, error: { message: "timeout" } };
    vi.doMock("@supabase/supabase-js", () => ({
      createClient: () => ({
        from: (table: string) =>
          queryChain(table === "pricing_config" ? pricingConfigResult : { data: [], error: null }),
      }),
    }));
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("fails instead of pricing with default rates when the config cannot be loaded", async () => {
    const { onRequest } = await import("../../../../functions/api/pricing/calculate");

    const response = await onRequest({
      request: quoteRequest({
        check_in: "2099-01-08",
        check_out: "2099-01-09",
        guest_count: 2,
      }) as never,
      env: mockEnv,
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: "CALCULATION_ERROR" });
  });

  it("rejects a stay over 60 nights", async () => {
    pricingConfigResult = {
      data: {
        base_rate: 3000,
        weekend_rate: 3500,
        extra_person_rate: 500,
        base_occupancy: 2,
        downpayment_percent: 50,
        currency: "PHP",
      },
      error: null,
    };
    const { onRequest } = await import("../../../../functions/api/pricing/calculate");

    const response = await onRequest({
      request: quoteRequest({
        check_in: "2099-01-01",
        check_out: "2099-03-03",
        guest_count: 2,
      }) as never,
      env: mockEnv,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "VALIDATION_ERROR" });
  });
});
