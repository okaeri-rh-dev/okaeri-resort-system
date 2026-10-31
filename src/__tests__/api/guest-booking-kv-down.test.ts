import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockEnv } from "./setup";

// Every query chain ends in a result the handler accepts as "nothing found / all fine"
const queryChain = (result: unknown): unknown =>
  new Proxy(() => {}, {
    get: (_target, prop) =>
      prop === "then"
        ? (resolve: (value: unknown) => void) => resolve(result)
        : () => queryChain(result),
  });

const supabaseStub = {
  from: (table: string) =>
    queryChain(
      table === "pricing_config"
        ? { data: { max_capacity_per_unit: 4 }, error: null }
        : { data: null, count: 5, error: null }
    ),
  rpc: async () => ({
    data: { booking: { booking_id: "b-1", booking_reference: "OKR-TEST01" } },
    error: null,
  }),
};

describe("POST /api/guest-booking/multi-unit when KV is out of write quota", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@supabase/supabase-js", () => ({ createClient: () => supabaseStub }));
    vi.doMock("../../../functions/lib/pricing", () => ({
      calculateBookingPrice: async () => ({
        nights: 2,
        subtotal: 6000,
        nightlyBreakdown: [],
        extraPersonTotal: 0,
        total: 6000,
        downpayment: 3000,
        currency: "PHP",
      }),
    }));
    vi.mocked(globalThis.fetch).mockResolvedValue(
      Response.json({
        success: true,
        hostname: "okaeri-resort.pages.dev",
        action: "guest-booking-multi-unit",
      })
    );
  });

  it("still creates the booking", async () => {
    const { onRequestPost } = await import("../../../functions/api/guest-booking/multi-unit");
    vi.mocked(mockEnv.RATE_LIMIT_KV.put).mockRejectedValue(
      new Error("KV put() limit exceeded for the day.")
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const request = new Request("https://okaeri-resort.pages.dev/api/guest-booking/multi-unit", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.7" },
      body: JSON.stringify({
        guest_name: "Maria Santos",
        email: "maria@example.com",
        phone_number: "+639171234567",
        check_in: "2099-01-10",
        check_out: "2099-01-12",
        unit_requests: [{ guests_per_unit: 2 }],
        turnstile_token: "real-looking-token",
        terms_accepted: true,
      }),
    });

    const response = await onRequestPost({
      request,
      env: { ...mockEnv, ENVIRONMENT: "production" },
    });

    expect(response.status).toBe(201);
    expect(mockEnv.RATE_LIMIT_KV.put).toHaveBeenCalled();
  });
});
