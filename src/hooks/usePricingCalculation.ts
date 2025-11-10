// Import React for useEffect
import React from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import {
  isErrorResponse,
  isSuccessResponse,
  type PricingApiResponse,
  type PricingCalculateRequest,
  type PricingCalculateResponse,
  type PricingErrorResponse,
} from "@/types/api/pricing";

/**
 * Configuration for the pricing calculation hook
 */
export interface UsePricingCalculationOptions {
  /** Called when calculation succeeds */
  onSuccess?: (data: PricingCalculateResponse) => void;

  /** Called when calculation fails */
  onError?: (error: PricingErrorResponse) => void;

  /** Whether to show toast notifications */
  showToasts?: boolean;

  /** Cache the result with this key (for manual cache management) */
  cacheKey?: string;

  /** Whether to use cached results if available */
  useCache?: boolean;
}

/**
 * Custom hook for calculating booking pricing via API
 *
 * @example
 * ```tsx
 * const calculatePricing = usePricingCalculation({
 *   onSuccess: (data) => {
 *     setTotalAmount(data.pricing.total);
 *     setDownpayment(data.pricing.downpayment);
 *   },
 * });
 *
 * // Calculate pricing for a booking
 * await calculatePricing.mutateAsync({
 *   check_in_date: "2024-12-20",
 *   check_out_date: "2024-12-23",
 *   guest_count: 4,
 *   unit_id: "123e4567-e89b-12d3-a456-426614174000",
 * });
 * ```
 */
export function usePricingCalculation(options: UsePricingCalculationOptions = {}) {
  const queryClient = useQueryClient();

  const { onSuccess, onError, showToasts = false, cacheKey, useCache = true } = options;

  return useMutation<PricingCalculateResponse, PricingErrorResponse, PricingCalculateRequest>({
    mutationKey: ["pricing", "calculate"],

    mutationFn: async (request: PricingCalculateRequest) => {
      // Check cache first if enabled
      if (useCache && cacheKey) {
        const cached = queryClient.getQueryData<PricingCalculateResponse>([
          "pricing",
          "cache",
          cacheKey,
        ]);

        if (cached) {
          // Check if cache is still fresh (5 minutes)
          const cacheAge = new Date().getTime() - new Date(cached.calculated_at).getTime();
          if (cacheAge < 5 * 60 * 1000) {
            return { ...cached, cached: true };
          }
        }
      }

      // Determine API endpoint based on environment
      const apiUrl = import.meta.env.VITE_API_URL || "";
      const endpoint = `${apiUrl}/api/pricing/calculate`;

      // Get current session for authentication (optional for pricing endpoint)
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Build headers
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      // Add auth token if available (optional for this endpoint)
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      // Make API request
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      });

      const data = (await response.json()) as PricingApiResponse;

      // Handle error response
      if (!response.ok || isErrorResponse(data)) {
        const error = data as PricingErrorResponse;

        // Handle specific error types
        if (error.error === "RATE_LIMIT_EXCEEDED") {
          throw {
            ...error,
            message: "Too many pricing requests. Please wait a moment and try again.",
          };
        }

        if (error.error === "UNIT_NOT_FOUND") {
          throw {
            ...error,
            message: "The selected unit could not be found. Please refresh and try again.",
          };
        }

        throw error;
      }

      // Cache successful response if cache key provided
      if (useCache && cacheKey && isSuccessResponse(data)) {
        queryClient.setQueryData(["pricing", "cache", cacheKey], data, {
          // Cache for 5 minutes
          staleTime: 5 * 60 * 1000,
        });
      }

      return data as PricingCalculateResponse;
    },

    onSuccess: (data) => {
      // Call custom success handler
      onSuccess?.(data);

      // Show success toast if enabled
      if (showToasts) {
        if (data.notice) {
          toast.info(data.notice, {
            description: `Total: ₱${data.pricing.total.toLocaleString()}`,
          });
        } else {
          toast.success("Pricing calculated", {
            description: `Total: ₱${data.pricing.total.toLocaleString()}`,
          });
        }
      }

      // Log successful calculation
      console.log("Pricing calculated:", {
        total: data.pricing.total,
        downpayment: data.pricing.downpayment,
        nights: data.pricing.nights,
        notice: data.notice,
        cached: data.cached,
      });
    },

    onError: (error) => {
      // Call custom error handler
      onError?.(error);

      // Show error toast if enabled
      if (showToasts) {
        toast.error(error.message || "Failed to calculate pricing", {
          description: getErrorDescription(error),
        });
      }

      // Log error details
      console.error("Pricing calculation failed:", error);
    },

    retry: (failureCount, error) => {
      // Don't retry on validation or rate limit errors
      if (error.error === "VALIDATION_ERROR" || error.error === "RATE_LIMIT_EXCEEDED") {
        return false;
      }
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },

    retryDelay: (attemptIndex) => {
      // Exponential backoff: 1s, 2s
      return Math.min(1000 * 2 ** attemptIndex, 2000);
    },
  });
}

/**
 * Hook for calculating pricing with automatic updates
 * Useful for forms that need to recalculate on every change
 */
export function useAutoPricingCalculation(
  request: PricingCalculateRequest | null,
  options: UsePricingCalculationOptions = {}
) {
  const calculatePricing = usePricingCalculation(options);

  // Generate cache key from request parameters
  const cacheKey = request
    ? `${request.unit_id || "custom"}:${request.check_in_date}:${
        request.check_out_date
      }:${request.guest_count}`
    : undefined;

  // Auto-calculate when request changes
  React.useEffect(() => {
    if (request && isValidRequest(request)) {
      calculatePricing.mutate(request);
    }
  }, [request?.check_in_date, request?.check_out_date, request?.guest_count, request?.unit_id]);

  return {
    ...calculatePricing,
    cacheKey,
  };
}

/**
 * Helper function to validate pricing request
 */
function isValidRequest(request: PricingCalculateRequest): boolean {
  if (!request.check_in_date || !request.check_out_date) {
    return false;
  }

  const checkIn = new Date(request.check_in_date);
  const checkOut = new Date(request.check_out_date);

  if (checkOut <= checkIn) {
    return false;
  }

  if (request.guest_count < 1) {
    return false;
  }

  // Must have one of: unit_id, custom_pricing, or unit_requests
  if (!request.unit_id && !request.custom_pricing && !request.unit_requests) {
    return false;
  }

  return true;
}

/**
 * Helper function to get user-friendly error descriptions
 */
function getErrorDescription(error: PricingErrorResponse): string {
  switch (error.error) {
    case "VALIDATION_ERROR":
      if (error.errors) {
        const firstError = Object.values(error.errors).flat()[0];
        return firstError || "Please check your input and try again.";
      }
      return "Please check your input and try again.";

    case "RATE_LIMIT_EXCEEDED":
      return "You've made too many pricing requests. Please wait a moment.";

    case "UNIT_NOT_FOUND":
      return "The accommodation unit could not be found.";

    case "CALCULATION_ERROR":
      return "There was an issue calculating the pricing. Please try again.";

    default:
      return "An unexpected error occurred. Please try again.";
  }
}

/**
 * Helper hook to get cached pricing if available
 */
export function useCachedPricing(cacheKey?: string) {
  const queryClient = useQueryClient();

  if (!cacheKey) return null;

  return queryClient.getQueryData<PricingCalculateResponse>(["pricing", "cache", cacheKey]);
}

/**
 * Helper hook to clear pricing cache
 */
export function useClearPricingCache() {
  const queryClient = useQueryClient();

  return {
    clearAll: () => {
      queryClient.removeQueries({ queryKey: ["pricing", "cache"] });
    },
    clearSpecific: (cacheKey: string) => {
      queryClient.removeQueries({ queryKey: ["pricing", "cache", cacheKey] });
    },
  };
}

// Re-export types for convenience
export type {
  PricingCalculateRequest,
  PricingCalculateResponse,
  PricingErrorResponse,
  PricingResult,
  MultiUnitPricingResult,
  NightlyBreakdown,
} from "@/types/api/pricing";
