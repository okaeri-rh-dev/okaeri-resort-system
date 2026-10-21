import { lazy, Suspense } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { DetailPageSkeleton } from "@/components/entity-detail/DetailPageSkeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/patterns";
import { recentRecordAuditLogsQuery } from "@/lib/audit-hooks";
import { AuditRole, hasAuditRole } from "@/lib/audit-roles";
import { expenseDetailQuery } from "@/stores/useExpenseStore";

// Lazy load the detail page component
const ExpenseDetailPage = lazy(() =>
  import("@/components/expenses/ExpenseDetail").then((m) => ({
    default: m.ExpenseDetailPage,
  }))
);

export const Route = createFileRoute("/admin/expenses/$expenseId/")({
  // Loader function to prefetch all necessary data
  loader: async ({ params, context }) => {
    const { expenseId } = params;
    const { queryClient } = context;

    const expensePromise = queryClient.ensureQueryData(expenseDetailQuery(expenseId));

    // Check if user has permission to view audit logs
    const canViewAudit = await hasAuditRole(AuditRole.MANAGER);

    // Prefetch audit logs only if user has permission
    const auditLogsPromise = canViewAudit
      ? queryClient.ensureQueryData(recentRecordAuditLogsQuery("expenses", expenseId))
      : Promise.resolve([]);

    const [, auditLogs] = await Promise.all([expensePromise, auditLogsPromise]);

    return {
      auditLogs,
      canViewAudit,
    };
  },

  // Error component for failed data loading
  errorComponent: ({ error }) => (
    <ErrorBoundary level="page">
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-destructive mb-4 text-2xl font-bold">Failed to Load Expense</h1>
          <p className="text-muted-foreground mb-4">
            {error instanceof Error ? error.message : "An unexpected error occurred"}
          </p>
          <Button onClick={() => window.history.back()}>Go Back</Button>
        </div>
      </div>
    </ErrorBoundary>
  ),

  // Not found component
  notFoundComponent: () => (
    <div className="container mx-auto py-8">
      <div className="text-center">
        <h1 className="text-foreground mb-4 text-2xl font-bold">Expense Not Found</h1>
        <p className="text-muted-foreground mb-4">
          The expense you are looking for does not exist or has been removed.
        </p>
        <Button onClick={() => window.history.back()}>Go Back to Expenses</Button>
      </div>
    </div>
  ),

  // Pending component while data is loading
  pendingComponent: () => <DetailPageSkeleton />,

  // Main component
  component: ExpenseDetailComponent,
});

function ExpenseDetailComponent() {
  const { expenseId } = Route.useParams();
  const { data: expense } = useSuspenseQuery(expenseDetailQuery(expenseId));

  return (
    <ErrorBoundary level="page">
      <Suspense fallback={<DetailPageSkeleton />}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <ExpenseDetailPage expense={expense as any} expenseId={expenseId} />
      </Suspense>
    </ErrorBoundary>
  );
}
