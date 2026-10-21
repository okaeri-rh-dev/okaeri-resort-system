import { lazy, Suspense, useState } from "react";

import { createFileRoute, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { z } from "zod";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/patterns";
import { requireManager } from "@/lib/route-guards";
import type { Expense } from "@/types";

// Lazy load components for better performance
const ExpensesTable = lazy(() =>
  import("@/components/expenses/ExpensesTable").then((m) => ({ default: m.ExpensesTable }))
);
const ExpenseForm = lazy(() =>
  import("@/components/expenses/ExpenseForm").then((m) => ({ default: m.ExpenseForm }))
);

const expensesSearchSchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  page: z.number().optional(),
});

export const Route = createFileRoute("/admin/expenses")({
  beforeLoad: async () => {
    await requireManager();
  },
  validateSearch: expensesSearchSchema,
  component: ExpensesPage,
});

function ExpensesPage() {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isDetailView = !!(params as any).expenseId;
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  // Navigate to dedicated detail and edit routes instead of using modals
  const handleEditExpense = (expense: Expense) => {
    navigate({ to: "/admin/expenses/$expenseId/edit", params: { expenseId: expense.expense_id } });
  };

  const handleViewExpense = (expense: Expense) => {
    navigate({ to: "/admin/expenses/$expenseId", params: { expenseId: expense.expense_id } });
  };

  // If we're viewing a specific expense detail, render the child route
  if (isDetailView) {
    return (
      <ErrorBoundary level="page">
        <Outlet />
      </ErrorBoundary>
    );
  }

  // Otherwise, render the expenses table page
  return (
    <ErrorBoundary level="page">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
            <p className="text-muted-foreground">Track and manage business expenses</p>
          </div>
          <Button onClick={() => setShowExpenseForm(true)}>Add Expense</Button>
        </div>

        <ErrorBoundary level="component">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-12">
                <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
              </div>
            }
          >
            <ExpensesTable onViewExpense={handleViewExpense} onEditExpense={handleEditExpense} />
          </Suspense>
        </ErrorBoundary>

        {/* New Expense Dialog */}
        <Dialog open={showExpenseForm} onOpenChange={setShowExpenseForm}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Expense</DialogTitle>
              <DialogDescription>
                Fill in the details below to record a new business expense.
              </DialogDescription>
            </DialogHeader>
            <ErrorBoundary level="component">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-12">
                    <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
                  </div>
                }
              >
                <ExpenseForm
                  onSuccess={() => setShowExpenseForm(false)}
                  onCancel={() => setShowExpenseForm(false)}
                />
              </Suspense>
            </ErrorBoundary>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}
