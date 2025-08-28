/**
 * TanStack Query client configuration with optimal settings for resort management
 */

import { QueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";

// Create query client with optimized defaults
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: 5 minutes for most data
      staleTime: 5 * 60 * 1000,

      // Cache time: 10 minutes
      gcTime: 10 * 60 * 1000,

      // Retry failed requests 3 times with exponential backoff
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.status >= 400 && error?.status < 500) {
          // Except for 401 (unauthorized) - might be token expiry
          if (error.status === 401) {
            // Try to refresh token once
            if (failureCount === 0) {
              useAuthStore
                .getState()
                .refreshTokens()
                .catch(() => {
                  // If refresh fails, logout
                  useAuthStore.getState().logout();
                });
              return true;
            }
            return false;
          }
          return false;
        }

        // Retry server errors up to 3 times
        return failureCount < 3;
      },

      // Retry delay with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Refetch on window focus for fresh data
      refetchOnWindowFocus: true,

      // Refetch on reconnect
      refetchOnReconnect: true,

      // Don't refetch on mount by default (use cache first)
      refetchOnMount: "always",
    },

    mutations: {
      // Retry mutations once on failure
      retry: 1,

      // Show global error notifications
      onError: (error: any) => {
        const { toast } = useUIStore.getState();
        toast.error("Operation failed", error?.message || "An unexpected error occurred");
      },
    },
  },
});

// Query key factory for consistent key generation
export const queryKeys = {
  all: ["queries"] as const,

  // Auth queries
  auth: {
    all: () => [...queryKeys.all, "auth"] as const,
    user: () => [...queryKeys.auth.all(), "user"] as const,
    session: () => [...queryKeys.auth.all(), "session"] as const,
  },

  // Project queries
  projects: {
    all: () => [...queryKeys.all, "projects"] as const,
    lists: () => [...queryKeys.projects.all(), "list"] as const,
    list: (filters?: any) => [...queryKeys.projects.lists(), filters] as const,
    details: () => [...queryKeys.projects.all(), "detail"] as const,
    detail: (id: string) => [...queryKeys.projects.details(), id] as const,
    stats: (id: string) => [...queryKeys.projects.detail(id), "stats"] as const,
    members: (id: string) => [...queryKeys.projects.detail(id), "members"] as const,
  },

  // Property queries
  properties: {
    all: (projectId: string) => [...queryKeys.all, "properties", projectId] as const,
    lists: (projectId: string) => [...queryKeys.properties.all(projectId), "list"] as const,
    list: (projectId: string, filters?: any) =>
      [...queryKeys.properties.lists(projectId), filters] as const,
    details: (projectId: string) => [...queryKeys.properties.all(projectId), "detail"] as const,
    detail: (projectId: string, id: string) =>
      [...queryKeys.properties.details(projectId), id] as const,
    availability: (projectId: string, id: string) =>
      [...queryKeys.properties.detail(projectId, id), "availability"] as const,
  },

  // Booking queries
  bookings: {
    all: (projectId: string) => [...queryKeys.all, "bookings", projectId] as const,
    lists: (projectId: string) => [...queryKeys.bookings.all(projectId), "list"] as const,
    list: (projectId: string, filters?: any) =>
      [...queryKeys.bookings.lists(projectId), filters] as const,
    details: (projectId: string) => [...queryKeys.bookings.all(projectId), "detail"] as const,
    detail: (projectId: string, id: string) =>
      [...queryKeys.bookings.details(projectId), id] as const,
    calendar: (projectId: string, propertyId?: string) =>
      [...queryKeys.bookings.all(projectId), "calendar", propertyId] as const,
    timeline: (projectId: string, dateRange?: any) =>
      [...queryKeys.bookings.all(projectId), "timeline", dateRange] as const,
  },

  // Financial queries
  expenses: {
    all: (projectId: string) => [...queryKeys.all, "expenses", projectId] as const,
    lists: (projectId: string) => [...queryKeys.expenses.all(projectId), "list"] as const,
    list: (projectId: string, filters?: any) =>
      [...queryKeys.expenses.lists(projectId), filters] as const,
    details: (projectId: string) => [...queryKeys.expenses.all(projectId), "detail"] as const,
    detail: (projectId: string, id: string) =>
      [...queryKeys.expenses.details(projectId), id] as const,
    categories: (projectId: string) =>
      [...queryKeys.expenses.all(projectId), "categories"] as const,
    summary: (projectId: string, period?: string) =>
      [...queryKeys.expenses.all(projectId), "summary", period] as const,
  },

  // Dashboard queries
  dashboard: {
    all: (projectId: string) => [...queryKeys.all, "dashboard", projectId] as const,
    stats: (projectId: string) => [...queryKeys.dashboard.all(projectId), "stats"] as const,
    charts: (projectId: string) => [...queryKeys.dashboard.all(projectId), "charts"] as const,
    recent: (projectId: string) => [...queryKeys.dashboard.all(projectId), "recent"] as const,
  },

  // Reports queries
  reports: {
    all: (projectId: string) => [...queryKeys.all, "reports", projectId] as const,
    financial: (projectId: string, period?: any) =>
      [...queryKeys.reports.all(projectId), "financial", period] as const,
    occupancy: (projectId: string, period?: any) =>
      [...queryKeys.reports.all(projectId), "occupancy", period] as const,
    revenue: (projectId: string, period?: any) =>
      [...queryKeys.reports.all(projectId), "revenue", period] as const,
  },

  // Analytics queries
  analytics: {
    all: (projectId: string) => [...queryKeys.all, "analytics", projectId] as const,
    trends: (projectId: string, metric?: string) =>
      [...queryKeys.analytics.all(projectId), "trends", metric] as const,
    forecasts: (projectId: string) => [...queryKeys.analytics.all(projectId), "forecasts"] as const,
    insights: (projectId: string) => [...queryKeys.analytics.all(projectId), "insights"] as const,
  },
} as const;

// Mutation key factory
export const mutationKeys = {
  // Auth mutations
  auth: {
    login: () => ["auth", "login"] as const,
    logout: () => ["auth", "logout"] as const,
    register: () => ["auth", "register"] as const,
    updateProfile: () => ["auth", "updateProfile"] as const,
  },

  // Project mutations
  projects: {
    create: () => ["projects", "create"] as const,
    update: (id: string) => ["projects", "update", id] as const,
    delete: (id: string) => ["projects", "delete", id] as const,
    invite: (id: string) => ["projects", "invite", id] as const,
  },

  // Property mutations
  properties: {
    create: (projectId: string) => ["properties", "create", projectId] as const,
    update: (projectId: string, id: string) => ["properties", "update", projectId, id] as const,
    delete: (projectId: string, id: string) => ["properties", "delete", projectId, id] as const,
  },

  // Booking mutations
  bookings: {
    create: (projectId: string) => ["bookings", "create", projectId] as const,
    update: (projectId: string, id: string) => ["bookings", "update", projectId, id] as const,
    cancel: (projectId: string, id: string) => ["bookings", "cancel", projectId, id] as const,
    checkIn: (projectId: string, id: string) => ["bookings", "checkIn", projectId, id] as const,
    checkOut: (projectId: string, id: string) => ["bookings", "checkOut", projectId, id] as const,
  },

  // Expense mutations
  expenses: {
    create: (projectId: string) => ["expenses", "create", projectId] as const,
    update: (projectId: string, id: string) => ["expenses", "update", projectId, id] as const,
    delete: (projectId: string, id: string) => ["expenses", "delete", projectId, id] as const,
    approve: (projectId: string, id: string) => ["expenses", "approve", projectId, id] as const,
    reject: (projectId: string, id: string) => ["expenses", "reject", projectId, id] as const,
  },
} as const;

// Helper to invalidate queries after mutations
export const invalidateQueries = {
  // Invalidate all project-related queries
  projects: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
  },

  // Invalidate specific project and its related data
  project: (projectId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.properties.all(projectId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all(projectId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all(projectId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(projectId) });
  },

  // Invalidate property-related queries
  properties: (projectId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.properties.all(projectId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all(projectId) });
  },

  // Invalidate booking-related queries
  bookings: (projectId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all(projectId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(projectId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.reports.all(projectId) });
  },

  // Invalidate expense-related queries
  expenses: (projectId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all(projectId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(projectId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.reports.all(projectId) });
  },
};

export default queryClient;
