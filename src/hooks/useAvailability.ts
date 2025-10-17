/**
 * React Hooks for High-Performance Availability Checking
 * Optimized for Neon PostgreSQL Serverless Environment
 *
 * Features:
 * - Reactive availability checking with caching
 * - Real-time availability updates
 * - Optimistic updates for better UX
 * - Error handling and retry logic
 * - Integration with existing React Query patterns
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  checkUnitAvailability,
  checkMultiUnitAvailability,
  // getUnitAvailabilityCalendar, // ❌ DISABLED: Function not deployed
  batchCheckUnitAvailability,
  getAvailableUnitsByType,
  createBlackoutPeriod,
  getUnitBlackoutPeriods,
  // refreshAvailabilityCache, // ❌ DISABLED: Function not deployed
  // getCachePerformanceMetrics, // ❌ DISABLED: Function not deployed
  validateDateRange,
  formatAvailabilityMessage,
} from "@/lib/availability";
import type {
  AvailabilityResult,
  // UnitAvailability, // Phase 3 - Not used yet
  // AvailabilityCalendarDay, // Phase 3 - Not used yet
  AvailabilityFilter,
  BlackoutPeriod,
} from "@/lib/availability";

// ============================================
// SINGLE UNIT AVAILABILITY HOOKS
// ============================================

/**
 * Hook for checking single unit availability with caching
 */
export function useUnitAvailability(
  unitId: string,
  checkIn: string,
  checkOut: string,
  excludeBookingId?: string,
  options: { enabled?: boolean; refetchInterval?: number } = {}
) {
  const { enabled = true, refetchInterval = 30000 } = options;

  const dateValidation = useMemo(() => {
    if (!checkIn || !checkOut) return { isValid: false };
    return validateDateRange(checkIn, checkOut);
  }, [checkIn, checkOut]);

  return useQuery({
    queryKey: ["unit-availability", unitId, checkIn, checkOut, excludeBookingId],
    queryFn: () => checkUnitAvailability(unitId, checkIn, checkOut, excludeBookingId),
    enabled: enabled && dateValidation.isValid && !!unitId,
    staleTime: 60000, // 1 minute
    refetchInterval,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook for availability calendar view
 * ❌ TEMPORARILY DISABLED: Requires get_unit_availability_calendar() database function
 * TODO: Deploy availability calendar migration or remove if not needed
 */
/*
export function useAvailabilityCalendar(
  unitId: string,
  startDate: string,
  endDate: string,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: ["availability-calendar", unitId, startDate, endDate],
    queryFn: () => getUnitAvailabilityCalendar(unitId, startDate, endDate),
    enabled: enabled && !!unitId && !!startDate && !!endDate,
    staleTime: 300000, // 5 minutes
    retry: 1,
  });
}
*/

// ============================================
// MULTI-UNIT AVAILABILITY HOOKS
// ============================================

/**
 * Hook for searching available units with filters
 */
export function useAvailableUnits(
  checkIn: string,
  checkOut: string,
  filters: AvailabilityFilter = {},
  options: { enabled?: boolean; limit?: number } = {}
) {
  const { enabled = true, limit = 50 } = options;

  const dateValidation = useMemo(() => {
    if (!checkIn || !checkOut) return { isValid: false };
    return validateDateRange(checkIn, checkOut);
  }, [checkIn, checkOut]);

  return useQuery({
    queryKey: ["available-units", checkIn, checkOut, filters, limit],
    queryFn: () => checkMultiUnitAvailability(checkIn, checkOut, filters),
    enabled: enabled && dateValidation.isValid,
    staleTime: 60000, // 1 minute
    retry: 2,
  });
}

/**
 * Hook for getting available units grouped by type
 */
export function useAvailableUnitsByType(
  checkIn: string,
  checkOut: string,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;

  const dateValidation = useMemo(() => {
    if (!checkIn || !checkOut) return { isValid: false };
    return validateDateRange(checkIn, checkOut);
  }, [checkIn, checkOut]);

  return useQuery({
    queryKey: ["available-units-by-type", checkIn, checkOut],
    queryFn: () => getAvailableUnitsByType(checkIn, checkOut),
    enabled: enabled && dateValidation.isValid,
    staleTime: 60000, // 1 minute
    retry: 2,
  });
}

/**
 * Hook for batch availability checking
 */
export function useBatchUnitAvailability(
  unitIds: string[],
  checkIn: string,
  checkOut: string,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;

  const dateValidation = useMemo(() => {
    if (!checkIn || !checkOut) return { isValid: false };
    return validateDateRange(checkIn, checkOut);
  }, [checkIn, checkOut]);

  return useQuery({
    queryKey: ["batch-unit-availability", unitIds, checkIn, checkOut],
    queryFn: () => batchCheckUnitAvailability(unitIds, checkIn, checkOut),
    enabled: enabled && dateValidation.isValid && unitIds.length > 0,
    staleTime: 60000, // 1 minute
    retry: 2,
  });
}

// ============================================
// BLACKOUT PERIOD HOOKS
// ============================================

/**
 * Hook for getting unit blackout periods
 */
export function useUnitBlackouts(
  unitId: string,
  startDate?: string,
  endDate?: string,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: ["unit-blackouts", unitId, startDate, endDate],
    queryFn: () => getUnitBlackoutPeriods(unitId, startDate, endDate),
    enabled: enabled && !!unitId,
    staleTime: 300000, // 5 minutes
    retry: 1,
  });
}

/**
 * Hook for creating blackout periods
 */
export function useCreateBlackout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      unitId,
      blackoutType,
      startDate,
      endDate,
      reason,
      createdBy,
    }: {
      unitId: string;
      blackoutType: BlackoutPeriod["blackoutType"];
      startDate: string;
      endDate: string;
      reason?: string;
      createdBy?: string;
    }) => createBlackoutPeriod(unitId, blackoutType, startDate, endDate, reason, createdBy),
    onSuccess: (data) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["unit-blackouts", data.unitId] });
      queryClient.invalidateQueries({ queryKey: ["unit-availability", data.unitId] });
      queryClient.invalidateQueries({ queryKey: ["available-units"] });
      queryClient.invalidateQueries({ queryKey: ["availability-calendar", data.unitId] });
    },
    onError: (error) => {
      console.error("Failed to create blackout period:", error);
    },
  });
}

// ============================================
// CACHE MANAGEMENT HOOKS
// ❌ TEMPORARILY DISABLED: Require availability_cache table and related RPC functions
// TODO: Deploy availability cache migration or remove if not needed
// ============================================

/*
export function useRefreshAvailabilityCache() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, daysAhead }: { unitId?: string; daysAhead?: number } = {}) =>
      refreshAvailabilityCache(unitId, daysAhead),
    onSuccess: (_cacheCount, variables) => {
      // Invalidate availability queries for refreshed units
      if (variables.unitId) {
        queryClient.invalidateQueries({ queryKey: ["unit-availability", variables.unitId] });
        queryClient.invalidateQueries({ queryKey: ["availability-calendar", variables.unitId] });
      } else {
        // Refresh all availability queries
        queryClient.invalidateQueries({ queryKey: ["unit-availability"] });
        queryClient.invalidateQueries({ queryKey: ["available-units"] });
        queryClient.invalidateQueries({ queryKey: ["availability-calendar"] });
      }
    },
    onError: (error) => {
      console.error("Failed to refresh availability cache:", error);
    },
  });
}

export function useCacheMetrics(options: { enabled?: boolean; refetchInterval?: number } = {}) {
  const { enabled = true, refetchInterval = 60000 } = options; // 1 minute

  return useQuery({
    queryKey: ["cache-metrics"],
    queryFn: getCachePerformanceMetrics,
    enabled,
    staleTime: 30000, // 30 seconds
    refetchInterval,
    retry: 1,
  });
}
*/

// ============================================
// UTILITY HOOKS
// ============================================

/**
 * Hook for validating date ranges with memoization
 */
export function useDateValidation(checkIn: string, checkOut: string) {
  return useMemo(() => {
    if (!checkIn || !checkOut) {
      return { isValid: false, error: "Please select both check-in and check-out dates" };
    }
    return validateDateRange(checkIn, checkOut);
  }, [checkIn, checkOut]);
}

/**
 * Hook for formatting availability results
 */
export function useAvailabilityMessage(result?: AvailabilityResult) {
  return useMemo(() => {
    if (!result) return "";
    return formatAvailabilityMessage(result);
  }, [result]);
}

/**
 * Hook for automatic cache refresh based on booking patterns
 * ❌ TEMPORARILY DISABLED: Depends on useRefreshAvailabilityCache which is disabled
 * TODO: Deploy availability cache migration or remove if not needed
 */
/*
export function useAutoRefreshCache(averageBookingsPerDay: number = 5) {
  const refreshCache = useRefreshAvailabilityCache();

  const refreshInterval = useMemo(() => {
    // Calculate optimal refresh interval based on booking volume
    if (averageBookingsPerDay > 10) return 15 * 60 * 1000; // 15 minutes
    if (averageBookingsPerDay > 5) return 30 * 60 * 1000; // 30 minutes
    if (averageBookingsPerDay > 1) return 60 * 60 * 1000; // 1 hour
    return 2 * 60 * 60 * 1000; // 2 hours
  }, [averageBookingsPerDay]);

  const refreshCacheCallback = useCallback(() => {
    refreshCache.mutate({});
  }, [refreshCache]);

  // Set up automatic refresh interval
  // This would typically be handled by a background service in production
  return {
    refreshInterval,
    refreshCache: refreshCacheCallback,
    isRefreshing: refreshCache.isPending,
  };
}
*/

/**
 * Hook for optimistic availability updates
 */
export function useOptimisticAvailability() {
  const queryClient = useQueryClient();

  const updateOptimistically = useCallback(
    (unitId: string, checkIn: string, checkOut: string, isAvailable: boolean) => {
      const queryKey = ["unit-availability", unitId, checkIn, checkOut];

      queryClient.setQueryData(queryKey, (old: AvailabilityResult | undefined) => ({
        ...old,
        isAvailable,
        conflictingBookings: isAvailable ? 0 : old?.conflictingBookings || 1,
        blackoutPeriods: old?.blackoutPeriods || 0,
        unitStatus: old?.unitStatus || "Available",
      }));
    },
    [queryClient]
  );

  const revertOptimisticUpdate = useCallback(
    (unitId: string, checkIn: string, checkOut: string) => {
      const queryKey = ["unit-availability", unitId, checkIn, checkOut];
      queryClient.invalidateQueries({ queryKey });
    },
    [queryClient]
  );

  return {
    updateOptimistically,
    revertOptimisticUpdate,
  };
}

// ============================================
// PERFORMANCE MONITORING HOOKS
// ============================================

/**
 * Hook for monitoring availability query performance
 */
export function useAvailabilityPerformance() {
  const queryClient = useQueryClient();

  const getQueryStats = useCallback(() => {
    const cache = queryClient.getQueryCache();
    const availabilityQueries = cache
      .getAll()
      .filter(
        (query) =>
          query.queryKey[0]?.toString().includes("availability") ||
          query.queryKey[0]?.toString().includes("available-units")
      );

    return {
      totalQueries: availabilityQueries.length,
      successfulQueries: availabilityQueries.filter((q) => q.state.status === "success").length,
      errorQueries: availabilityQueries.filter((q) => q.state.status === "error").length,
      loadingQueries: availabilityQueries.filter((q) => q.state.status === "pending").length,
      averageQueryTime:
        availabilityQueries.reduce((acc, q) => {
          return acc + (q.state.dataUpdatedAt || 0);
        }, 0) / availabilityQueries.length,
    };
  }, [queryClient]);

  return { getQueryStats };
}
