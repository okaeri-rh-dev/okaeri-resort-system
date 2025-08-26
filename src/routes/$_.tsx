import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { RouteErrorBoundary, RouteLoadingFallback } from "@/lib/route-utils";
import { ErrorSearchSchema, type ErrorSearchParams } from "@/types/route-params";

export const Route = createFileRoute("/$_")({
  validateSearch: ErrorSearchSchema,

  beforeLoad: ({ search, location }) => {
    // Log 404 for analytics
    console.warn(`404: ${location.pathname} not found`);

    return {
      searchParams: search as ErrorSearchParams,
      originalPath: location.pathname,
    };
  },

  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary error={error} reset={reset} info={{ componentStack: "404 Route" }} />
  ),

  pendingComponent: () => <RouteLoadingFallback message="Loading..." />,

  component: () => (
    <Suspense fallback={<RouteLoadingFallback />}>
      <NotFoundPage />
    </Suspense>
  ),
});
