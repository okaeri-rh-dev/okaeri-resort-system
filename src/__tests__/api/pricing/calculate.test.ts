import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toStayInstants } from "@/lib/bookings/stay";

import { onRequest } from "../../../../functions/api/pricing/calculate";
import { calculateBookingPrice, fetchActiveSeasons } from "../../../../functions/lib/pricing";
import type { PricingCalculationResponse } from "../types/responses";

// Mock environment
const mockEnv = {
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-key",
  ENVIRONMENT: "production",
  RATE_LIMIT_KV: {
    get: vi.fn(),
    put: vi.fn(),
  } as any,
};

// Mock Supabase client
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "units") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              unit_id: "550e8400-e29b-41d4-a716-446655440001",
              unit_name: "Test Unit",
              base_rate: 3000,
              weekend_rate: 3500,
              extra_person_rate: 500,
              base_occupancy: 2,
            },
            error: null,
          }),
        };
      }
      if (table === "pricing_config") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "default",
              base_rate: 3000,
              weekend_rate: 3500,
              extra_person_rate: 500,
              base_occupancy: 2,
              downpayment_percent: 50,
              currency: "PHP",
            },
            error: null,
          }),
        };
      }
      if (table === "seasonal_rates") {
        // One season covering the whole year doubles every night
        const seasons = {
          data: [
            {
              name: "Christmas & New Year",
              start_date: "01-01",
              end_date: "12-31",
              multiplier: 2.0,
              priority: 20,
            },
          ],
          error: null,
        };
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (resolve: (value: unknown) => void) => resolve(seasons),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
  })),
}));

// The booking endpoint prices each cabin like this and stores the sum
const priceAsBookingEndpoint = async (
  checkInDay: string,
  checkOutDay: string,
  guestCount: number
) => {
  const stay = toStayInstants(checkInDay, checkOutDay);
  return calculateBookingPrice({
    checkIn: new Date(stay.check_in),
    checkOut: new Date(stay.check_out),
    guestCount,
    config: {
      base_rate: 3000,
      weekend_rate: 3500,
      extra_person_rate: 500,
      base_occupancy: 2,
      downpayment_percent: 50,
      currency: "PHP",
    },
    seasons: await fetchActiveSeasons(createClient("", "")),
  });
};

describe("Pricing Calculate API", () => {
  let mockRequest: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset rate limit mock
    mockEnv.RATE_LIMIT_KV.get.mockResolvedValue(null);
    mockEnv.RATE_LIMIT_KV.put.mockResolvedValue(undefined);

    // Reset cache mock
  });

  it("should reject non-POST methods", async () => {
    mockRequest = {
      method: "GET",
      headers: new Map(),
      json: vi.fn(),
    };

    const response = await onRequest({ request: mockRequest, env: mockEnv });
    const data = (await response.json()) as PricingCalculationResponse;

    expect(response.status).toBe(405);
    expect(data.error).toBe("METHOD_NOT_ALLOWED");
  });

  it("should validate request parameters", async () => {
    mockRequest = {
      method: "POST",
      headers: new Map(),
      json: vi.fn().mockResolvedValue({
        check_in: "2024-12-20",
        // Missing check_out
        guest_count: 4,
      }),
    };

    const response = await onRequest({ request: mockRequest, env: mockEnv });
    const data = (await response.json()) as PricingCalculationResponse;

    expect(response.status).toBe(400);
    expect(data.error).toBe("VALIDATION_ERROR");
    expect(data.errors).toBeDefined();
  });

  it("should reject unit pricing without a guest count", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 4);

    mockRequest = {
      method: "POST",
      headers: new Map(),
      json: vi.fn().mockResolvedValue({
        check_in: tomorrow.toISOString().split("T")[0],
        check_out: dayAfter.toISOString().split("T")[0],
        unit_id: "550e8400-e29b-41d4-a716-446655440001",
      }),
    };

    const response = await onRequest({ request: mockRequest, env: mockEnv });
    const data = (await response.json()) as PricingCalculationResponse;

    expect(response.status).toBe(400);
    expect(data.error).toBe("VALIDATION_ERROR");
  });

  it("should calculate pricing for a single unit", async () => {
    // Use future dates to pass validation
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 4);

    mockRequest = {
      method: "POST",
      headers: new Map(),
      json: vi.fn().mockResolvedValue({
        check_in: tomorrow.toISOString().split("T")[0],
        check_out: dayAfter.toISOString().split("T")[0],
        guest_count: 4,
        unit_id: "550e8400-e29b-41d4-a716-446655440001", // Valid UUID
      }),
    };

    const response = await onRequest({ request: mockRequest, env: mockEnv });
    const data = (await response.json()) as PricingCalculationResponse;

    if (response.status !== 200) {
      console.error("Response error:", data);
    }

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.pricing).toBeDefined();
    expect(data.pricing.total).toBe(23000); // 20000 subtotal + 3000 extra person (2 persons × 500 × 3 nights)
    expect(data.pricing.downpayment).toBe(11500); // 50% of 23000
    expect(data.notice).toContain("Seasonal rates applied");
  });

  it("should calculate pricing with custom parameters", async () => {
    mockRequest = {
      method: "POST",
      headers: new Map(),
      json: vi.fn().mockResolvedValue({
        // Thu, Fri and Sat nights
        check_in: "2099-01-08",
        check_out: "2099-01-11",
        guest_count: 2,
        custom_pricing: {
          base_rate: 2500,
          weekend_rate: 3000,
          extra_person_rate: 400,
          base_occupancy: 2,
        },
      }),
    };

    const response = await onRequest({ request: mockRequest, env: mockEnv });
    const data = (await response.json()) as PricingCalculationResponse;

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.pricing).toBeDefined();
    expect(data.pricing.total).toBe(17000); // (₱2,500 + ₱3,000 × 2) doubled, no extra persons
    expect(data.notice).toContain("Seasonal rates applied");
  });

  it("should handle rate limiting", async () => {
    mockEnv.RATE_LIMIT_KV.get.mockResolvedValue("10");

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 4);

    mockRequest = {
      method: "POST",
      headers: new Map([["cf-connecting-ip", "192.168.1.1"]]),
      json: vi.fn().mockResolvedValue({
        check_in: tomorrow.toISOString().split("T")[0],
        check_out: dayAfter.toISOString().split("T")[0],
        guest_count: 4,
        unit_id: "550e8400-e29b-41d4-a716-446655440001",
      }),
    };

    const response = await onRequest({ request: mockRequest, env: mockEnv });
    const data = (await response.json()) as PricingCalculationResponse;

    expect(response.status).toBe(429);
    expect(data.error).toBe("RATE_LIMIT_EXCEEDED");
  });

  it("should handle multi-unit pricing requests", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 4);

    mockRequest = {
      method: "POST",
      headers: new Map(),
      json: vi.fn().mockResolvedValue({
        check_in: tomorrow.toISOString().split("T")[0],
        check_out: dayAfter.toISOString().split("T")[0],
        unit_requests: [
          { unit_id: "550e8400-e29b-41d4-a716-446655440001", guest_count: 2 },
          { unit_id: "550e8400-e29b-41d4-a716-446655440002", guest_count: 4 },
        ],
      }),
    };

    const response = await onRequest({ request: mockRequest, env: mockEnv });
    const data = (await response.json()) as PricingCalculationResponse;

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.pricing.units).toHaveLength(2);
    expect(data.pricing.total).toBe(43000); // 20000 + 23000 (2 extra persons × 500 × 3 nights)
  });

  it("prices guest cabin requests one by one, as the booking endpoint stores them", async () => {
    mockRequest = {
      method: "POST",
      headers: new Map(),
      json: vi.fn().mockResolvedValue({
        // One weeknight (Tue), outside every season
        check_in: "2027-06-08",
        check_out: "2027-06-09",
        unit_requests: [{ guest_count: 2 }, { guest_count: 2 }],
      }),
    };

    const response = await onRequest({ request: mockRequest, env: mockEnv });
    const data = (await response.json()) as PricingCalculationResponse;

    const cabin = await priceAsBookingEndpoint("2027-06-08", "2027-06-09", 2);

    // The mock season doubles each night: 2 cabins × ₱3,000 × 2, not one 4-guest cabin (₱7,000)
    expect(data.pricing.total).toBe(12000);
    expect(data.pricing.total).toBe(2 * cabin.total);
    expect(data.pricing.downpayment).toBe(2 * cabin.downpayment);
  });

  it("prices a Fri–Sun stay as Manila nights, like the booking endpoint, west of UTC", async () => {
    vi.stubEnv("TZ", "America/Sao_Paulo");
    try {
      mockRequest = {
        method: "POST",
        headers: new Map(),
        json: vi.fn().mockResolvedValue({
          // Fri 2027-06-04 to Sun 2027-06-06
          check_in: "2027-06-04",
          check_out: "2027-06-06",
          guest_count: 2,
        }),
      };

      const response = await onRequest({ request: mockRequest, env: mockEnv });
      const data = (await response.json()) as PricingCalculationResponse;

      const booked = await priceAsBookingEndpoint("2027-06-04", "2027-06-06", 2);

      expect(data.pricing.nights).toBe(2);
      expect(data.pricing.nightlyBreakdown?.filter((night) => night.isWeekend)).toHaveLength(2);
      // Two weekend nights at ₱3,500, doubled by the mock season
      expect(data.pricing.total).toBe(14000);
      expect(data.pricing.total).toBe(booked.total);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("rejects a stay date that is not a YYYY-MM-DD day", async () => {
    mockRequest = {
      method: "POST",
      headers: new Map(),
      json: vi.fn().mockResolvedValue({
        check_in: "2027-06-04T00:00:00Z",
        check_out: "2027-06-06",
        guest_count: 2,
      }),
    };

    const response = await onRequest({ request: mockRequest, env: mockEnv });

    expect(response.status).toBe(400);
  });

  it("should validate date ranges", async () => {
    mockRequest = {
      method: "POST",
      headers: new Map(),
      json: vi.fn().mockResolvedValue({
        check_in: "2024-12-23",
        check_out: "2024-12-20", // Invalid: check-out before check-in
        guest_count: 4,
        unit_id: "550e8400-e29b-41d4-a716-446655440001",
      }),
    };

    const response = await onRequest({ request: mockRequest, env: mockEnv });
    const data = (await response.json()) as PricingCalculationResponse;

    expect(response.status).toBe(400);
    expect(data.error).toBe("VALIDATION_ERROR");
  });

  it("allows a signed-in caller past the guest limit", async () => {
    mockEnv.RATE_LIMIT_KV.get.mockResolvedValue("10");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 4);

    mockRequest = {
      method: "POST",
      headers: new Headers({
        Authorization: "Bearer test-token",
        "CF-Connecting-IP": "192.168.1.1",
      }),
      json: vi.fn().mockResolvedValue({
        check_in: tomorrow.toISOString().split("T")[0],
        check_out: dayAfter.toISOString().split("T")[0],
        guest_count: 4,
        unit_id: "550e8400-e29b-41d4-a716-446655440001",
      }),
    };

    const response = await onRequest({ request: mockRequest, env: mockEnv });

    expect(response.status).toBe(200);
  });

  it("keys the limit by client IP, never by the token", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 4);

    mockRequest = {
      method: "POST",
      headers: new Headers({
        Authorization: "Bearer test-token",
        "CF-Connecting-IP": "192.168.1.1",
      }),
      json: vi.fn().mockResolvedValue({
        check_in: tomorrow.toISOString().split("T")[0],
        check_out: dayAfter.toISOString().split("T")[0],
        guest_count: 4,
        unit_id: "550e8400-e29b-41d4-a716-446655440001",
      }),
    };

    await onRequest({ request: mockRequest, env: mockEnv });

    const [key] = mockEnv.RATE_LIMIT_KV.put.mock.calls[0];
    expect(key).toContain("pricing:192.168.1.1");
    expect(key).not.toContain("test-token");
  });
});
