import { lazy, Suspense } from "react";

import { createFileRoute } from "@tanstack/react-router";

import { DetailPageSkeleton } from "@/components/entity-detail/DetailPageSkeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuditRole, hasAuditRole } from "@/lib/audit-roles";
import { expenseDetailQuery } from "@/stores/useExpenseStore";
import { allUnitsQuery } from "@/stores/useUnitStore";

// Lazy load the edit page component
const ExpenseEditPage = lazy(() =>
  import("@/components/expenses/ExpenseEdit").then((m) => ({
    default: m.ExpenseEditPage,
  }))
);

export const Route = createFileRoute("/admin/expenses/$expenseId/edit")({
  // Before load - check permissions (manager or higher)
  beforeLoad: async () => {
    // Check if user has permission to edit expenses (Manager or higher)
    // Note: The expenses table doesn't have created_by field in current schema
    const canEdit = await hasAuditRole(AuditRole.MANAGER);

    if (!canEdit) {
      throw new Error("You do not have permission to edit expenses. Manager role required.");
    }

    return { canEdit: true };
  },

  // Loader function to prefetch all necessary data
  loader: async ({ params, context }) => {
    const { expenseId } = params;
    const { queryClient } = context;

    const expensePromise = queryClient.ensureQueryData(expenseDetailQuery(expenseId));

    // Prefetch all units for the unit selector
    const unitsPromise = queryClient.ensureQueryData(allUnitsQuery());

    // Wait for all data to be loaded
    const [expense, units] = await Promise.all([expensePromise, unitsPromise]);

    return {
      expense,
      units,
    };
  },

  // Error component for failed data loading
  errorComponent: ({ error }) => (
    <ErrorBoundary level="page">
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-red-600">Failed to Load Expense Editor</h1>
          <p className="mb-4 text-gray-600">
            {error instanceof Error ? error.message : "An unexpected error occurred"}
          </p>
          {error instanceof Error && error.message.includes("permission") ? (
            <p className="mb-4 text-sm text-gray-500">
              Only the expense creator or managers can edit expenses.
            </p>
          ) : null}
          {error instanceof Error && error.message.includes("Authentication") ? (
            <p className="mb-4 text-sm text-gray-500">Please sign in to edit expenses.</p>
          ) : null}
          <button
            onClick={() => window.history.back()}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    </ErrorBoundary>
  ),

  // Not found component
  notFoundComponent: () => (
    <div className="container mx-auto py-8">
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-bold text-gray-800">Expense Not Found</h1>
        <p className="mb-4 text-gray-600">
          The expense you are trying to edit does not exist or has been removed.
        </p>
        <button
          onClick={() => window.history.back()}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Go Back to Expenses
        </button>
      </div>
    </div>
  ),

  // Pending component while data is loading
  pendingComponent: () => <DetailPageSkeleton />,

  // Main component
  component: ExpenseEditComponent,
});

function ExpenseEditComponent() {
  return (
    <ErrorBoundary level="page">
      <Suspense fallback={<DetailPageSkeleton />}>
        <ExpenseEditPage />
      </Suspense>
    </ErrorBoundary>
  );
}
