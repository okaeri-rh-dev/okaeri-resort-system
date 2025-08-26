import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { queryClient } from "@/lib/query-client";
import { ProjectSettingsPage } from "@/pages/ProjectSettingsPage";
import {
  PrefetchManager,
  RouteErrorBoundary,
  RouteLoadingFallback,
  createRouteLoader,
  requireActiveProject,
} from "@/lib/route-utils";
import {
  ProjectSettingsSearchSchema,
  type ProjectSettingsSearchParams,
  validateSearchParams,
} from "@/types/route-params";

// Initialize prefetch manager
const prefetcher = new PrefetchManager(queryClient);

// Enhanced project settings loader with comprehensive prefetching
const projectSettingsLoader = createRouteLoader<{
  search: ProjectSettingsSearchParams;
}>(async ({ search }) => {
  const projectId = requireActiveProject();
  const searchParams = validateSearchParams(ProjectSettingsSearchSchema, search);

  // Prefetch project settings and related data
  await prefetcher.prefetchProjectSettings(projectId);

  return { projectId, searchParams };
});

export const Route = createFileRoute("/_protected/settings/project")({
  validateSearch: ProjectSettingsSearchSchema,

  beforeLoad: ({ search }) => {
    // Validate search parameters early
    const validatedSearch = validateSearchParams(ProjectSettingsSearchSchema, search);
    return { validatedSearch };
  },

  loader: projectSettingsLoader,

  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary
      error={error}
      reset={reset}
      info={{ componentStack: "Project Settings Route" }}
    />
  ),

  pendingComponent: () => <RouteLoadingFallback message="Loading project settings..." />,

  component: () => (
    <Suspense fallback={<RouteLoadingFallback message="Loading project configuration..." />}>
      <ProjectSettingsPage />
    </Suspense>
  ),
});
