import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockEnv, queryChain } from "./setup";

const DB_ERROR = {
  message: 'Booking creation failed: null value in column "guest_id" of relation "bookings"',
  code: "P0001",
  hint: "Check the guests table",
  details: "Failing row contains (secret)",
};

const supabaseStub = {
  from: (table: string) =>
    queryChain(
      table === "pricing_config"
        ? { data: { max_capacity_per_unit: 4 }, error: null }
        : { data: null, count: 5, error: null }
    ),
  rpc: async () => ({ data: null, error: DB_ERROR }),
};

describe("POST /api/guest-booking/multi-unit when the database rejects the booking", () => {
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
  });

  it("returns an error code and the booking reference, not the database error text", async () => {
    const { onRequestPost } = await import("../../../functions/api/guest-booking/multi-unit");
    vi.spyOn(console, "error").mockImplementation(() => {});

    const request = new Request("https://okaeri-resort.pages.dev/api/guest-booking/multi-unit", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.8" },
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

    const response = await onRequestPost({ request, env: mockEnv });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      success: false,
      error: "Your booking was not saved. Nothing was charged; please try again.",
      error_code: "DATABASE_ERROR",
      booking_reference: expect.stringMatching(/^BK-/),
    });
  });
});
