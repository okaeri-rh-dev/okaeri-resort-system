import React from "react";

import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

// ============================================
// QUERY CLIENT CONFIGURATION
// ============================================
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: How long until a query is considered stale
      staleTime: 1000 * 60 * 5, // 5 minutes default

      // Cache time: How long to keep unused data in cache
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)

      // Retry configuration
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof Error) {
          const message = error.message.toLowerCase();
          if (
            message.includes("unauthorized") ||
            message.includes("forbidden") ||
            message.includes("not found") ||
            message.includes("bad request")
          ) {
            return false;
          }
        }

        // Retry up to 3 times with exponential backoff
        return failureCount < 3;
      },

      // Retry delay with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Refetch on window focus (great for keeping data fresh)
      refetchOnWindowFocus: true,

      // Refetch on reconnect
      refetchOnReconnect: true,

      // Network mode
      networkMode: "online", // 'online' | 'always' | 'offlineFirst'
    },
    mutations: {
      // Retry configuration for mutations
      retry: false, // Usually don't want to retry mutations automatically

      // Network mode
      networkMode: "online",
    },
  },
});

// ============================================
// QUERY PROVIDER COMPONENT
// ============================================
interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {import.meta.env.DEV && (
        <ReactQueryDevtools initialIsOpen={false} position="bottom" buttonPosition="bottom-right" />
      )}
    </QueryClientProvider>
  );
}

// ============================================
// QUERY CLIENT UTILITIES
// ============================================

// Export query client for use in other parts of the app
export { queryClient };

// Prefetch utilities
export const prefetchQueries = {
  // Prefetch units data
  units: async () => {
    await queryClient.prefetchQuery({
      queryKey: ["units"],
      queryFn: async () => {
        const { supabase } = await import("@/lib/supabase");
        const { data } = await supabase.from("units").select("*");
        return data;
      },
      staleTime: 1000 * 60 * 10, // 10 minutes
    });
  },

  // Prefetch bookings data
  bookings: async () => {
    await queryClient.prefetchQuery({
      queryKey: ["bookings"],
      queryFn: async () => {
        const { supabase } = await import("@/lib/supabase");
        const { data } = await supabase.from("bookings").select(`
          *,
          unit:units(*),
          guest:guests(*)
        `);
        return data;
      },
      staleTime: 1000 * 60 * 5, // 5 minutes
    });
  },

  // Prefetch guests data
  guests: async () => {
    await queryClient.prefetchQuery({
      queryKey: ["guests"],
      queryFn: async () => {
        const { supabase } = await import("@/lib/supabase");
        const { data } = await supabase.from("guests").select("*");
        return data;
      },
      staleTime: 1000 * 60 * 10, // 10 minutes
    });
  },

  // Prefetch dashboard statistics
  dashboard: async () => {
    await queryClient.prefetchQuery({
      queryKey: ["dashboard-stats"],
      queryFn: async () => {
        const { supabase } = await import("@/lib/supabase");

        // Fetch multiple statistics in parallel
        const [unitsResult, bookingsResult, revenueResult] = await Promise.all([
          supabase.from("units").select("unit_status").eq("unit_status", "Available"),
          supabase.from("bookings").select("booking_status").eq("booking_status", "Confirmed"),
          supabase.from("bookings").select("total_amount").eq("payment_status", "Completed"),
        ]);

        return {
          availableUnits: unitsResult.data?.length || 0,
          activeBookings: bookingsResult.data?.length || 0,
          totalRevenue: revenueResult.data?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0,
        };
      },
      staleTime: 1000 * 60 * 2, // 2 minutes
    });
  },
};

// Cache invalidation utilities
export const invalidateQueries = {
  // Invalidate all queries
  all: () => queryClient.invalidateQueries(),

  // Invalidate specific query groups
  units: () => queryClient.invalidateQueries({ queryKey: ["units"] }),
  bookings: () => queryClient.invalidateQueries({ queryKey: ["bookings"] }),
  guests: () => queryClient.invalidateQueries({ queryKey: ["guests"] }),
  dashboard: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }),

  // Invalidate related queries after a booking is created/updated
  afterBookingMutation: () => {
    queryClient.invalidateQueries({ queryKey: ["bookings"] });
    queryClient.invalidateQueries({ queryKey: ["units"] });
    queryClient.invalidateQueries({ queryKey: ["guests"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  },

  // Invalidate related queries after a unit is updated
  afterUnitMutation: () => {
    queryClient.invalidateQueries({ queryKey: ["units"] });
    queryClient.invalidateQueries({ queryKey: ["bookings"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  },
};

// Type for items with an identifiable field
type IdentifiableItem = Record<string, unknown>;

// Optimistic update utilities
export const optimisticUpdates = {
  // Update a specific item in a list query
  updateListItem: <T extends IdentifiableItem>(
    queryKey: QueryKey,
    itemId: string,
    idField: string,
    updates: Partial<T>
  ) => {
    queryClient.setQueryData(queryKey, (oldData: T[] | undefined) => {
      if (!oldData) return oldData;

      return oldData.map((item) => (item[idField] === itemId ? { ...item, ...updates } : item));
    });
  },

  // Add item to a list query
  addListItem: <T,>(queryKey: QueryKey, newItem: T, prepend = true) => {
    queryClient.setQueryData(queryKey, (oldData: T[] | undefined) => {
      if (!oldData) return [newItem];
      return prepend ? [newItem, ...oldData] : [...oldData, newItem];
    });
  },

  // Remove item from a list query
  removeListItem: <T extends IdentifiableItem>(
    queryKey: QueryKey,
    itemId: string,
    idField: string
  ) => {
    queryClient.setQueryData(queryKey, (oldData: T[] | undefined) => {
      if (!oldData) return oldData;
      return oldData.filter((item) => item[idField] !== itemId);
    });
  },
};

// Offline support utilities
export const offlineSupport = {
  // Check if the app is online
  isOnline: () => navigator.onLine,

  // Set up offline/online listeners
  setupListeners: () => {
    window.addEventListener("online", () => {
      // Refetch all queries when coming back online
      queryClient.refetchQueries();
    });

    window.addEventListener("offline", () => {
      // Could show a notification here
      console.log("App is offline - data may be stale");
    });
  },

  // Queue mutations for when the app comes back online
  queueMutation: async <T,>(mutation: () => Promise<T>): Promise<T> => {
    if (!navigator.onLine) {
      // Store mutation in localStorage or IndexedDB
      const queue = JSON.parse(localStorage.getItem("mutationQueue") || "[]");
      queue.push({ timestamp: Date.now(), mutation: mutation.toString() });
      localStorage.setItem("mutationQueue", JSON.stringify(queue));
      return { queued: true } as T;
    }

    return mutation();
  },

  // Process queued mutations when online
  processQueue: async () => {
    const queue = JSON.parse(localStorage.getItem("mutationQueue") || "[]");

    for (const item of queue) {
      try {
        // Note: In a real app, you'd need to properly serialize/deserialize functions
        // This is a simplified example
        console.log("Processing queued mutation from", new Date(item.timestamp));
      } catch (error) {
        console.error("Failed to process queued mutation:", error);
      }
    }

    localStorage.removeItem("mutationQueue");
  },
};

// Performance monitoring utilities
export const performanceMonitoring = {
  // Log slow queries
  logSlowQueries: () => {
    const queries = queryClient.getQueryCache().getAll();

    queries.forEach((query) => {
      const queryState = query.state;
      if (queryState.fetchStatus === "fetching") {
        const fetchTime = Date.now() - (queryState.dataUpdatedAt || 0);
        if (fetchTime > 3000) {
          console.warn(`Slow query detected: ${query.queryKey}`, fetchTime);
        }
      }
    });
  },

  // Get query metrics
  getMetrics: () => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();

    return {
      totalQueries: queries.length,
      activeQueries: queries.filter((q) => q.state.fetchStatus === "fetching").length,
      staleQueries: queries.filter((q) => q.state.isInvalidated).length,
      errorQueries: queries.filter((q) => q.state.error !== null).length,
    };
  },
};
