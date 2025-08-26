import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { queryClient } from "@/lib/query-client";
import { PropertiesPage } from "@/pages/PropertiesPage";
import {
  PrefetchManager,
  RouteErrorBoundary,
  RouteLoadingFallback,
  createRouteLoader,
  requireActiveProject,
} from "@/lib/route-utils";
import {
  PropertiesSearchSchema,
  type PropertiesSearchParams,
  validateSearchParams,
} from "@/types/route-params";

// Initialize prefetch manager
const prefetcher = new PrefetchManager(queryClient);

// Enhanced properties loader with search parameter validation
const propertiesLoader = createRouteLoader<{
  search: PropertiesSearchParams;
}>(async ({ search }) => {
  const projectId = requireActiveProject();
  const searchParams = validateSearchParams(PropertiesSearchSchema, search);

  // Prefetch properties with search parameters
  await prefetcher.prefetchProperties(projectId, searchParams);

  return { projectId, searchParams };
});

export const Route = createFileRoute("/_protected/properties")({
  validateSearch: PropertiesSearchSchema,

  beforeLoad: ({ search }) => {
    // Validate search parameters early
    const validatedSearch = validateSearchParams(PropertiesSearchSchema, search);
    return { validatedSearch };
  },

  loader: propertiesLoader,

  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary error={error} reset={reset} info={{ componentStack: "Properties Route" }} />
  ),

  pendingComponent: () => <RouteLoadingFallback message="Loading properties..." />,

  component: () => (
    <Suspense fallback={<RouteLoadingFallback message="Loading properties list..." />}>
      <PropertiesPage />
    </Suspense>
  ),
});
