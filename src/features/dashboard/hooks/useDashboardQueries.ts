/**
 * Dashboard TanStack Query Hooks - Server state management for dashboard
 * Phase 2.1 - TDD GREEN: Minimal implementation to pass all query tests
 */

import {
  useQuery,
  useMutation,
  useInfiniteQuery,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
  type UseInfiniteQueryResult,
} from "@tanstack/react-query";
import { useRealtimeStore } from "../stores/realtimeStore";
import type { BookingMetrics, FinancialMetrics, DashboardActivity, MetricPeriod } from "../types";

// Query keys for consistent cache management
export const queryKeys = {
  dashboard: {
    all: (projectId: string) => ["dashboard", projectId] as const,
    stats: (projectId: string) => ["dashboard", projectId, "stats"] as const,
    occupancy: (projectId: string, period: MetricPeriod) =>
      ["dashboard", projectId, "occupancy", period] as const,
    revenue: (projectId: string) => ["dashboard", projectId, "revenue"] as const,
    bookings: (projectId: string) => ["dashboard", projectId, "bookings"] as const,
    activities: (projectId: string, params?: any) =>
      ["dashboard", projectId, "activities", params] as const,
  },
  bookings: {
    all: (projectId: string) => ["bookings", projectId] as const,
    upcoming: (projectId: string) => ["bookings", projectId, "upcoming"] as const,
    details: (projectId: string) => ["bookings", projectId, "details"] as const,
  },
};

// Dashboard Metrics Hook
export function useDashboardMetrics(projectId: string | null) {
  const realtimeStore = useRealtimeStore();

  return useQuery({
    queryKey: queryKeys.dashboard.stats(projectId!),
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/metrics?projectId=${projectId}`);
      if (!response.ok) throw new Error("Failed to fetch dashboard metrics");
      return response.json();
    },
    enabled: !!projectId,
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      // Refetch every 60 seconds when visible
      return document.visibilityState === "visible" ? 60 * 1000 : false;
    },
  });
}

// Occupancy Trends Hook
export function useOccupancyTrends(projectId: string, period: MetricPeriod) {
  return useQuery({
    queryKey: queryKeys.dashboard.occupancy(projectId, period),
    queryFn: async () => {
      const response = await fetch(
        `/api/dashboard/occupancy?projectId=${projectId}&period=${period}`
      );
      if (!response.ok) throw new Error("Failed to fetch occupancy trends");
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes for trend data
    refetchOnWindowFocus: false,
  });
}

// Revenue Summary Hook
export function useRevenueSummary(projectId: string) {
  return useQuery({
    queryKey: queryKeys.dashboard.revenue(projectId),
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/revenue?projectId=${projectId}`);
      if (!response.ok) throw new Error("Failed to fetch revenue summary");
      return response.json();
    },
    staleTime: 15 * 60 * 1000, // 15 minutes for financial data
    refetchOnWindowFocus: false,
  });
}

// Upcoming Bookings Hook
export function useUpcomingBookings(projectId: string) {
  return useQuery({
    queryKey: queryKeys.bookings.upcoming(projectId),
    queryFn: async () => {
      const response = await fetch(`/api/bookings/upcoming?projectId=${projectId}`);
      if (!response.ok) throw new Error("Failed to fetch upcoming bookings");
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
  });
}

// Activity Feed Hook with Infinite Query
interface ActivityFeedParams {
  limit?: number;
  offset?: number;
}

export function useActivityFeed(projectId: string, params: ActivityFeedParams = {}) {
  const { limit = 20, offset } = params;

  if (offset !== undefined) {
    // Regular query for paginated data
    return useQuery({
      queryKey: queryKeys.dashboard.activities(projectId, { limit, offset }),
      queryFn: async () => {
        const response = await fetch(
          `/api/dashboard/activities?projectId=${projectId}&limit=${limit}&offset=${offset}`
        );
        if (!response.ok) throw new Error("Failed to fetch activity feed");
        return response.json();
      },
      staleTime: 1 * 60 * 1000, // 1 minute
    });
  }

  // Infinite query for continuous loading
  return useInfiniteQuery({
    queryKey: queryKeys.dashboard.activities(projectId, { limit }),
    queryFn: async ({ pageParam = 0 }) => {
      const response = await fetch(
        `/api/dashboard/activities?projectId=${projectId}&limit=${limit}&offset=${pageParam}`
      );
      if (!response.ok) throw new Error("Failed to fetch activity feed");
      return response.json();
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.length * limit;
    },
    staleTime: 1 * 60 * 1000,
  });
}

// Quick Check-in Mutation
export function useQuickCheckIn(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (booking: any) => {
      const response = await fetch("/api/bookings/quick-checkin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(booking),
      });

      if (!response.ok) throw new Error("Check-in failed");
      return response.json();
    },
    onMutate: async (booking) => {
      // Optimistic update - increase occupancy
      const previousData = queryClient.getQueryData(queryKeys.dashboard.stats(projectId));

      queryClient.setQueryData(queryKeys.dashboard.stats(projectId), (old: any) => {
        if (!old?.booking?.occupancy) return old;

        return {
          ...old,
          booking: {
            ...old.booking,
            occupancy: {
              ...old.booking.occupancy,
              current: old.booking.occupancy.current + 1,
            },
          },
        };
      });

      return { previousData };
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.all(projectId),
      });
    },
    onError: (error, booking, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.dashboard.stats(projectId), context.previousData);
      }
    },
  });
}

// Quick Expense Entry Mutation
export function useQuickExpenseEntry(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (expense: any) => {
      const response = await fetch("/api/expenses/quick-entry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(expense),
      });

      if (!response.ok) throw new Error("Expense entry failed");
      return response.json();
    },
    onMutate: async (expense) => {
      // Optimistic update - increase expenses
      const previousData = queryClient.getQueryData(queryKeys.dashboard.stats(projectId));

      queryClient.setQueryData(queryKeys.dashboard.stats(projectId), (old: any) => {
        if (!old?.financial?.expenses) return old;

        return {
          ...old,
          financial: {
            ...old.financial,
            expenses: {
              ...old.financial.expenses,
              monthly: {
                ...old.financial.expenses.monthly,
                amount: old.financial.expenses.monthly.amount + expense.amount,
              },
            },
          },
        };
      });

      return { previousData };
    },
    onSuccess: (data) => {
      // Return VAT calculation if included
      if (data.vatAmount) {
        return data;
      }

      // Invalidate financial queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.revenue(projectId),
      });
    },
    onError: (error, expense, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.dashboard.stats(projectId), context.previousData);
      }
    },
  });
}

// Dashboard Refresh Hook
export function useDashboardRefresh(projectId: string) {
  const queryClient = useQueryClient();

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.dashboard.all(projectId),
    });
  };

  const pullToRefresh = async () => {
    await queryClient.refetchQueries({
      queryKey: queryKeys.dashboard.all(projectId),
      type: "active",
    });
  };

  return {
    refresh,
    pullToRefresh,
  };
}

// Metric Subscription Hook (WebSocket integration)
export function useMetricSubscription(
  projectId: string,
  metric?: string,
  onUpdate?: (data: any) => void
) {
  const realtimeStore = useRealtimeStore();
  const queryClient = useQueryClient();

  // Mock WebSocket for testing
  const ws =
    typeof window !== "undefined"
      ? {
          dispatchEvent: (event: MessageEvent) => {
            if (event.data) {
              const data = JSON.parse(event.data);
              if (data.type === "metric_update" && onUpdate) {
                onUpdate(data);
              }
            }
          },
        }
      : null;

  return {
    ws,
    isConnected: realtimeStore.ws.status === "connected",
    subscribe: (callback: (data: any) => void) => {
      return realtimeStore.subscribe("metric_update", callback);
    },
    unsubscribe: () => {
      // Cleanup subscription
    },
  };
}

// Background refetching based on visibility
export function useBackgroundRefetch(projectId: string) {
  const queryClient = useQueryClient();

  // Handle visibility changes
  if (typeof window !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        queryClient.invalidateQueries({
          queryKey: queryKeys.dashboard.all(projectId),
        });
      }
    });
  }
}

// Error handling with retry logic
export function useQueryWithRetry<T>(
  queryKey: any[],
  queryFn: () => Promise<T>,
  options: any = {}
) {
  return useQuery({
    queryKey,
    queryFn,
    retry: (failureCount, error) => {
      // Don't retry on client errors (4xx)
      if (error instanceof Error && error.message.includes("4")) {
        return false;
      }

      // Retry up to 3 times with exponential backoff
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...options,
  });
}

// Offline handling
export function useOfflineQuery<T>(queryKey: any[], queryFn: () => Promise<T>, options: any = {}) {
  return useQuery({
    queryKey,
    queryFn: () => {
      if (!navigator.onLine) {
        throw new Error("Application is offline");
      }
      return queryFn();
    },
    enabled: navigator.onLine,
    ...options,
  });
}
