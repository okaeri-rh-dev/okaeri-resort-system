import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { z } from "zod";
import { api } from "@/lib/api-client";
import { useProjectStore } from "@/stores/projectStore";
import { useAuthStore } from "@/stores/authStore";
import { ROUTES } from "@/routes/paths";
import type { Booking, Property, Expense, DashboardStats, PaginatedResponse } from "@/types/common";

// Import all route parameter types from the centralized location
import type {
  BookingsSearchParams,
  PropertiesSearchParams,
  ExpensesSearchParams,
  ReportsSearchParams,
  TeamSearchParams,
} from "@/types/route-params";

/**
 * Route utility functions for TanStack Router enhancements
 * Provides prefetching strategies, search parameter validation, and error handling
 *
 * Note: All search parameter schemas and types are now centralized in /src/types/route-params.ts
 */

/**
 * Validates and parses search parameters with fallback to defaults
 */
export function validateSearchParams<T extends z.ZodType>(
  schema: T,
  params: Record<string, any>
): z.infer<T> {
  const result = schema.safeParse(params);
  if (result.success) {
    return result.data;
  }

  console.warn("Invalid search parameters:", result.error.errors);
  return schema.parse({}); // Return defaults
}

/**
 * Project validation utility for protected routes
 * Returns a promise that resolves to the active project ID or redirects if none
 */
export async function requireActiveProject(): Promise<string> {
  // Use getState to avoid hook usage in non-component context
  const state = useProjectStore.getState();
  const projectId = state.activeProjectId;

  if (!projectId) {
    // Give a small delay to allow stores to sync if needed
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Check one more time after microtask
    const recheckProjectId = useProjectStore.getState().activeProjectId;
    if (!recheckProjectId) {
      throw redirect({ to: ROUTES.dashboard, search: { error: "no_project" } });
    }
    return recheckProjectId;
  }

  return projectId;
}

/**
 * Enhanced prefetching strategies with error handling and cache optimization
 */
export class PrefetchManager {
  constructor(private queryClient: QueryClient) {}

  /**
   * Prefetch dashboard statistics and recent activity
   */
  async prefetchDashboard(projectId: string): Promise<void> {
    const promises = [
      this.queryClient.prefetchQuery({
        queryKey: ["dashboard", "stats", projectId],
        queryFn: () => api.get<DashboardStats>(`/projects/${projectId}/dashboard/stats`),
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
      }),
      this.queryClient.prefetchQuery({
        queryKey: ["dashboard", "recent-bookings", projectId],
        queryFn: () =>
          api.get<Booking[]>(`/projects/${projectId}/bookings/recent`, {
            params: { limit: 5 },
          }),
        staleTime: 2 * 60 * 1000, // 2 minutes
        gcTime: 5 * 60 * 1000, // 5 minutes
      }),
      this.queryClient.prefetchQuery({
        queryKey: ["dashboard", "recent-expenses", projectId],
        queryFn: () =>
          api.get<Expense[]>(`/projects/${projectId}/expenses/recent`, {
            params: { limit: 5 },
          }),
        staleTime: 2 * 60 * 1000, // 2 minutes
        gcTime: 5 * 60 * 1000, // 5 minutes
      }),
    ];

    await Promise.allSettled(promises);
  }

  /**
   * Prefetch bookings list with search parameters
   */
  async prefetchBookings(projectId: string, searchParams: BookingsSearchParams): Promise<void> {
    const queryKey = ["bookings", "list", projectId, searchParams];

    await this.queryClient.prefetchQuery({
      queryKey,
      queryFn: () =>
        api.get<PaginatedResponse<Booking>>(`/projects/${projectId}/bookings`, {
          params: searchParams,
        }),
      staleTime: 3 * 60 * 1000, // 3 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    });

    // Also prefetch properties for booking creation
    if (!this.queryClient.getQueryData(["properties", "list", projectId])) {
      await this.prefetchPropertiesForBookings(projectId);
    }
  }

  /**
   * Prefetch individual booking with related data
   */
  async prefetchBooking(projectId: string, bookingId: string): Promise<void> {
    const promises = [
      this.queryClient.prefetchQuery({
        queryKey: ["bookings", "detail", projectId, bookingId],
        queryFn: () => api.get<Booking>(`/projects/${projectId}/bookings/${bookingId}`),
        staleTime: 2 * 60 * 1000, // 2 minutes
        gcTime: 5 * 60 * 1000, // 5 minutes
      }),
      this.queryClient.prefetchQuery({
        queryKey: ["bookings", "payments", projectId, bookingId],
        queryFn: () => api.get(`/projects/${projectId}/bookings/${bookingId}/payments`),
        staleTime: 2 * 60 * 1000, // 2 minutes
        gcTime: 5 * 60 * 1000, // 5 minutes
      }),
    ];

    await Promise.allSettled(promises);
  }

  /**
   * Prefetch properties list with search parameters
   */
  async prefetchProperties(projectId: string, searchParams: PropertiesSearchParams): Promise<void> {
    const queryKey = ["properties", "list", projectId, searchParams];

    await this.queryClient.prefetchQuery({
      queryKey,
      queryFn: () =>
        api.get<PaginatedResponse<Property>>(`/projects/${projectId}/properties`, {
          params: searchParams,
        }),
      staleTime: 5 * 60 * 1000, // 5 minutes (properties change less frequently)
      gcTime: 15 * 60 * 1000, // 15 minutes
    });
  }

  /**
   * Prefetch properties for booking forms (simplified data)
   */
  async prefetchPropertiesForBookings(projectId: string): Promise<void> {
    await this.queryClient.prefetchQuery({
      queryKey: ["properties", "list", projectId],
      queryFn: () =>
        api.get<Property[]>(`/projects/${projectId}/properties`, {
          params: { status: ["AVAILABLE"], fields: ["id", "name", "type", "capacity"] },
        }),
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
    });
  }

  /**
   * Prefetch individual property with related data
   */
  async prefetchProperty(projectId: string, propertyId: string): Promise<void> {
    const promises = [
      this.queryClient.prefetchQuery({
        queryKey: ["properties", "detail", projectId, propertyId],
        queryFn: () => api.get<Property>(`/projects/${projectId}/properties/${propertyId}`),
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 15 * 60 * 1000, // 15 minutes
      }),
      this.queryClient.prefetchQuery({
        queryKey: ["properties", "bookings", projectId, propertyId],
        queryFn: () =>
          api.get<Booking[]>(`/projects/${projectId}/properties/${propertyId}/bookings`, {
            params: { limit: 10, upcoming: true },
          }),
        staleTime: 3 * 60 * 1000, // 3 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
      }),
    ];

    await Promise.allSettled(promises);
  }

  /**
   * Prefetch expenses list with search parameters
   */
  async prefetchExpenses(projectId: string, searchParams: ExpensesSearchParams): Promise<void> {
    const queryKey = ["expenses", "list", projectId, searchParams];

    await this.queryClient.prefetchQuery({
      queryKey,
      queryFn: () =>
        api.get<PaginatedResponse<Expense>>(`/projects/${projectId}/expenses`, {
          params: searchParams,
        }),
      staleTime: 3 * 60 * 1000, // 3 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    });

    // Prefetch properties for expense forms if not already loaded
    if (!this.queryClient.getQueryData(["properties", "list", projectId])) {
      await this.prefetchPropertiesForExpenses(projectId);
    }
  }

  /**
   * Prefetch individual expense
   */
  async prefetchExpense(projectId: string, expenseId: string): Promise<void> {
    await this.queryClient.prefetchQuery({
      queryKey: ["expenses", "detail", projectId, expenseId],
      queryFn: () => api.get<Expense>(`/projects/${projectId}/expenses/${expenseId}`),
      staleTime: 2 * 60 * 1000, // 2 minutes
      gcTime: 5 * 60 * 1000, // 5 minutes
    });
  }

  /**
   * Prefetch properties for expense forms (simplified data)
   */
  async prefetchPropertiesForExpenses(projectId: string): Promise<void> {
    await this.queryClient.prefetchQuery({
      queryKey: ["properties", "list", projectId],
      queryFn: () =>
        api.get<Property[]>(`/projects/${projectId}/properties`, {
          params: { fields: ["id", "name", "type"] },
        }),
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
    });
  }

  /**
   * Prefetch reports data with search parameters
   */
  async prefetchReports(projectId: string, searchParams: ReportsSearchParams): Promise<void> {
    const { reportType, dateRange, startDate, endDate, propertyIds } = searchParams;

    const promises = [
      this.queryClient.prefetchQuery({
        queryKey: [
          "reports",
          reportType,
          projectId,
          { dateRange, startDate, endDate, propertyIds },
        ],
        queryFn: () =>
          api.get(`/projects/${projectId}/reports/${reportType}`, {
            params: { dateRange, startDate, endDate, propertyIds },
          }),
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 15 * 60 * 1000, // 15 minutes
      }),
      this.queryClient.prefetchQuery({
        queryKey: ["reports", "summary", projectId, { dateRange, startDate, endDate }],
        queryFn: () =>
          api.get(`/projects/${projectId}/reports/summary`, {
            params: { dateRange, startDate, endDate },
          }),
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 15 * 60 * 1000, // 15 minutes
      }),
    ];

    // Prefetch properties for filtering if not already loaded
    if (!this.queryClient.getQueryData(["properties", "list", projectId])) {
      promises.push(this.prefetchPropertiesForReports(projectId));
    }

    await Promise.allSettled(promises);
  }

  /**
   * Prefetch properties for reports (simplified data)
   */
  async prefetchPropertiesForReports(projectId: string): Promise<void> {
    await this.queryClient.prefetchQuery({
      queryKey: ["properties", "list", projectId],
      queryFn: () =>
        api.get<Property[]>(`/projects/${projectId}/properties`, {
          params: { fields: ["id", "name", "type", "status"] },
        }),
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
    });
  }

  /**
   * Prefetch team members
   */
  async prefetchTeam(projectId: string, searchParams: TeamSearchParams): Promise<void> {
    const queryKey = ["team", "members", projectId, searchParams];

    await this.queryClient.prefetchQuery({
      queryKey,
      queryFn: () =>
        api.get(`/projects/${projectId}/team`, {
          params: searchParams,
        }),
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 15 * 60 * 1000, // 15 minutes
    });
  }

  /**
   * Prefetch project settings
   */
  async prefetchProjectSettings(projectId: string): Promise<void> {
    const promises = [
      this.queryClient.prefetchQuery({
        queryKey: ["projects", "settings", projectId],
        queryFn: () => api.get(`/projects/${projectId}/settings`),
        staleTime: 10 * 60 * 1000, // 10 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes
      }),
      this.queryClient.prefetchQuery({
        queryKey: ["projects", "integrations", projectId],
        queryFn: () => api.get(`/projects/${projectId}/integrations`),
        staleTime: 10 * 60 * 1000, // 10 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes
      }),
    ];

    await Promise.allSettled(promises);
  }
}

/**
 * Route-level error boundary component with specific error handling
 */
export function RouteErrorBoundary({
  error,
  reset,
  info,
}: {
  error: Error;
  reset: () => void;
  info?: { componentStack: string };
}) {
  const isNetworkError = error.message.includes("fetch") || error.message.includes("network");
  const isAuthError = error.message.includes("401") || error.message.includes("Unauthorized");
  const isNotFoundError = error.message.includes("404") || error.message.includes("Not found");

  if (isAuthError) {
    // Clear auth state and redirect to login
    useAuthStore.getState().logout();
    window.location.href = "/login?reason=session_expired";
    return null;
  }

  return (
    <div className="flex min-h-[400px] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
            <svg
              className="h-6 w-6 text-red-600 dark:text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>

          <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">
            {isNetworkError
              ? "Connection Error"
              : isNotFoundError
                ? "Page Not Found"
                : "Something went wrong"}
          </h3>

          <p className="mt-2 text-sm text-red-700 dark:text-red-300">
            {isNetworkError
              ? "Please check your internet connection and try again."
              : isNotFoundError
                ? "The page you're looking for doesn't exist or has been moved."
                : "An unexpected error occurred while loading this page."}
          </p>

          {process.env.NODE_ENV === "development" && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-xs text-red-600 dark:text-red-400">
                Error Details (Development)
              </summary>
              <pre className="mt-2 overflow-auto rounded bg-red-100 p-2 text-xs text-red-800 dark:bg-red-900/40 dark:text-red-200">
                {error.message}
                {info?.componentStack && `\n\nComponent Stack:${info.componentStack}`}
              </pre>
            </details>
          )}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={reset}
              className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-red-900"
            >
              Try Again
            </button>
            {!isNotFoundError && (
              <button
                onClick={() => (window.location.href = ROUTES.dashboard)}
                className="flex-1 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none dark:border-red-600 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30 dark:focus:ring-offset-red-900"
              >
                Go to Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading fallback component for route suspense boundaries
 */
export function RouteLoadingFallback({ message }: { message?: string }) {
  return (
    <div className="flex min-h-[400px] items-center justify-center p-4">
      <div className="text-center">
        <div className="border-ocean-200 border-t-ocean-600 dark:border-ocean-800 dark:border-t-ocean-400 mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4" />
        <p className="text-sm text-gray-600 dark:text-gray-400">{message || "Loading..."}</p>
      </div>
    </div>
  );
}

/**
 * Higher-order function to create route loaders with consistent error handling
 */
export function createRouteLoader<T extends Record<string, any>>(
  loaderFn: (params: T) => Promise<any>
) {
  return async (params: T) => {
    try {
      return await loaderFn(params);
    } catch (error: any) {
      console.error("Route loader error:", error);

      // Handle specific error cases
      if (error.status === 401) {
        throw redirect({ to: ROUTES.login, search: { reason: "session_expired" } });
      }

      if (error.status === 403) {
        throw redirect({ to: ROUTES.dashboard, search: { error: "access_denied" } });
      }

      if (error.status === 404) {
        throw redirect({ to: ROUTES.dashboard, search: { error: "not_found" } });
      }

      // Re-throw other errors to be handled by error boundary
      throw error;
    }
  };
}
