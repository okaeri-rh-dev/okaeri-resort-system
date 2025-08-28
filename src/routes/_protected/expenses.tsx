import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { queryClient } from "@/lib/query-client";
import { ExpensesPage } from "@/pages/ExpensesPage";
import {
  PrefetchManager,
  RouteErrorBoundary,
  RouteLoadingFallback,
  createRouteLoader,
  requireActiveProject,
} from "@/lib/route-utils";
import {
  ExpensesSearchSchema,
  type ExpensesSearchParams,
  validateSearchParams,
} from "@/types/route-params";

// Initialize prefetch manager
const prefetcher = new PrefetchManager(queryClient);

// Enhanced expenses loader with search parameter validation
const expensesLoader = createRouteLoader<{
  search: ExpensesSearchParams;
}>(async ({ search }) => {
  const projectId = await requireActiveProject();
  const searchParams = validateSearchParams(ExpensesSearchSchema, search);

  // Prefetch expenses with search parameters
  await prefetcher.prefetchExpenses(projectId, searchParams);

  return { projectId, searchParams };
});

export const Route = createFileRoute("/_protected/expenses")({
  validateSearch: ExpensesSearchSchema,

  beforeLoad: ({ search }) => {
    // Validate search parameters early
    const validatedSearch = validateSearchParams(ExpensesSearchSchema, search);
    return { validatedSearch };
  },

  loader: expensesLoader,

  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary error={error} reset={reset} info={{ componentStack: "Expenses Route" }} />
  ),

  pendingComponent: () => <RouteLoadingFallback message="Loading expenses..." />,

  component: () => (
    <Suspense fallback={<RouteLoadingFallback message="Loading expenses list..." />}>
      <ExpensesPage />
    </Suspense>
  ),
});
