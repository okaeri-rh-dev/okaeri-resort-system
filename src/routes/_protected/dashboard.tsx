import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { RouteErrorBoundary, RouteLoadingFallback } from "@/lib/route-utils";
import { dashboardLoader } from "@/lib/route-loaders";
import { DashboardSearchSchema } from "@/types/route-params";
import { useNavigationStore } from "@/lib/store-router-integration";
import {
  createLazyRoute,
  routeTransitionManager,
  performanceBudgetManager,
} from "@/lib/route-optimization";

// Lazy load DashboardPage with performance tracking
const DashboardPage = createLazyRoute(
  () => import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
  "dashboard",
  {
    onViewport: true,
    priority: "high",
  }
);

export const Route = createFileRoute("/_protected/dashboard")({
  validateSearch: DashboardSearchSchema,

  beforeLoad: ({ search, location }) => {
    const loadStart = performance.now();

    // Queue intelligent prefetch for likely next routes
    const navigationStore = useNavigationStore.getState();

    // High priority prefetch for frequently accessed routes from dashboard
    navigationStore.queuePrefetch("/bookings", 9);
    navigationStore.queuePrefetch("/properties", 8);
    navigationStore.queuePrefetch("/expenses", 7);

    // Lower priority prefetch for settings routes
    navigationStore.queuePrefetch("/reports", 5);
    navigationStore.queuePrefetch("/team", 4);

    // Track navigation performance
    const loadEnd = performance.now();
    performanceBudgetManager.checkBudget("routeLoadTime", loadEnd - loadStart, location.pathname);

    return { search };
  },

  loader: dashboardLoader,

  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary error={error} reset={reset} info={{ componentStack: "Dashboard Route" }} />
  ),

  pendingComponent: () => <RouteLoadingFallback message="Loading dashboard data..." />,

  component: () => (
    <div data-route-container className="route-container">
      <Suspense fallback={<RouteLoadingFallback message="Loading dashboard..." />}>
        <div className="route-enter">
          <DashboardPage />
        </div>
      </Suspense>
    </div>
  ),

  onLeave: () => {
    // Cleanup route state when navigating away
    const { routeStateManager } = require("@/lib/store-router-integration");
    routeStateManager.cleanupRoute("/dashboard");
  },
});
