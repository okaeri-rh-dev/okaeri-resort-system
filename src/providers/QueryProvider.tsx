import React from "react";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { queryClient } from "@/lib/query-client";

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
// QUERY CLIENT UTILITIES (Internal - not exported)
// ============================================

// Note: These utilities are kept for potential future use but not exported
// to satisfy React Fast Refresh requirements (only components should be exported)

// Prefetch utilities (internal use only)
const _prefetchQueries = {
  units: async () => {
    await queryClient.prefetchQuery({
      queryKey: ["units"],
      queryFn: async () => {
        const { supabase } = await import("@/lib/supabase");
        const { data } = await supabase.from("units").select("*");
        return data;
      },
      staleTime: 1000 * 60 * 10,
    });
  },
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
      staleTime: 1000 * 60 * 5,
    });
  },
  guests: async () => {
    await queryClient.prefetchQuery({
      queryKey: ["guests"],
      queryFn: async () => {
        const { supabase } = await import("@/lib/supabase");
        const { data } = await supabase.from("guests").select("*");
        return data;
      },
      staleTime: 1000 * 60 * 10,
    });
  },
  dashboard: async () => {
    await queryClient.prefetchQuery({
      queryKey: ["dashboard-stats"],
      queryFn: async () => {
        const { supabase } = await import("@/lib/supabase");
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
      staleTime: 1000 * 60 * 2,
    });
  },
};

// Cache invalidation utilities (internal use only)
const _invalidateQueries = {
  all: () => queryClient.invalidateQueries(),
  units: () => queryClient.invalidateQueries({ queryKey: ["units"] }),
  bookings: () => queryClient.invalidateQueries({ queryKey: ["bookings"] }),
  guests: () => queryClient.invalidateQueries({ queryKey: ["guests"] }),
  dashboard: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
  afterBookingMutation: () => {
    queryClient.invalidateQueries({ queryKey: ["bookings"] });
    queryClient.invalidateQueries({ queryKey: ["units"] });
    queryClient.invalidateQueries({ queryKey: ["guests"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  },
  afterUnitMutation: () => {
    queryClient.invalidateQueries({ queryKey: ["units"] });
    queryClient.invalidateQueries({ queryKey: ["bookings"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  },
};

// Offline support utilities (internal use only)
const _offlineSupport = {
  isOnline: () => navigator.onLine,
  setupListeners: () => {
    window.addEventListener("online", () => {
      queryClient.refetchQueries();
    });
    window.addEventListener("offline", () => {
      console.warn("App is offline - data may be stale");
    });
  },
  queueMutation: async <T,>(mutation: () => Promise<T>): Promise<T> => {
    if (!navigator.onLine) {
      const queue = JSON.parse(localStorage.getItem("mutationQueue") || "[]");
      queue.push({ timestamp: Date.now(), mutation: mutation.toString() });
      localStorage.setItem("mutationQueue", JSON.stringify(queue));
      return { queued: true } as T;
    }
    return mutation();
  },
  processQueue: async () => {
    const queue = JSON.parse(localStorage.getItem("mutationQueue") || "[]");
    for (const item of queue) {
      try {
        console.warn("Processing queued mutation from", { timestamp: new Date(item.timestamp) });
      } catch (error) {
        console.error("Failed to process queued mutation:", error);
      }
    }
    localStorage.removeItem("mutationQueue");
  },
};

// Performance monitoring utilities (internal use only)
const _performanceMonitoring = {
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

// Suppress unused variable warnings - these are preserved for future use
void _prefetchQueries;
void _invalidateQueries;
void _offlineSupport;
void _performanceMonitoring;
