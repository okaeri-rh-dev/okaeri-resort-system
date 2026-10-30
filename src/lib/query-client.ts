import { QueryClient } from "@tanstack/react-query";
import { isNotFound } from "@tanstack/react-router";

/**
 * Shared QueryClient instance used by both TanStack Router (route loaders)
 * and QueryClientProvider (React components).
 *
 * IMPORTANT: This must be a single instance so route loaders and components
 * share the same cache. Having two QueryClients causes preloaded data to be
 * discarded and re-fetched when components mount.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: How long until a query is considered stale
      staleTime: 1000 * 60 * 5, // 5 minutes default

      // Cache time: How long to keep unused data in cache
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)

      // Retry configuration
      retry: (failureCount, error) => {
        if (isNotFound(error)) return false;

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
