import { createFileRoute } from "@tanstack/react-router";
import { useState, lazy, Suspense } from "react";

// Lazy load components for better performance
const ExpensesTable = lazy(() =>
  import("@/components/expenses/ExpensesTable").then((m) => ({ default: m.ExpensesTable }))
);
const ExpenseForm = lazy(() =>
  import("@/components/expenses/ExpenseForm").then((m) => ({ default: m.ExpenseForm }))
);
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { z } from "zod";
import type { Expense } from "@/types";

const expensesSearchSchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  page: z.number().optional(),
});

export const Route = createFileRoute("/_authenticated/expenses")({
  validateSearch: expensesSearchSchema,
  component: ExpensesPage,
});

function ExpensesPage() {
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setShowEditDialog(true);
  };

  const handleViewExpense = (expense: Expense) => {
    // Future: Could open a detailed view dialog
    console.log("View expense:", expense);
  };

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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            }
          >
            <ExpensesTable onViewExpense={handleViewExpense} onEditExpense={handleEditExpense} />
          </Suspense>
        </ErrorBoundary>

        {/* New Expense Dialog */}
        <Dialog open={showExpenseForm} onOpenChange={setShowExpenseForm}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Expense</DialogTitle>
            </DialogHeader>
            <ErrorBoundary level="component">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
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

        {/* Edit Expense Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Expense</DialogTitle>
            </DialogHeader>
            <ErrorBoundary level="component">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                  </div>
                }
              >
                {editingExpense && (
                  <ExpenseForm
                    expense={editingExpense}
                    onSuccess={() => {
                      setShowEditDialog(false);
                      setEditingExpense(null);
                    }}
                    onCancel={() => {
                      setShowEditDialog(false);
                      setEditingExpense(null);
                    }}
                  />
                )}
              </Suspense>
            </ErrorBoundary>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}
