import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PricingCalculateRequest, PricingCalculateResponse } from "@/types/api/pricing";

import {
  useCachedPricing,
  useClearPricingCache,
  usePricingCalculation,
} from "../usePricingCalculation";

// Mock dependencies
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: "test-token",
            user: { id: "test-user-id" },
          },
        },
        error: null,
      }),
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe("usePricingCalculation", () => {
  let queryClient: QueryClient;
  let wrapper: React.FC<{ children: React.ReactNode }>;

  const mockSuccessResponse: PricingCalculateResponse = {
    success: true,
    pricing: {
      nights: 3,
      subtotal: 9000,
      extraPersons: 0,
      extraPersonTotal: 0,
      total: 9000,
      downpayment: 4500,
      balance: 4500,
      currency: "PHP",
      nightlyBreakdown: [
        {
          date: "2024-12-20",
          isWeekend: true,
          baseRate: 3000,
          seasonalMultiplier: 1.0,
          finalRate: 3000,
          seasonName: null,
        },
        {
          date: "2024-12-21",
          isWeekend: true,
          baseRate: 3000,
          seasonalMultiplier: 1.0,
          finalRate: 3000,
          seasonName: null,
        },
        {
          date: "2024-12-22",
          isWeekend: false,
          baseRate: 3000,
          seasonalMultiplier: 1.0,
          finalRate: 3000,
          seasonName: null,
        },
      ],
    },
    notice: null,
    calculated_at: new Date().toISOString(),
  };

  const mockSeasonalResponse: PricingCalculateResponse = {
    success: true,
    pricing: {
      nights: 3,
      subtotal: 18000,
      extraPersons: 0,
      extraPersonTotal: 0,
      total: 18000,
      downpayment: 9000,
      balance: 9000,
      currency: "PHP",
      nightlyBreakdown: [
        {
          date: "2024-12-25",
          isWeekend: false,
          baseRate: 3000,
          seasonalMultiplier: 2.0,
          finalRate: 6000,
          seasonName: "Christmas & New Year",
        },
        {
          date: "2024-12-26",
          isWeekend: false,
          baseRate: 3000,
          seasonalMultiplier: 2.0,
          finalRate: 6000,
          seasonName: "Christmas & New Year",
        },
        {
          date: "2024-12-27",
          isWeekend: false,
          baseRate: 3000,
          seasonalMultiplier: 2.0,
          finalRate: 6000,
          seasonName: "Christmas & New Year",
        },
      ],
    },
    notice: "Seasonal rates applied (Christmas & New Year)",
    calculated_at: new Date().toISOString(),
  };

  const validRequest: PricingCalculateRequest = {
    check_in: "2024-12-20",
    check_out: "2024-12-23",
    guest_count: 2,
    unit_id: "550e8400-e29b-41d4-a716-446655440001",
  };

  beforeEach(() => {
    // Create fresh query client for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Create wrapper with QueryClientProvider
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // Reset mocks
    vi.clearAllMocks();

    // Setup default fetch mock
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSuccessResponse,
    } as Response);
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("Basic Functionality", () => {
    it("should successfully calculate pricing", async () => {
      const { result } = renderHook(() => usePricingCalculation(), { wrapper });

      result.current.mutate(validRequest);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockSuccessResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/pricing/calculate"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
          }),
          body: JSON.stringify(validRequest),
        })
      );
    });

    it("should include authorization header when session exists", async () => {
      const { result } = renderHook(() => usePricingCalculation(), { wrapper });

      result.current.mutate(validRequest);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );
    });

    it("should calculate pricing with seasonal rates", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSeasonalResponse,
      } as Response);

      const { result } = renderHook(() => usePricingCalculation(), { wrapper });

      result.current.mutate({
        ...validRequest,
        check_in: "2024-12-25",
        check_out: "2024-12-28",
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.notice).toBe("Seasonal rates applied (Christmas & New Year)");
      expect(result.current.data?.pricing.total).toBe(18000);
    });
  });

  describe("Custom Callbacks", () => {
    it("should call onSuccess callback with response data", async () => {
      const onSuccess = vi.fn();
      const { result } = renderHook(() => usePricingCalculation({ onSuccess }), { wrapper });

      result.current.mutate(validRequest);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(onSuccess).toHaveBeenCalledWith(mockSuccessResponse);
    });

    it("should call onError callback when request fails", async () => {
      const errorResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Invalid request",
        errors: {
          guest_count: ["Must be at least 1"],
        },
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => errorResponse,
      } as Response);

      const onError = vi.fn();
      const { result } = renderHook(() => usePricingCalculation({ onError }), { wrapper });

      result.current.mutate(validRequest);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "VALIDATION_ERROR",
          message: "Invalid request",
        })
      );
    });
  });

  describe("Toast Notifications", () => {
    it("should show success toast when showToasts is enabled", async () => {
      const { toast } = await import("sonner");
      const { result } = renderHook(() => usePricingCalculation({ showToasts: true }), { wrapper });

      result.current.mutate(validRequest);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(toast.success).toHaveBeenCalledWith(
        "Pricing calculated",
        expect.objectContaining({
          description: "Total: ₱9,000",
        })
      );
    });

    it("should show info toast for seasonal rates when showToasts is enabled", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSeasonalResponse,
      } as Response);

      const { toast } = await import("sonner");
      const { result } = renderHook(() => usePricingCalculation({ showToasts: true }), { wrapper });

      result.current.mutate(validRequest);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(toast.info).toHaveBeenCalledWith(
        "Seasonal rates applied (Christmas & New Year)",
        expect.objectContaining({
          description: "Total: ₱18,000",
        })
      );
    });

    it("should show error toast when request fails and showToasts is enabled", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: "VALIDATION_ERROR",
          message: "Invalid request",
        }),
      } as Response);

      const { toast } = await import("sonner");
      const { result } = renderHook(() => usePricingCalculation({ showToasts: true }), { wrapper });

      result.current.mutate(validRequest);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(toast.error).toHaveBeenCalled();
    });

    it("should not show toasts when showToasts is false", async () => {
      const { toast } = await import("sonner");
      const { result } = renderHook(() => usePricingCalculation({ showToasts: false }), {
        wrapper,
      });

      result.current.mutate(validRequest);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.info).not.toHaveBeenCalled();
    });
  });

  describe("Caching", () => {
    it("should cache successful response when cacheKey is provided", async () => {
      const cacheKey = "test-cache-key";
      const { result } = renderHook(() => usePricingCalculation({ cacheKey, useCache: true }), {
        wrapper,
      });

      result.current.mutate(validRequest);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Check cache was set
      const cachedData = queryClient.getQueryData<PricingCalculateResponse>([
        "pricing",
        "cache",
        cacheKey,
      ]);

      expect(cachedData).toEqual(mockSuccessResponse);
    });

    it("should return cached response if available and fresh", async () => {
      const cacheKey = "test-cache-key";

      // Pre-populate cache
      const cachedResponse = {
        ...mockSuccessResponse,
        cached: true,
        calculated_at: new Date().toISOString(),
      };
      queryClient.setQueryData(["pricing", "cache", cacheKey], cachedResponse);

      const { result } = renderHook(() => usePricingCalculation({ cacheKey, useCache: true }), {
        wrapper,
      });

      result.current.mutate(validRequest);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Should return cached data without calling fetch
      expect(result.current.data?.cached).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should fetch fresh data if cache is stale (> 5 minutes)", async () => {
      const cacheKey = "test-cache-key";

      // Pre-populate cache with stale data
      const staleTimestamp = new Date(Date.now() - 6 * 60 * 1000).toISOString(); // 6 minutes ago
      const staleResponse = {
        ...mockSuccessResponse,
        calculated_at: staleTimestamp,
      };
      queryClient.setQueryData(["pricing", "cache", cacheKey], staleResponse);

      const { result } = renderHook(() => usePricingCalculation({ cacheKey, useCache: true }), {
        wrapper,
      });

      result.current.mutate(validRequest);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Should call fetch for fresh data
      expect(mockFetch).toHaveBeenCalled();
      expect(result.current.data?.calculated_at).not.toBe(staleTimestamp);
    });

    it("should not use cache when useCache is false", async () => {
      const cacheKey = "test-cache-key";

      // Pre-populate cache
      queryClient.setQueryData(["pricing", "cache", cacheKey], mockSuccessResponse);

      const { result } = renderHook(() => usePricingCalculation({ cacheKey, useCache: false }), {
        wrapper,
      });

      result.current.mutate(validRequest);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Should always call fetch
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle validation errors", async () => {
      const errorResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Validation failed",
        errors: {
          guest_count: ["Must be at least 1"],
          check_in_date: ["Invalid date format"],
        },
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => errorResponse,
      } as Response);

      const { result } = renderHook(() => usePricingCalculation(), { wrapper });

      result.current.mutate(validRequest);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toMatchObject({
        error: "VALIDATION_ERROR",
        message: "Validation failed",
      });
    });

    it("should handle rate limit errors with custom message", async () => {
      const errorResponse = {
        success: false,
        error: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests",
        retry_after: 60,
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => errorResponse,
      } as Response);

      const { result } = renderHook(() => usePricingCalculation(), { wrapper });

      result.current.mutate(validRequest);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe(
        "Too many pricing requests. Please wait a moment and try again."
      );
    });

    it("should handle unit not found errors with custom message", async () => {
      const errorResponse = {
        success: false,
        error: "UNIT_NOT_FOUND",
        message: "Unit not found",
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => errorResponse,
      } as Response);

      const { result } = renderHook(() => usePricingCalculation(), { wrapper });

      result.current.mutate(validRequest);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe(
        "The selected unit could not be found. Please refresh and try again."
      );
    });

    it("should not retry on validation errors", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: "VALIDATION_ERROR",
          message: "Invalid request",
        }),
      } as Response);

      const { result } = renderHook(() => usePricingCalculation(), { wrapper });

      result.current.mutate(validRequest);

      await waitFor(() => expect(result.current.isError).toBe(true));

      // Should only call once (no retries)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should not retry on rate limit errors", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({
          success: false,
          error: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests",
        }),
      } as Response);

      const { result } = renderHook(() => usePricingCalculation(), { wrapper });

      result.current.mutate(validRequest);

      await waitFor(() => expect(result.current.isError).toBe(true));

      // Should only call once (no retries)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should retry up to 2 times for other errors", async () => {
      let callCount = 0;
      mockFetch.mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          return {
            ok: false,
            status: 500,
            json: async () => ({
              success: false,
              error: "INTERNAL_ERROR",
              message: "Server error",
            }),
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => mockSuccessResponse,
        } as Response;
      });

      const { result } = renderHook(() => usePricingCalculation(), { wrapper });

      result.current.mutate(validRequest);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Should call 3 times (initial + 2 retries)
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("Cache Management Hooks", () => {
    it("useCachedPricing should retrieve cached pricing", () => {
      const cacheKey = "test-cache-key";

      queryClient.setQueryData(["pricing", "cache", cacheKey], mockSuccessResponse);

      const { result } = renderHook(() => useCachedPricing(cacheKey), { wrapper });

      expect(result.current).toEqual(mockSuccessResponse);
    });

    it("useCachedPricing should return null for non-existent cache", () => {
      const { result } = renderHook(() => useCachedPricing("nonexistent-key"), { wrapper });

      expect(result.current).toBeNull();
    });

    it("useClearPricingCache should clear all pricing cache", () => {
      queryClient.setQueryData(["pricing", "cache", "key1"], mockSuccessResponse);
      queryClient.setQueryData(["pricing", "cache", "key2"], mockSeasonalResponse);

      const { result } = renderHook(() => useClearPricingCache(), { wrapper });

      result.current.clearAll();

      expect(queryClient.getQueryData(["pricing", "cache", "key1"])).toBeUndefined();
      expect(queryClient.getQueryData(["pricing", "cache", "key2"])).toBeUndefined();
    });

    it("useClearPricingCache should clear specific cache key", () => {
      queryClient.setQueryData(["pricing", "cache", "key1"], mockSuccessResponse);
      queryClient.setQueryData(["pricing", "cache", "key2"], mockSeasonalResponse);

      const { result } = renderHook(() => useClearPricingCache(), { wrapper });

      result.current.clearSpecific("key1");

      expect(queryClient.getQueryData(["pricing", "cache", "key1"])).toBeUndefined();
      expect(queryClient.getQueryData(["pricing", "cache", "key2"])).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle multi-unit pricing requests", async () => {
      const multiUnitRequest: PricingCalculateRequest = {
        check_in: "2024-12-20",
        check_out: "2024-12-23",
        guest_count: 5, // Total guests across all units
        unit_requests: [
          { unit_id: "550e8400-e29b-41d4-a716-446655440001", guest_count: 2 },
          { unit_id: "550e8400-e29b-41d4-a716-446655440002", guest_count: 3 },
        ],
      };

      const { result } = renderHook(() => usePricingCalculation(), { wrapper });

      result.current.mutate(multiUnitRequest);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          body: JSON.stringify(multiUnitRequest),
        })
      );
    });

    it("should handle custom pricing requests", async () => {
      const customPricingRequest: PricingCalculateRequest = {
        check_in: "2024-12-20",
        check_out: "2024-12-23",
        guest_count: 2,
        custom_pricing: {
          base_rate: 2500,
          weekend_rate: 3000,
          extra_person_rate: 400,
          base_occupancy: 2,
        },
      };

      const { result } = renderHook(() => usePricingCalculation(), { wrapper });

      result.current.mutate(customPricingRequest);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          body: JSON.stringify(customPricingRequest),
        })
      );
    });

    it("should handle network errors gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => usePricingCalculation(), { wrapper });

      result.current.mutate(validRequest);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });
  });
});
