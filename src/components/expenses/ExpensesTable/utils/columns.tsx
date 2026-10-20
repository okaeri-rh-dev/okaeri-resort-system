import { Link } from "@tanstack/react-router";
import { createColumnHelper, type Header } from "@tanstack/react-table";
import { Edit2, Eye, MoreHorizontal, Receipt, Trash2 } from "lucide-react";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SortableHeader,
  StatusBadge,
} from "@/components/patterns";
import { formatCurrency, formatTableDate } from "@/lib/formatters";
import type { Expense } from "@/types";

const columnHelper = createColumnHelper<Expense>();

interface ColumnOptions {
  onViewExpense?: (expense: Expense) => void;
  onEditExpense?: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
}

export function getColumns({ onViewExpense, onEditExpense, onDelete }: ColumnOptions) {
  return [
    // Date column
    columnHelper.accessor("date", {
      header: ({ header }: { header: Header<Expense, unknown> }) => (
        <SortableHeader header={header}>Date</SortableHeader>
      ),
      cell: ({ getValue }) => (
        <span className="text-foreground text-sm font-medium">{formatTableDate(getValue())}</span>
      ),
      size: 120,
    }),

    // Category column
    columnHelper.accessor("category", {
      header: ({ header }: { header: Header<Expense, unknown> }) => (
        <SortableHeader header={header}>Category</SortableHeader>
      ),
      cell: ({ getValue }) => <StatusBadge tone="neutral">{getValue()}</StatusBadge>,
      size: 180,
    }),

    // Description column
    columnHelper.accessor("description", {
      header: ({ header }: { header: Header<Expense, unknown> }) => (
        <SortableHeader header={header}>Description</SortableHeader>
      ),
      cell: ({ getValue, row }) => {
        const description = getValue() || "No description";
        const truncated = description.length > 50 ? description.slice(0, 50) + "..." : description;

        return (
          <Link
            to="/admin/expenses/$expenseId"
            params={{ expenseId: row.original.expense_id }}
            className="text-primary transition-colors hover:underline"
            title={description}
            preload="intent"
          >
            {truncated}
          </Link>
        );
      },
      size: 300,
    }),

    // Amount column
    columnHelper.accessor("amount", {
      header: ({ header }: { header: Header<Expense, unknown> }) => (
        <SortableHeader header={header}>Amount</SortableHeader>
      ),
      cell: ({ getValue }) => (
        <span className="text-foreground text-sm font-semibold tabular-nums">
          {formatCurrency(getValue())}
        </span>
      ),
      meta: { align: "right" },
      size: 120,
    }),

    // Receipt column
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
            <Receipt className="text-muted-foreground h-3.5 w-3.5" />
          </Button>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        );
      },
      size: 80,
      enableSorting: false,
    }),

    // Actions column
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const expense = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="text-muted-foreground h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {onViewExpense && (
                <DropdownMenuItem onClick={() => onViewExpense(expense)}>
                  <Eye className="mr-2 h-3.5 w-3.5" />
                  View Details
                </DropdownMenuItem>
              )}
              {onEditExpense && (
                <DropdownMenuItem onClick={() => onEditExpense(expense)}>
                  <Edit2 className="mr-2 h-3.5 w-3.5" />
                  Edit Expense
                </DropdownMenuItem>
              )}
              {(onViewExpense || onEditExpense) && <DropdownMenuSeparator />}
              <DropdownMenuItem
                onClick={() => onDelete(expense)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete Expense
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      size: 80,
      enableSorting: false,
    }),
  ];
}
