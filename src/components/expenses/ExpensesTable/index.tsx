import { flexRender } from "@tanstack/react-table";

import { withErrorBoundary } from "@/components/ErrorBoundary";
import { ExpensesTableSkeleton } from "@/components/skeletons";
import { ResponsiveTable, TableEmptyState, TablePagination } from "@/components/tables/utils";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { ExpenseCard } from "./components/ExpenseCard";
import { ExpenseFilters } from "./components/ExpenseFilters";
import { useExpensesTable } from "./hooks/useExpensesTable";
import type { ExpensesTableProps } from "./types";

function ExpensesTableComponent({ onViewExpense, onEditExpense, className }: ExpensesTableProps) {
  const {
    table,
    expenses,
    isLoading,
    error,
    isMobile,
    filters,
    setFilters,
    searchQuery,
    setSearchQuery,
    resetFilters,
    handleExport,
    handleDelete,
    exportExpenses,
  } = useExpensesTable({ onViewExpense, onEditExpense });

  if (isLoading) {
    return <ExpensesTableSkeleton />;
  }

  if (error) {
    return (
      <Card className="border-neutral-200 p-8">
        <div className="text-center">
          <p className="text-red-600">Failed to load expenses</p>
          <p className="mt-2 text-sm text-neutral-600">{error.message}</p>
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

      {/* Table Section - Nested in card for desktop, cards for mobile */}
      {isMobile ? (
        <div className="space-y-3">
          {expenses.map((expense) => (
            <ExpenseCard
              key={expense.expense_id}
              expense={expense}
              onView={() => onViewExpense?.(expense)}
              onEdit={() => onEditExpense?.(expense)}
              onDelete={() => handleDelete(expense)}
            />
          ))}
          {expenses.length === 0 && (
            <Card className="border-neutral-200 p-8">
              <TableEmptyState
                title="No expenses found"
                description="No expenses match your current filters."
                action={{
                  label: "Clear Filters",
                  onClick: resetFilters,
                }}
              />
            </Card>
          )}
        </div>
      ) : (
        /* Desktop Table View - Professional nested structure */
        <Card className="overflow-hidden border-neutral-200">
          <ResponsiveTable>
            <table className="w-full">
              <thead className="border-b border-neutral-200 bg-neutral-50/50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        style={{ width: header.getSize() }}
                        className="px-4 py-3 text-left"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "h-14 border-b border-neutral-100 transition-colors hover:bg-neutral-50",
                      index % 2 === 0 && "bg-neutral-50/30"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {table.getRowModel().rows.length === 0 && (
              <div className="p-8">
                <TableEmptyState
                  title="No expenses found"
                  description="No expenses match your current filters."
                  action={{
                    label: "Clear Filters",
                    onClick: resetFilters,
                  }}
                />
              </div>
            )}
          </ResponsiveTable>

          {/* Pagination - Inside the card for nested look */}
          {table.getRowModel().rows.length > 0 && (
            <div className="border-t border-neutral-200 bg-neutral-50/30 px-4 py-3">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <TablePagination table={table as any} totalItems={expenses.length} />
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// Export with error boundary
export const ExpensesTable = withErrorBoundary(ExpensesTableComponent, {
  level: "component",
});

// Re-export types
export type { ExpensesTableProps } from "./types";
