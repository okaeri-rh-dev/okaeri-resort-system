import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { queryClient } from "@/lib/query-client";
import { api } from "@/lib/api-client";
import { SettingsPage } from "@/pages/SettingsPage";
import { RouteErrorBoundary, RouteLoadingFallback, createRouteLoader } from "@/lib/route-utils";
import {
  SettingsSearchSchema,
  type SettingsSearchParams,
  validateSearchParams,
} from "@/types/route-params";

// Settings loader - no project dependency required for account settings
const settingsLoader = createRouteLoader<{
  search: SettingsSearchParams;
}>(async ({ search }) => {
  const searchParams = validateSearchParams(SettingsSearchSchema, search);

  // Prefetch user settings and preferences
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: ["user", "settings"],
      queryFn: () => api.get("/user/settings"),
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
    }),
    queryClient.prefetchQuery({
      queryKey: ["user", "billing"],
      queryFn: () => api.get("/user/billing"),
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 15 * 60 * 1000, // 15 minutes
    }),
    queryClient.prefetchQuery({
      queryKey: ["user", "security"],
      queryFn: () => api.get("/user/security"),
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 15 * 60 * 1000, // 15 minutes
    }),
  ]);

  return { searchParams };
});

export const Route = createFileRoute("/_protected/settings")({
  validateSearch: SettingsSearchSchema,

  beforeLoad: ({ search }) => {
    // Validate search parameters early
    const validatedSearch = validateSearchParams(SettingsSearchSchema, search);
    return { validatedSearch };
  },

  loader: settingsLoader,

  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary error={error} reset={reset} info={{ componentStack: "Settings Route" }} />
  ),

  pendingComponent: () => <RouteLoadingFallback message="Loading settings..." />,

  component: () => (
    <Suspense fallback={<RouteLoadingFallback message="Loading user settings..." />}>
      <SettingsPage />
    </Suspense>
  ),
});
