import { beforeEach, describe, expect, it, vi } from "vitest";

import { onRequest } from "../../../../functions/api/pricing/calculate";

// Mock environment
const mockEnv = {
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-key",
  KV_RATE_LIMIT: {
    get: vi.fn(),
    put: vi.fn(),
  } as any,
  KV_PRICING_CACHE: {
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
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              season_id: "christmas_new_year",
              name: "Christmas & New Year",
              start_date: "12-20",
              end_date: "01-02",
              multiplier: 2.0,
              priority: 20,
              is_active: true,
            },
            error: null,
          }),
          then: vi.fn().mockResolvedValue({
            data: [
              {
                season_id: "christmas_new_year",
                name: "Christmas & New Year",
                start_date: "12-20",
                end_date: "01-02",
                multiplier: 2.0,
                priority: 20,
                is_active: true,
              },
              {
                season_id: "peak_summer",
                name: "Peak Summer Season",
                start_date: "03-01",
                end_date: "05-31",
                multiplier: 1.5,
                priority: 10,
                is_active: true,
              },
            ],
            error: null,
          }),
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

// Mock pricing-with-db utility
vi.mock("../../../utils/pricing-with-db", () => ({
  calculateBookingPrice: vi.fn(async (params) => {
    const nights = 3;
    const baseTotal = params.baseRate * nights;
    const extraPersonTotal =
      Math.max(0, params.guestCount - params.baseOccupancy) * params.extraPersonRate * nights;
    const total = baseTotal + extraPersonTotal;

    return {
      nights,
      nightlyBreakdown: [
        {
          date: "2024-12-20",
          isWeekend: true,
          baseRate: params.weekendRate,
          seasonalMultiplier: 2.0,
          finalRate: params.weekendRate * 2.0,
          seasonName: "Christmas & New Year",
        },
        {
          date: "2024-12-21",
          isWeekend: true,
          baseRate: params.weekendRate,
          seasonalMultiplier: 2.0,
          finalRate: params.weekendRate * 2.0,
          seasonName: "Christmas & New Year",
        },
        {
          date: "2024-12-22",
          isWeekend: false,
          baseRate: params.baseRate,
          seasonalMultiplier: 2.0,
          finalRate: params.baseRate * 2.0,
          seasonName: "Christmas & New Year",
        },
      ],
      subtotal: 20000,
      extraPersons: Math.max(0, params.guestCount - params.baseOccupancy),
      extraPersonTotal,
      total: 20000 + extraPersonTotal,
      downpayment: (20000 + extraPersonTotal) * 0.5,
      balance: (20000 + extraPersonTotal) * 0.5,
      currency: "PHP",
    };
  }),
}));

describe("Pricing Calculate API", () => {
  let mockRequest: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset rate limit mock
    mockEnv.KV_RATE_LIMIT.get.mockResolvedValue(null);
    mockEnv.KV_RATE_LIMIT.put.mockResolvedValue(undefined);

    // Reset cache mock
    mockEnv.KV_PRICING_CACHE.get.mockResolvedValue(null);
    mockEnv.KV_PRICING_CACHE.put.mockResolvedValue(undefined);
  });

  it("should handle CORS preflight requests", async () => {
    mockRequest = {
      method: "OPTIONS",
      headers: new Map(),
      json: vi.fn(),
    };

    const response = await onRequest({ request: mockRequest, env: mockEnv });

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
  });

  it("should reject non-POST methods", async () => {
    mockRequest = {
      method: "GET",
      headers: new Map(),
      json: vi.fn(),
    };

    const response = await onRequest({ request: mockRequest, env: mockEnv });
    const data = await response.json();

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
    const data = await response.json();

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
    const data = await response.json();

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
    const data = await response.json();

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
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.pricing).toBeDefined();
    expect(data.pricing.total).toBe(20000); // No extra persons
    expect(data.notice).toContain("Seasonal rates applied");
  });

  it("should handle rate limiting", async () => {
    // Mock rate limit exceeded
    mockEnv.KV_RATE_LIMIT.get.mockResolvedValue({
      count: 10,
      resetAt: Date.now() + 60000,
    });

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
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe("RATE_LIMIT_EXCEEDED");
  });

  it("should use cache when available", async () => {
    const cachedData = {
      pricing: {
        total: 15000,
        downpayment: 7500,
        nights: 3,
        currency: "PHP",
      },
      notice: "Cached seasonal rates",
      calculated_at: new Date().toISOString(),
    };

    mockEnv.KV_PRICING_CACHE.get.mockResolvedValue(cachedData);

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
        unit_id: "550e8400-e29b-41d4-a716-446655440001",
      }),
    };

    const response = await onRequest({ request: mockRequest, env: mockEnv });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.cached).toBe(true);
    expect(data.pricing.total).toBe(15000);
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
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.pricing.units).toHaveLength(2);
    expect(data.pricing.total).toBe(43000); // 20000 + 23000 (2 extra persons × 500 × 3 nights)
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
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("VALIDATION_ERROR");
  });

  it("should include auth token for higher rate limits", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 4);

    mockRequest = {
      method: "POST",
      headers: new Map([["Authorization", "Bearer test-token"]]),
      json: vi.fn().mockResolvedValue({
        check_in: tomorrow.toISOString().split("T")[0],
        check_out: dayAfter.toISOString().split("T")[0],
        guest_count: 4,
        unit_id: "550e8400-e29b-41d4-a716-446655440001",
      }),
    };

    const response = await onRequest({ request: mockRequest, env: mockEnv });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify higher rate limit was applied (60 instead of 10)
    expect(mockEnv.KV_RATE_LIMIT.put).toHaveBeenCalledWith(
      expect.stringContaining("rate_limit:pricing:test-token"),
      expect.any(String),
      expect.any(Object)
    );
  });
});
