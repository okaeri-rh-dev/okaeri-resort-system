import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { queryClient } from "@/lib/query-client";
import { PropertyDetailPage } from "@/pages/PropertyDetailPage";
import {
  PrefetchManager,
  RouteErrorBoundary,
  RouteLoadingFallback,
  createRouteLoader,
  requireActiveProject,
} from "@/lib/route-utils";
import {
  PropertyParamsSchema,
  PropertySearchSchema,
  type PropertyParams,
  type PropertySearchParams,
  validateSearchParams,
  validateRouteParams,
} from "@/types/route-params";

// Initialize prefetch manager
const prefetcher = new PrefetchManager(queryClient);

// Enhanced property detail loader with comprehensive prefetching
const propertyDetailLoader = createRouteLoader<{
  params: PropertyParams;
  search: PropertySearchParams;
}>(async ({ params, search }) => {
  const projectId = requireActiveProject();
  const { propertyId } = validateRouteParams(PropertyParamsSchema, params);
  const searchParams = validateSearchParams(PropertySearchSchema, search);

  // Prefetch property details and related data
  await prefetcher.prefetchProperty(projectId, propertyId);

  return { projectId, propertyId, searchParams };
});

export const Route = createFileRoute("/_protected/properties/$propertyId")({
  parseParams: (params) => ({
    propertyId: params.propertyId as string,
  }),

  validateSearch: PropertySearchSchema,

  beforeLoad: ({ params, search }) => {
    // Validate route and search parameters early
    const validatedParams = validateRouteParams(PropertyParamsSchema, params);
    const validatedSearch = validateSearchParams(PropertySearchSchema, search);
    return { validatedParams, validatedSearch };
  },

  loader: propertyDetailLoader,

  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary
      error={error}
      reset={reset}
      info={{ componentStack: "Property Detail Route" }}
    />
  ),

  pendingComponent: () => <RouteLoadingFallback message="Loading property details..." />,

  component: () => (
    <Suspense fallback={<RouteLoadingFallback message="Loading property..." />}>
      <PropertyDetailPage />
    </Suspense>
  ),
});
