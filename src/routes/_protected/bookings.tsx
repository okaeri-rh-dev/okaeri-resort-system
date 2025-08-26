import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { queryClient } from "@/lib/query-client";
import {
  PrefetchManager,
  RouteErrorBoundary,
  RouteLoadingFallback,
  createRouteLoader,
  requireActiveProject,
} from "@/lib/route-utils";
import {
  BookingsSearchSchema,
  type BookingsSearchParams,
  validateSearchParams,
} from "@/types/route-params";
import {
  createLazyRoute,
  routeTransitionManager,
  performanceBudgetManager,
} from "@/lib/route-optimization";
import { useNavigationStore } from "@/lib/store-router-integration";

// Lazy load BookingsPage with intelligent prefetching
const BookingsPage = createLazyRoute(
  () => import("@/pages/BookingsPage").then((m) => ({ default: m.BookingsPage })),
  "bookings",
  {
    onHover: true,
    delay: 200,
    priority: "high",
  }
);

// Initialize prefetch manager
const prefetcher = new PrefetchManager(queryClient);

// Enhanced bookings loader with search parameter validation
const bookingsLoader = createRouteLoader<{
  search: BookingsSearchParams;
}>(async ({ search }) => {
  const projectId = requireActiveProject();
  const searchParams = validateSearchParams(BookingsSearchSchema, search);

  // Prefetch bookings with search parameters
  await prefetcher.prefetchBookings(projectId, searchParams);

  return { projectId, searchParams };
});

export const Route = createFileRoute("/_protected/bookings")({
  validateSearch: BookingsSearchSchema,

  beforeLoad: ({ search, location, context }) => {
    const loadStart = performance.now();

    // Auth is already validated by _protected layout
    const user = context.user;

    // Validate search parameters early
    const validatedSearch = validateSearchParams(BookingsSearchSchema, search);

    // Queue smart prefetch based on current context
    const navigationStore = useNavigationStore.getState();

    // Likely next navigation paths from bookings
    navigationStore.queuePrefetch("/_protected/properties", 8); // Often need to check property details
    navigationStore.queuePrefetch("/_protected/expenses", 6); // Track booking-related expenses
    navigationStore.queuePrefetch("/_protected/dashboard", 5); // Return to overview

    // Track performance
    const loadEnd = performance.now();
    performanceBudgetManager.checkBudget("routeLoadTime", loadEnd - loadStart, location.pathname);

    return {
      validatedSearch,
      user,
      isBookingsPage: true,
    };
  },

  loader: bookingsLoader,

  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary error={error} reset={reset} info={{ componentStack: "Bookings Route" }} />
  ),

  pendingComponent: () => <RouteLoadingFallback message="Loading bookings..." />,

  component: () => (
    <div data-route-container className="route-container">
      <Suspense fallback={<RouteLoadingFallback message="Loading bookings..." />}>
        <div className="route-enter">
          <BookingsPage />
        </div>
      </Suspense>
    </div>
  ),
});
