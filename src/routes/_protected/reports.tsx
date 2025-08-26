import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { queryClient } from "@/lib/query-client";
import { ReportsPage } from "@/pages/ReportsPage";
import {
  PrefetchManager,
  RouteErrorBoundary,
  RouteLoadingFallback,
  createRouteLoader,
  requireActiveProject,
} from "@/lib/route-utils";
import {
  ReportsSearchSchema,
  type ReportsSearchParams,
  validateSearchParams,
} from "@/types/route-params";

// Initialize prefetch manager
const prefetcher = new PrefetchManager(queryClient);

// Enhanced reports loader with search parameter validation
const reportsLoader = createRouteLoader<{
  search: ReportsSearchParams;
}>(async ({ search }) => {
  const projectId = requireActiveProject();
  const searchParams = validateSearchParams(ReportsSearchSchema, search);

  // Prefetch reports data with search parameters
  await prefetcher.prefetchReports(projectId, searchParams);

  return { projectId, searchParams };
});

export const Route = createFileRoute("/_protected/reports")({
  validateSearch: ReportsSearchSchema,

  beforeLoad: ({ search }) => {
    // Validate search parameters early
    const validatedSearch = validateSearchParams(ReportsSearchSchema, search);
    return { validatedSearch };
  },

  loader: reportsLoader,

  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary error={error} reset={reset} info={{ componentStack: "Reports Route" }} />
  ),

  pendingComponent: () => <RouteLoadingFallback message="Loading reports..." />,

  component: () => (
    <Suspense fallback={<RouteLoadingFallback message="Loading reports data..." />}>
      <ReportsPage />
    </Suspense>
  ),
});
