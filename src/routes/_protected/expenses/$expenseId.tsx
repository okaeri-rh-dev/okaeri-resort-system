import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { queryClient } from "@/lib/query-client";
import { ExpenseDetailPage } from "@/pages/ExpenseDetailPage";
import {
  PrefetchManager,
  RouteErrorBoundary,
  RouteLoadingFallback,
  createRouteLoader,
  requireActiveProject,
} from "@/lib/route-utils";
import {
  ExpenseParamsSchema,
  ExpenseSearchSchema,
  type ExpenseParams,
  type ExpenseSearchParams,
  validateSearchParams,
  validateRouteParams,
} from "@/types/route-params";

// Initialize prefetch manager
const prefetcher = new PrefetchManager(queryClient);

// Enhanced expense detail loader with comprehensive prefetching
const expenseDetailLoader = createRouteLoader<{
  params: ExpenseParams;
  search: ExpenseSearchParams;
}>(async ({ params, search }) => {
  const projectId = await requireActiveProject();
  const { expenseId } = validateRouteParams(ExpenseParamsSchema, params);
  const searchParams = validateSearchParams(ExpenseSearchSchema, search);

  // Prefetch expense details
  await prefetcher.prefetchExpense(projectId, expenseId);

  return { projectId, expenseId, searchParams };
});

export const Route = createFileRoute("/_protected/expenses/$expenseId")({
  parseParams: (params) => ({
    expenseId: params.expenseId as string,
  }),

  validateSearch: ExpenseSearchSchema,

  beforeLoad: ({ params, search }) => {
    // Validate route and search parameters early
    const validatedParams = validateRouteParams(ExpenseParamsSchema, params);
    const validatedSearch = validateSearchParams(ExpenseSearchSchema, search);
    return { validatedParams, validatedSearch };
  },

  loader: expenseDetailLoader,

  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary
      error={error}
      reset={reset}
      info={{ componentStack: "Expense Detail Route" }}
    />
  ),

  pendingComponent: () => <RouteLoadingFallback message="Loading expense details..." />,

  component: () => (
    <Suspense fallback={<RouteLoadingFallback message="Loading expense..." />}>
      <ExpenseDetailPage />
    </Suspense>
  ),
});
