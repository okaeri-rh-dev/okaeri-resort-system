import { Link } from "@tanstack/react-router";
import { createColumnHelper, type Header } from "@tanstack/react-table";
import { Edit2, Eye, MoreHorizontal, Receipt, Trash2 } from "lucide-react";

import { SortableHeader } from "@/components/patterns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
        <SortableHeader
          header={header}
          className="text-xs font-medium tracking-wide text-neutral-700 uppercase"
        >
          Date
        </SortableHeader>
      ),
      cell: ({ getValue }) => (
        <span className="text-sm font-medium text-neutral-900">{formatTableDate(getValue())}</span>
      ),
      size: 120,
    }),

    // Category column
    columnHelper.accessor("category", {
      header: ({ header }: { header: Header<Expense, unknown> }) => (
        <SortableHeader
          header={header}
          className="text-xs font-medium tracking-wide text-neutral-700 uppercase"
        >
          Category
        </SortableHeader>
      ),
      cell: ({ getValue }) => (
        <Badge
          variant="outline"
          className="border-neutral-200 bg-neutral-50 text-xs font-medium text-neutral-700"
        >
          {getValue()}
        </Badge>
      ),
      size: 180,
    }),

    // Description column
    columnHelper.accessor("description", {
      header: ({ header }: { header: Header<Expense, unknown> }) => (
        <SortableHeader
          header={header}
          className="text-xs font-medium tracking-wide text-neutral-700 uppercase"
        >
          Description
        </SortableHeader>
      ),
      cell: ({ getValue, row }) => {
        const description = getValue() || "No description";
        const truncated = description.length > 50 ? description.slice(0, 50) + "..." : description;

        return (
          <Link
            to="/admin/expenses/$expenseId"
            params={{ expenseId: row.original.expense_id }}
            className="text-blue-600 transition-colors hover:underline"
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
        <SortableHeader
          header={header}
          className="text-right text-xs font-medium tracking-wide text-neutral-700 uppercase"
        >
          Amount
        </SortableHeader>
      ),
      cell: ({ getValue }) => (
        <div className="text-right">
          <span className="font-mono text-sm font-semibold text-neutral-900">
            {formatCurrency(getValue())}
          </span>
        </div>
      ),
      size: 120,
    }),

    // Receipt column
    columnHelper.accessor("receipt_url", {
      header: () => (
        <span className="text-xs font-medium tracking-wide text-neutral-700 uppercase">
          Receipt
        </span>
      ),
      cell: ({ getValue }) => {
        const url = getValue();
        return url ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(url, "_blank")}
            className="h-8 w-8 p-0 hover:bg-neutral-100"
          >
            <Receipt className="h-3.5 w-3.5 text-neutral-600" />
          </Button>
        ) : (
          <span className="text-xs text-neutral-400">—</span>
        );
      },
      size: 80,
      enableSorting: false,
    }),

    // Actions column
    columnHelper.display({
      id: "actions",
      header: () => (
        <span className="text-xs font-medium tracking-wide text-neutral-700 uppercase">
          Actions
        </span>
      ),
      cell: ({ row }) => {
        const expense = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-neutral-100">
                <MoreHorizontal className="h-4 w-4 text-neutral-600" />
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
                className="text-red-600 focus:text-red-600"
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
