import { lazy, Suspense } from "react";

import { createFileRoute, notFound } from "@tanstack/react-router";

import { DetailPageSkeleton } from "@/components/entity-detail/DetailPageSkeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuditRole, hasAuditRole } from "@/lib/audit-roles";
import { db, supabase } from "@/lib/supabase";

// Lazy load the detail page component
const ExpenseDetailPage = lazy(() =>
  import("@/components/expenses/ExpenseDetail").then((m) => ({
    default: m.ExpenseDetailPage,
  }))
);

export const Route = createFileRoute("/_authenticated/expenses/$expenseId/")({
  // Loader function to prefetch all necessary data
  loader: async ({ params, context }) => {
    const { expenseId } = params;
    const { queryClient } = context;

    // Prefetch expense data
    const expensePromise = queryClient.ensureQueryData({
      queryKey: ["expense", expenseId],
      queryFn: async () => {
        const { data, error } = await db.expenses.byId(expenseId);

        if (error) {
          console.error("[Expense Detail] Failed to fetch expense:", error);
          throw new Error(`Failed to load expense: ${error.message}`);
        }

        if (!data) {
          throw notFound();
        }

        return data;
      },
      staleTime: 30000, // 30 seconds
    });

    // Check if user has permission to view audit logs
    const canViewAudit = await hasAuditRole(AuditRole.MANAGER);

    // Prefetch audit logs only if user has permission
    const auditLogsPromise = canViewAudit
      ? queryClient.ensureQueryData({
          queryKey: ["auditLogs", "expense", expenseId],
          queryFn: async () => {
            const { data, error } = await supabase
              .from("audit_logs")
              .select("*")
              .eq("table_name", "expenses")
              .eq("record_id", expenseId)
              .order("created_at", { ascending: false })
              .limit(50);

            if (error) {
              console.error("[Expense Detail] Failed to fetch audit logs:", error);
              return [];
            }

            return data || [];
          },
          staleTime: 60000, // 1 minute
        })
      : Promise.resolve([]);

    // Wait for all data to be loaded
    const [expenseData, auditLogs] = await Promise.all([expensePromise, auditLogsPromise]);

    // Extend expense with optional fields for type compatibility
    // Note: unit_id, created_by fields not yet in database schema (Phase 3)
    const expense = {
      ...expenseData,
      unit: undefined as unknown,
      unit_id: undefined as string | undefined,
      created_by: undefined as string | undefined,
      created_by_name: undefined as string | undefined,
    } as typeof expenseData & {
      unit?: unknown;
      unit_id?: string;
      created_by?: string;
      created_by_name?: string;
    };

    return {
      expense,
      auditLogs,
      canViewAudit,
    };
  },

  // Error component for failed data loading
  errorComponent: ({ error }) => (
    <ErrorBoundary level="page">
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-red-600">Failed to Load Expense</h1>
          <p className="mb-4 text-gray-600">
            {error instanceof Error ? error.message : "An unexpected error occurred"}
          </p>
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
          The expense you are looking for does not exist or has been removed.
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
  component: ExpenseDetailComponent,
});

function ExpenseDetailComponent() {
  const { expenseId } = Route.useParams();
  const { expense } = Route.useLoaderData();

  return (
    <ErrorBoundary level="page">
      <Suspense fallback={<DetailPageSkeleton />}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <ExpenseDetailPage expense={expense as any} expenseId={expenseId} />
      </Suspense>
    </ErrorBoundary>
  );
}
