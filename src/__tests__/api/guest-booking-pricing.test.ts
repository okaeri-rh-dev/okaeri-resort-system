import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockEnv, queryChain } from "./setup";

const CONFIG = {
  base_rate: 3000.08,
  weekend_rate: 3500,
  extra_person_rate: 500,
  base_occupancy: 2,
  max_capacity_per_unit: 4,
  downpayment_percent: 50,
  currency: "PHP",
};

let pricingConfigLoads = 0;
let seasonQueries = 0;
interface StoredBookingData {
  total_amount: number;
  downpayment_required: number;
  pricing_snapshot: { weekend_surcharge: number };
}
const rpc = vi.fn(async (_name: string, _args: { p_booking_data: StoredBookingData }) => ({
  data: { booking: { booking_id: "b-1", booking_reference: "BK-TEST" } },
  error: null,
}));

const supabaseStub = {
  from: (table: string) => {
    if (table === "pricing_config") {
      pricingConfigLoads++;
      // A second load fails, so a price that loads the config again gets no rates
      return queryChain(
        pricingConfigLoads === 1
          ? { data: CONFIG, error: null }
          : { data: null, error: { message: "timeout" } }
      );
    }
    if (table === "seasonal_rates") {
      seasonQueries++;
      return queryChain({ data: [], error: null });
    }
    return queryChain({ data: null, count: 5, error: null });
  },
  rpc,
};

const bookingRequest = (checkIn: string, checkOut: string) =>
  new Request("https://okaeri-resort.pages.dev/api/guest-booking/multi-unit", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.8" },
    body: JSON.stringify({
      guest_name: "Maria Santos",
      email: "maria@example.com",
      phone_number: "+639171234567",
      check_in: checkIn,
      check_out: checkOut,
      unit_requests: [{ guests_per_unit: 2 }, { guests_per_unit: 2 }, { guests_per_unit: 2 }],
      turnstile_token: "real-looking-token",
      terms_accepted: true,
    }),
  });

describe("POST /api/guest-booking/multi-unit pricing", () => {
  beforeEach(() => {
    vi.resetModules();
    pricingConfigLoads = 0;
    seasonQueries = 0;
    rpc.mockClear();
    vi.doMock("@supabase/supabase-js", () => ({ createClient: () => supabaseStub }));
  });

  it("stores rounded totals from the loaded config, with the weekend surcharge over the base rate", async () => {
    const { onRequestPost } = await import("../../../functions/api/guest-booking/multi-unit");

    // 2099-01-08 is a Thursday: one weeknight and one Friday night, for 3 cabins
    const response = await onRequestPost({
      request: bookingRequest("2099-01-08", "2099-01-10"),
      env: mockEnv,
    });

    expect(response.status).toBe(201);
    const bookingData = rpc.mock.calls[0][1].p_booking_data;
    expect(bookingData.total_amount).toBe(19500.24);
    expect(bookingData.downpayment_required).toBe(9750.12);
    expect(bookingData.pricing_snapshot.weekend_surcharge).toBe(1499.76);
    expect(seasonQueries).toBe(1);
  });

  it("fails without storing a booking when the config cannot be loaded", async () => {
    pricingConfigLoads = 1;
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { onRequestPost } = await import("../../../functions/api/guest-booking/multi-unit");

    const response = await onRequestPost({
      request: bookingRequest("2099-01-08", "2099-01-10"),
      env: mockEnv,
    });

    expect(response.status).toBe(500);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("accepts a stay of exactly 60 nights", async () => {
    const { onRequestPost } = await import("../../../functions/api/guest-booking/multi-unit");

    const response = await onRequestPost({
      request: bookingRequest("2099-01-01", "2099-03-02"),
      env: mockEnv,
    });

    expect(response.status).toBe(201);
  });

  it("rejects a stay over 60 nights", async () => {
    const { onRequestPost } = await import("../../../functions/api/guest-booking/multi-unit");

    const response = await onRequestPost({
      request: bookingRequest("2099-01-01", "2099-03-03"),
      env: mockEnv,
    });

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});
