import React, { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useResponsiveView } from "@/hooks";
import { Download, Eye, Edit, Receipt } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  useExpenses,
  useDeleteExpense,
  useExpenseStore,
  useExportExpenses,
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
} from "@/stores/useExpenseStore";

import type { Expense } from "@/types";

import {
  formatCurrency,
  formatTableDate,
  SortableHeader,
  TableSearch,
  TablePagination,
  ActionMenu,
  TableEmptyState,
  ResponsiveTable,
  MobileCard,
  MobileCardRow,
} from "../tables/utils";

const columnHelper = createColumnHelper<Expense>();

interface ExpensesTableProps {
  onViewExpense?: (expense: Expense) => void;
  onEditExpense?: (expense: Expense) => void;
  className?: string;
}

export const ExpensesTable: React.FC<ExpensesTableProps> = ({
  onViewExpense,
  onEditExpense,
  className,
}) => {
  // Store state
  const { filters, setFilters, resetFilters, searchQuery, setSearchQuery } = useExpenseStore();

  // Local state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // Use ultra-performant MediaQuery API for responsive detection
  const { isMobile } = useResponsiveView();

  // Mutations
  const deleteExpense = useDeleteExpense();
  const exportExpenses = useExportExpenses();

  // Data
  const { data: expenses = [], error } = useExpenses();

  const handleDelete = async (expense: Expense) => {
    if (!confirm(`Are you sure you want to delete this expense: ${expense.description}?`)) {
      return;
    }

    try {
      await deleteExpense.mutateAsync(expense.expense_id);
    } catch (error) {
      console.error("Failed to delete expense:", error);
    }
  };

  const handleExport = async () => {
    try {
      await exportExpenses.mutateAsync(undefined);
    } catch (error) {
      console.error("Failed to export expenses:", error);
    }
  };

  // Category badge component
  const CategoryBadge = ({ category }: { category: string }) => {
    const colorMap: Record<string, string> = {
      Utilities: "bg-blue-100 text-blue-800",
      "Maintenance & Repairs": "bg-orange-100 text-orange-800",
      "Supplies & Inventory": "bg-green-100 text-green-800",
      "Staff & Payroll": "bg-purple-100 text-purple-800",
      "Marketing & Advertising": "bg-pink-100 text-pink-800",
      "Food & Beverage": "bg-yellow-100 text-yellow-800",
      "Cleaning & Laundry": "bg-cyan-100 text-cyan-800",
      "Insurance & Permits": "bg-red-100 text-red-800",
      "Professional Services": "bg-indigo-100 text-indigo-800",
      Other: "bg-gray-100 text-gray-800",
    };

    return (
      <Badge className={cn("text-xs font-medium", colorMap[category] || colorMap["Other"])}>
        {category}
      </Badge>
    );
  };

  // Define columns
  const columns = useMemo(
    () => [
      columnHelper.accessor("date", {
        header: ({ header }) => <SortableHeader header={header}>Date</SortableHeader>,
        cell: ({ getValue }) => formatTableDate(getValue()),
        size: 120,
      }),
      columnHelper.accessor("category", {
        header: ({ header }) => <SortableHeader header={header}>Category</SortableHeader>,
        cell: ({ getValue }) => <CategoryBadge category={getValue()} />,
        size: 160,
      }),
      columnHelper.accessor("description", {
        header: ({ header }) => <SortableHeader header={header}>Description</SortableHeader>,
        cell: ({ getValue }) => (
          <div className="max-w-[200px] truncate" title={getValue() || ""}>
            {getValue() || ""}
          </div>
        ),
        size: 200,
      }),
      columnHelper.accessor("amount", {
        header: ({ header }) => (
          <SortableHeader header={header} className="text-right">
            Amount
          </SortableHeader>
        ),
        cell: ({ getValue }) => (
          <span className="font-mono text-sm text-right block">{formatCurrency(getValue())}</span>
        ),
        size: 120,
      }),
      columnHelper.accessor("receipt_url", {
        header: "Receipt",
        cell: ({ getValue }) => {
          const url = getValue();
          return url ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(url, "_blank")}
              className="h-8 w-8 p-0"
            >
              <Receipt className="h-4 w-4" />
            </Button>
          ) : (
            <span className="text-muted-foreground text-xs">No receipt</span>
          );
        },
        size: 100,
        enableSorting: false,
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const expense = row.original;
          return (
            <ActionMenu
              actions={[
                {
                  label: "View Details",
                  onClick: () => onViewExpense?.(expense),
                },
                {
                  label: "Edit Expense",
                  onClick: () => onEditExpense?.(expense),
                },
                {
                  label: "Delete",
                  onClick: () => handleDelete(expense),
                  variant: "destructive" as const,
                },
              ]}
            />
          );
        },
        size: 80,
        enableSorting: false,
      }),
    ],
    [onViewExpense, onEditExpense, handleDelete]
  );

  // Create table
  const table = useReactTable({
    data: expenses,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  // Filter options
  const filterOptions = (
    <div className="flex flex-col sm:flex-row gap-4">
      <Select
        value={filters.category || ""}
        onValueChange={(value) =>
          setFilters({
            ...filters,
            category: value === "all" ? undefined : (value as ExpenseCategory),
          })
        }
      >
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="All Categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {EXPENSE_CATEGORIES.map((category) => (
            <SelectItem key={category} value={category}>
              {category}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex gap-2">
        <Input
          type="number"
          placeholder="Min amount"
          value={filters.minAmount || ""}
          onChange={(e) =>
            setFilters({
              ...filters,
              minAmount: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          className="w-full sm:w-[120px]"
        />
        <Input
          type="number"
          placeholder="Max amount"
          value={filters.maxAmount || ""}
          onChange={(e) =>
            setFilters({
              ...filters,
              maxAmount: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          className="w-full sm:w-[120px]"
        />
      </div>

      <div className="flex gap-2">
        <Input
          type="date"
          placeholder="From date"
          value={filters.dateFrom || ""}
          onChange={(e) =>
            setFilters({
              ...filters,
              dateFrom: e.target.value || undefined,
            })
          }
          className="w-full sm:w-[140px]"
        />
        <Input
          type="date"
          placeholder="To date"
          value={filters.dateTo || ""}
          onChange={(e) =>
            setFilters({
              ...filters,
              dateTo: e.target.value || undefined,
            })
          }
          className="w-full sm:w-[140px]"
        />
      </div>

      <Button variant="outline" onClick={resetFilters} size="sm">
        Clear Filters
      </Button>
    </div>
  );

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <p className="text-red-600">Error loading expenses: {error.message}</p>
          <Button variant="outline" onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Expenses</h2>
          <p className="text-muted-foreground">
            {expenses.length} expense{expenses.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <Button
          onClick={handleExport}
          variant="outline"
          size="sm"
          disabled={exportExpenses.isPending}
        >
          <Download className="h-4 w-4 mr-2" />
          {exportExpenses.isPending ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <TableSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search expenses..."
        />
        {filterOptions}
      </div>

      {/* Table */}
      {isMobile ? (
        <div className="space-y-4">
          {expenses.length === 0 ? (
            <TableEmptyState
              title="No expenses found"
              description="No expenses match your current filters."
            />
          ) : (
            expenses.map((expense) => (
              <MobileCard key={expense.expense_id}>
                <MobileCardRow label="Date" value={formatTableDate(expense.date)} />
                <MobileCardRow
                  label="Category"
                  value={<CategoryBadge category={expense.category} />}
                />
                <MobileCardRow label="Description" value={expense.description || ""} />
                <MobileCardRow
                  label="Amount"
                  value={
                    <span className="font-mono text-sm">{formatCurrency(expense.amount)}</span>
                  }
                />
                {expense.receipt_url && (
                  <MobileCardRow
                    label="Receipt"
                    value={
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(expense.receipt_url!, "_blank")}
                      >
                        <Receipt className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    }
                  />
                )}
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewExpense?.(expense)}
                    className="flex-1"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEditExpense?.(expense)}
                    className="flex-1"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </MobileCard>
            ))
          )}
        </div>
      ) : (
        <ResponsiveTable>
          {expenses.length === 0 ? (
            <TableEmptyState
              title="No expenses found"
              description="No expenses match your current filters."
            />
          ) : (
            <>
              <table className="w-full">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} className="border-b">
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className="text-left p-3 font-medium text-muted-foreground"
                          style={{ width: header.getSize() }}
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
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="border-b hover:bg-muted/50 transition-colors">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="p-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <TablePagination table={table} />
            </>
          )}
        </ResponsiveTable>
      )}
    </div>
  );
};
