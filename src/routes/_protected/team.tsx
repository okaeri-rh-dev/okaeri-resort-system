import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { queryClient } from "@/lib/query-client";
import { TeamPage } from "@/pages/TeamPage";
import {
  PrefetchManager,
  RouteErrorBoundary,
  RouteLoadingFallback,
  createRouteLoader,
  requireActiveProject,
} from "@/lib/route-utils";
import {
  TeamSearchSchema,
  type TeamSearchParams,
  validateSearchParams,
} from "@/types/route-params";

// Initialize prefetch manager
const prefetcher = new PrefetchManager(queryClient);

// Enhanced team loader with search parameter validation
const teamLoader = createRouteLoader<{
  search: TeamSearchParams;
}>(async ({ search }) => {
  const projectId = await requireActiveProject();
  const searchParams = validateSearchParams(TeamSearchSchema, search);

  // Prefetch team members with search parameters
  await prefetcher.prefetchTeam(projectId, searchParams);

  return { projectId, searchParams };
});

export const Route = createFileRoute("/_protected/team")({
  validateSearch: TeamSearchSchema,

  beforeLoad: ({ search }) => {
    // Validate search parameters early
    const validatedSearch = validateSearchParams(TeamSearchSchema, search);
    return { validatedSearch };
  },

  loader: teamLoader,

  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary error={error} reset={reset} info={{ componentStack: "Team Route" }} />
  ),

  pendingComponent: () => <RouteLoadingFallback message="Loading team members..." />,

  component: () => (
    <Suspense fallback={<RouteLoadingFallback message="Loading team..." />}>
      <TeamPage />
    </Suspense>
  ),
});
