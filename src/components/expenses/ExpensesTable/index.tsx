import { withErrorBoundary } from "@/components/ErrorBoundary";
import {
  Card,
  DataTable,
  TableEmptyState,
  TablePagination,
  TableSkeleton,
} from "@/components/patterns";
import { cn } from "@/lib/utils";

import { DeleteExpenseDialog } from "./components/DeleteExpenseDialog";
import { ExpenseCard } from "./components/ExpenseCard";
import { ExpenseFilters } from "./components/ExpenseFilters";
import { useExpensesTable } from "./hooks/useExpensesTable";
import type { ExpensesTableProps } from "./types";

function ExpensesTableComponent({ onViewExpense, onEditExpense, className }: ExpensesTableProps) {
  const {
    table,
    expenses,
    totalUnfilteredCount,
    isLoading,
    error,
    filters,
    setFilters,
    searchQuery,
    setSearchQuery,
    resetFilters,
    handleExport,
    handleDelete,
    confirmDelete,
    exportExpenses,
    // Delete dialog state
    deleteDialogOpen,
    setDeleteDialogOpen,
    expenseToDelete,
    isDeleting,
  } = useExpensesTable({ onViewExpense, onEditExpense });

  // Determine empty state type
  const isEmptyDatabase = totalUnfilteredCount === 0;

  if (isLoading) {
    return <TableSkeleton rows={8} columns={6} toolbar pagination label="Loading expenses" />;
  }

  if (error) {
    return (
      <Card padding="lg">
        <div className="text-center">
          <p className="text-destructive">Failed to load expenses</p>
          <p className="text-muted-foreground mt-2 text-sm">{error.message}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Filters Section - Nested in its own card */}
      <ExpenseFilters
        filters={filters}
        setFilters={setFilters}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        resetFilters={resetFilters}
        onExport={handleExport}
        isExporting={exportExpenses.isPending}
        totalCount={expenses.length}
      />

      <DataTable
        table={table}
        label="Expenses"
        renderCard={(row) => (
          <ExpenseCard
            expense={row.original}
            onView={() => onViewExpense?.(row.original)}
            onEdit={() => onEditExpense?.(row.original)}
            onDelete={() => handleDelete(row.original)}
          />
        )}
        emptyState={
          isEmptyDatabase ? (
            <TableEmptyState
              title="No expenses yet"
              description="Create your first expense to start tracking your business costs."
              variant="no-data"
            />
          ) : (
            <TableEmptyState
              title="No expenses found"
              description="No expenses match your current filters. Try adjusting your search criteria."
              variant="no-results"
              action={{
                label: "Clear Filters",
                onClick: resetFilters,
              }}
            />
          )
        }
      />
      {expenses.length > 0 && <TablePagination table={table} totalItems={expenses.length} />}

      {/* Delete Confirmation Dialog */}
      <DeleteExpenseDialog
        expense={expenseToDelete}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}

// Export with error boundary
export const ExpensesTable = withErrorBoundary(ExpensesTableComponent, {
  level: "component",
});

// Re-export types
export type { ExpensesTableProps } from "./types";
