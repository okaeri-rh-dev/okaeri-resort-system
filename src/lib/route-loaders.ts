/**
 * Enhanced route loaders with store integration and optimistic loading
 * Provides coordinated data fetching with Zustand stores and TanStack Query
 */

import { redirect } from "@tanstack/react-router";
import { queryClient, queryKeys } from "@/lib/query-client";
import { useAuthStore } from "@/stores/authStore";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import { ROUTES } from "@/constants/routes";
import {
  useNavigationStore,
  cacheSyncManager,
  optimisticUpdateManager,
  routeStateManager,
} from "@/lib/store-router-integration";
import { apiClient as api } from "@/lib/api-client";
import { PrefetchManager } from "@/lib/route-utils";
import type {
  BookingsSearchParams,
  PropertiesSearchParams,
  ExpensesSearchParams,
  ReportsSearchParams,
  DashboardSearchParams,
} from "@/types/route-params";
import {
  validateSearchParams,
  DashboardSearchSchema,
  BookingsSearchSchema,
  PropertiesSearchSchema,
  ExpensesSearchSchema,
  ReportsSearchSchema,
} from "@/types/route-params";

// Initialize prefetch manager
const prefetchManager = new PrefetchManager(queryClient);

/**
 * Base loader with authentication and project validation
 */
export async function createAuthenticatedLoader<T extends Record<string, any>>(
  loaderFn: (params: T & { projectId: string; userId: string }) => Promise<any>
) {
  return async (params: T) => {
    // Check authentication
    const authState = useAuthStore.getState();
    if (!authState.isAuthenticated || !authState.user) {
      throw redirect({ to: ROUTES.login, search: { reason: "session_required" } });
    }

    // Check for active project
    const projectState = useProjectStore.getState();
    if (!projectState.activeProjectId) {
      // Try to set first available project
      if (projectState.projects.length > 0) {
        await projectState.setActiveProject(projectState.projects[0]!.id);
      } else {
        // Fetch projects if none loaded
        await projectState.fetchProjects();
        if (projectState.projects.length === 0) {
          throw redirect({ to: "/onboarding", search: { reason: "no_projects" } });
        }
      }
    }

    const projectId = projectState.activeProjectId!;
    const userId = authState.user.id;

    // Start navigation tracking
    const route = params.location?.pathname || "";
    useNavigationStore.getState().startNavigation(route);

    try {
      // Execute loader function
      const result = await loaderFn({ ...params, projectId, userId });

      // Complete navigation
      useNavigationStore.getState().completeNavigation(route);

      return result;
    } catch (error) {
      // Handle navigation failure
      useNavigationStore.getState().failNavigation(error as Error);
      throw error;
    }
  };
}

/**
 * Dashboard loader with comprehensive data fetching
 */
export const dashboardLoader = createAuthenticatedLoader<{
  search: DashboardSearchParams;
}>(async ({ search, projectId }) => {
  const validatedSearch = validateSearchParams(DashboardSearchSchema, search);
  const { dateRange, startDate, endDate } = validatedSearch;

  // Set loading state
  useUIStore.getState().setGlobalLoading(true, "Loading dashboard...");

  try {
    // Parallel data fetching with store synchronization
    const [stats, recentBookings, recentExpenses, charts, alerts] = await Promise.all([
      // Dashboard stats
      queryClient.fetchQuery({
        queryKey: queryKeys.dashboard.stats(projectId),
        queryFn: () =>
          api.get(`/projects/${projectId}/dashboard/stats`, {
            params: { dateRange, startDate, endDate },
          }),
        staleTime: 5 * 60 * 1000,
      }),

      // Recent bookings
      queryClient.fetchQuery({
        queryKey: ["dashboard", "recent-bookings", projectId],
        queryFn: () =>
          api.get(`/projects/${projectId}/bookings/recent`, {
            params: { limit: 5 },
          }),
        staleTime: 2 * 60 * 1000,
      }),

      // Recent expenses
      queryClient.fetchQuery({
        queryKey: ["dashboard", "recent-expenses", projectId],
        queryFn: () =>
          api.get(`/projects/${projectId}/expenses/recent`, {
            params: { limit: 5 },
          }),
        staleTime: 2 * 60 * 1000,
      }),

      // Chart data
      queryClient.fetchQuery({
        queryKey: queryKeys.dashboard.charts(projectId),
        queryFn: () =>
          api.get(`/projects/${projectId}/dashboard/charts`, {
            params: { dateRange, startDate, endDate },
          }),
        staleTime: 5 * 60 * 1000,
      }),

      // Alerts and notifications
      queryClient.fetchQuery({
        queryKey: ["dashboard", "alerts", projectId],
        queryFn: () => api.get(`/projects/${projectId}/dashboard/alerts`),
        staleTime: 1 * 60 * 1000,
      }),
    ]);

    // Prefetch related data in background
    setTimeout(() => {
      prefetchManager.prefetchProperties(projectId, {});
      prefetchManager.prefetchBookings(projectId, { status: ["CONFIRMED"] });
    }, 100);

    // Store route state
    routeStateManager.setRouteState(ROUTES.dashboard, {
      stats,
      recentBookings,
      recentExpenses,
      charts,
      alerts,
      lastFetch: Date.now(),
    });

    return {
      projectId,
      dateRange,
      stats,
      recentBookings,
      recentExpenses,
      charts,
      alerts,
    };
  } finally {
    useUIStore.getState().setGlobalLoading(false);
  }
});

/**
 * Bookings loader with optimistic prefetching
 */
export const bookingsLoader = createAuthenticatedLoader<{
  search: BookingsSearchParams;
}>(async ({ search, projectId }) => {
  const validatedSearch = validateSearchParams(BookingsSearchSchema, search);

  // Apply optimistic UI update
  optimisticUpdateManager.applyOptimisticNavigation("/bookings");

  try {
    // Fetch bookings with search parameters
    const bookings = await queryClient.fetchQuery({
      queryKey: queryKeys.bookings.list(projectId, validatedSearch),
      queryFn: () =>
        api.get(`/projects/${projectId}/bookings`, {
          params: validatedSearch,
        }),
      staleTime: 3 * 60 * 1000,
    });

    // Prefetch properties for booking forms
    const properties = await queryClient.fetchQuery({
      queryKey: queryKeys.properties.list(projectId),
      queryFn: () =>
        api.get(`/projects/${projectId}/properties`, {
          params: { status: ["AVAILABLE"], fields: ["id", "name", "type", "capacity"] },
        }),
      staleTime: 10 * 60 * 1000,
    });

    // Prefetch next page if available
    if (bookings.hasNextPage) {
      queryClient.prefetchQuery({
        queryKey: queryKeys.bookings.list(projectId, {
          ...validatedSearch,
          page: (validatedSearch.page || 1) + 1,
        }),
        queryFn: () =>
          api.get(`/projects/${projectId}/bookings`, {
            params: { ...validatedSearch, page: (validatedSearch.page || 1) + 1 },
          }),
      });
    }

    // Queue prefetch for booking details of visible items
    const visibleBookingIds = bookings.items.slice(0, 5).map((b: any) => b.id);
    visibleBookingIds.forEach((id: string, index: number) => {
      useNavigationStore.getState().queuePrefetch(
        `/bookings/${id}`,
        10 - index // Higher priority for top items
      );
    });

    return {
      projectId,
      search: validatedSearch,
      bookings,
      properties,
    };
  } catch (error) {
    // Rollback optimistic update on failure
    optimisticUpdateManager.rollbackOptimisticNavigation();
    throw error;
  }
});

/**
 * Individual booking loader with related data
 */
export const bookingDetailLoader = createAuthenticatedLoader<{
  params: { bookingId: string };
}>(async ({ params, projectId }) => {
  const { bookingId } = params;

  // Set loading state
  useUIStore.getState().setGlobalLoading(true, "Loading booking details...");

  try {
    // Parallel fetch booking details and related data
    const [booking, payments, property, guestHistory] = await Promise.all([
      // Booking details
      queryClient.fetchQuery({
        queryKey: queryKeys.bookings.detail(projectId, bookingId),
        queryFn: () => api.get(`/projects/${projectId}/bookings/${bookingId}`),
        staleTime: 2 * 60 * 1000,
      }),

      // Payment history
      queryClient.fetchQuery({
        queryKey: ["bookings", "payments", projectId, bookingId],
        queryFn: () => api.get(`/projects/${projectId}/bookings/${bookingId}/payments`),
        staleTime: 2 * 60 * 1000,
      }),

      // Property details
      queryClient.fetchQuery({
        queryKey: ["bookings", "property", projectId, bookingId],
        queryFn: async () => {
          const booking = await api.get(`/projects/${projectId}/bookings/${bookingId}`);
          return api.get(`/projects/${projectId}/properties/${booking.propertyId}`);
        },
        staleTime: 5 * 60 * 1000,
      }),

      // Guest history
      queryClient.fetchQuery({
        queryKey: ["bookings", "guest-history", projectId, bookingId],
        queryFn: async () => {
          const booking = await api.get(`/projects/${projectId}/bookings/${bookingId}`);
          return api.get(`/projects/${projectId}/guests/${booking.guestId}/history`);
        },
        staleTime: 10 * 60 * 1000,
      }),
    ]);

    // Store in route state
    routeStateManager.setRouteState(`/bookings/${bookingId}`, {
      booking,
      payments,
      property,
      guestHistory,
    });

    return {
      projectId,
      bookingId,
      booking,
      payments,
      property,
      guestHistory,
    };
  } finally {
    useUIStore.getState().setGlobalLoading(false);
  }
});

/**
 * Properties loader with availability data
 */
export const propertiesLoader = createAuthenticatedLoader<{
  search: PropertiesSearchParams;
}>(async ({ search, projectId }) => {
  const validatedSearch = validateSearchParams(PropertiesSearchSchema, search);

  // Sync with project store
  const projectStore = useProjectStore.getState();

  try {
    // Fetch properties with search parameters
    const properties = await queryClient.fetchQuery({
      queryKey: queryKeys.properties.list(projectId, validatedSearch),
      queryFn: () =>
        api.get(`/projects/${projectId}/properties`, {
          params: validatedSearch,
        }),
      staleTime: 5 * 60 * 1000,
    });

    // Update project store
    if (properties.items) {
      projectStore.setProperties(properties.items);
    }

    // Fetch availability for visible properties
    const visiblePropertyIds = properties.items?.slice(0, 10).map((p: any) => p.id) || [];
    const availability = await Promise.all(
      visiblePropertyIds.map((id: string) =>
        queryClient.fetchQuery({
          queryKey: queryKeys.properties.availability(projectId, id),
          queryFn: () => api.get(`/projects/${projectId}/properties/${id}/availability`),
          staleTime: 2 * 60 * 1000,
        })
      )
    );

    return {
      projectId,
      search: validatedSearch,
      properties,
      availability,
    };
  } catch (error) {
    console.error("Properties loader error:", error);
    throw error;
  }
});

/**
 * Expenses loader with category data
 */
export const expensesLoader = createAuthenticatedLoader<{
  search: ExpensesSearchParams;
}>(async ({ search, projectId }) => {
  const validatedSearch = validateSearchParams(ExpensesSearchSchema, search);

  try {
    // Parallel fetch expenses and categories
    const [expenses, categories, summary, properties] = await Promise.all([
      // Expenses list
      queryClient.fetchQuery({
        queryKey: queryKeys.expenses.list(projectId, validatedSearch),
        queryFn: () =>
          api.get(`/projects/${projectId}/expenses`, {
            params: validatedSearch,
          }),
        staleTime: 3 * 60 * 1000,
      }),

      // Expense categories
      queryClient.fetchQuery({
        queryKey: queryKeys.expenses.categories(projectId),
        queryFn: () => api.get(`/projects/${projectId}/expenses/categories`),
        staleTime: 15 * 60 * 1000,
      }),

      // Expense summary
      queryClient.fetchQuery({
        queryKey: queryKeys.expenses.summary(projectId, validatedSearch.dateRange),
        queryFn: () =>
          api.get(`/projects/${projectId}/expenses/summary`, {
            params: {
              dateRange: validatedSearch.dateRange,
              startDate: validatedSearch.startDate,
              endDate: validatedSearch.endDate,
            },
          }),
        staleTime: 5 * 60 * 1000,
      }),

      // Properties for expense assignment
      queryClient.fetchQuery({
        queryKey: ["expenses", "properties", projectId],
        queryFn: () =>
          api.get(`/projects/${projectId}/properties`, {
            params: { fields: ["id", "name", "type"] },
          }),
        staleTime: 10 * 60 * 1000,
      }),
    ]);

    // Prefetch approval queue for managers
    const { user } = useAuthStore.getState();
    if (user?.role === "MANAGER" || user?.role === "ADMIN") {
      queryClient.prefetchQuery({
        queryKey: ["expenses", "approval-queue", projectId],
        queryFn: () => api.get(`/projects/${projectId}/expenses/approval-queue`),
        staleTime: 1 * 60 * 1000,
      });
    }

    return {
      projectId,
      search: validatedSearch,
      expenses,
      categories,
      summary,
      properties,
    };
  } catch (error) {
    console.error("Expenses loader error:", error);
    throw error;
  }
});

/**
 * Reports loader with comprehensive analytics
 */
export const reportsLoader = createAuthenticatedLoader<{
  search: ReportsSearchParams;
}>(async ({ search, projectId }) => {
  const validatedSearch = validateSearchParams(ReportsSearchSchema, search);
  const { reportType, dateRange, startDate, endDate, propertyIds } = validatedSearch;

  // Set loading state with specific message
  useUIStore.getState().setGlobalLoading(true, `Generating ${reportType} report...`);

  try {
    // Fetch report data based on type
    const reportPromises = [];

    // Main report data
    reportPromises.push(
      queryClient.fetchQuery({
        queryKey: queryKeys.reports[reportType as keyof typeof queryKeys.reports](projectId, {
          dateRange,
          startDate,
          endDate,
          propertyIds,
        }),
        queryFn: () =>
          api.get(`/projects/${projectId}/reports/${reportType}`, {
            params: { dateRange, startDate, endDate, propertyIds },
          }),
        staleTime: 5 * 60 * 1000,
      })
    );

    // Additional data based on report type
    switch (reportType) {
      case "financial":
        reportPromises.push(
          queryClient.fetchQuery({
            queryKey: ["reports", "financial-breakdown", projectId, dateRange],
            queryFn: () =>
              api.get(`/projects/${projectId}/reports/financial/breakdown`, {
                params: { dateRange, startDate, endDate },
              }),
            staleTime: 5 * 60 * 1000,
          })
        );
        break;

      case "occupancy":
        reportPromises.push(
          queryClient.fetchQuery({
            queryKey: ["reports", "occupancy-trends", projectId, dateRange],
            queryFn: () =>
              api.get(`/projects/${projectId}/reports/occupancy/trends`, {
                params: { dateRange, startDate, endDate, propertyIds },
              }),
            staleTime: 5 * 60 * 1000,
          })
        );
        break;

      case "revenue":
        reportPromises.push(
          queryClient.fetchQuery({
            queryKey: ["reports", "revenue-forecast", projectId, dateRange],
            queryFn: () =>
              api.get(`/projects/${projectId}/reports/revenue/forecast`, {
                params: { dateRange, startDate, endDate },
              }),
            staleTime: 5 * 60 * 1000,
          })
        );
        break;
    }

    // Fetch properties for filtering
    reportPromises.push(
      queryClient.fetchQuery({
        queryKey: ["reports", "properties", projectId],
        queryFn: () =>
          api.get(`/projects/${projectId}/properties`, {
            params: { fields: ["id", "name", "type", "status"] },
          }),
        staleTime: 10 * 60 * 1000,
      })
    );

    const [reportData, ...additionalData] = await Promise.all(reportPromises);

    // Store in route state for quick access
    routeStateManager.setRouteState("/reports", {
      reportType,
      reportData,
      additionalData,
      filters: validatedSearch,
      generatedAt: Date.now(),
    });

    return {
      projectId,
      search: validatedSearch,
      reportData,
      additionalData,
    };
  } finally {
    useUIStore.getState().setGlobalLoading(false);
  }
});

/**
 * Settings loader with project configuration
 */
export const settingsLoader = createAuthenticatedLoader<{}>(async ({ projectId, userId }) => {
  try {
    // Parallel fetch all settings data
    const [projectSettings, userProfile, integrations, teamMembers, billingInfo] =
      await Promise.all([
        // Project settings
        queryClient.fetchQuery({
          queryKey: ["settings", "project", projectId],
          queryFn: () => api.get(`/projects/${projectId}/settings`),
          staleTime: 10 * 60 * 1000,
        }),

        // User profile
        queryClient.fetchQuery({
          queryKey: ["settings", "profile", userId],
          queryFn: () => api.get(`/users/${userId}/profile`),
          staleTime: 10 * 60 * 1000,
        }),

        // Integrations
        queryClient.fetchQuery({
          queryKey: ["settings", "integrations", projectId],
          queryFn: () => api.get(`/projects/${projectId}/integrations`),
          staleTime: 10 * 60 * 1000,
        }),

        // Team members (for admins)
        queryClient.fetchQuery({
          queryKey: ["settings", "team", projectId],
          queryFn: () => api.get(`/projects/${projectId}/team`),
          staleTime: 5 * 60 * 1000,
        }),

        // Billing information
        queryClient.fetchQuery({
          queryKey: ["settings", "billing", projectId],
          queryFn: () => api.get(`/projects/${projectId}/billing`),
          staleTime: 15 * 60 * 1000,
        }),
      ]);

    return {
      projectId,
      projectSettings,
      userProfile,
      integrations,
      teamMembers,
      billingInfo,
    };
  } catch (error) {
    console.error("Settings loader error:", error);
    throw error;
  }
});

/**
 * Analytics loader with insights and forecasts
 */
export const analyticsLoader = createAuthenticatedLoader<{
  search: { metric?: string; period?: string };
}>(async ({ search, projectId }) => {
  const { metric = "revenue", period = "month" } = search;

  try {
    // Fetch analytics data
    const [trends, forecasts, insights, comparisons] = await Promise.all([
      // Trend analysis
      queryClient.fetchQuery({
        queryKey: queryKeys.analytics.trends(projectId, metric),
        queryFn: () =>
          api.get(`/projects/${projectId}/analytics/trends`, {
            params: { metric, period },
          }),
        staleTime: 10 * 60 * 1000,
      }),

      // Forecasting
      queryClient.fetchQuery({
        queryKey: queryKeys.analytics.forecasts(projectId),
        queryFn: () =>
          api.get(`/projects/${projectId}/analytics/forecasts`, {
            params: { metric, horizon: 90 }, // 90-day forecast
          }),
        staleTime: 30 * 60 * 1000,
      }),

      // AI-powered insights
      queryClient.fetchQuery({
        queryKey: queryKeys.analytics.insights(projectId),
        queryFn: () => api.get(`/projects/${projectId}/analytics/insights`),
        staleTime: 60 * 60 * 1000, // 1 hour
      }),

      // Period comparisons
      queryClient.fetchQuery({
        queryKey: ["analytics", "comparisons", projectId, period],
        queryFn: () =>
          api.get(`/projects/${projectId}/analytics/compare`, {
            params: { period },
          }),
        staleTime: 15 * 60 * 1000,
      }),
    ]);

    return {
      projectId,
      metric,
      period,
      trends,
      forecasts,
      insights,
      comparisons,
    };
  } catch (error) {
    console.error("Analytics loader error:", error);
    throw error;
  }
});

/**
 * Create a loader with automatic cleanup
 */
export function createCleanupLoader<T extends Record<string, any>>(
  loaderFn: (params: T) => Promise<any>,
  cleanupFn: () => void
) {
  return async (params: T) => {
    // Register cleanup function
    const route = params.location?.pathname || "";
    routeStateManager.registerCleanup(route, cleanupFn);

    // Execute loader
    return loaderFn(params);
  };
}

/**
 * Batch loader for parallel data fetching
 */
export async function batchLoader(loaders: Array<() => Promise<any>>): Promise<any[]> {
  const results = await Promise.allSettled(loaders);

  return results.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    } else {
      console.error(`Loader ${index} failed:`, result.reason);
      return null;
    }
  });
}
