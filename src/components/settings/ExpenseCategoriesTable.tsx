import { useState } from "react";

import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { RefreshCcw } from "lucide-react";

import {
  ActionMenu,
  Button,
  DataTable,
  Input,
  ListCard,
  ListCardRow,
  SortableHeader,
  StatusBadge,
  TableEmptyState,
  TableSkeleton,
  type ActionMenuAction,
} from "@/components/patterns";
import {
  useArchiveExpenseCategory,
  useExpenseCategories,
  useRestoreExpenseCategory,
} from "@/hooks/useExpenseCategories";
import type { ExpenseCategoryConfig } from "@/types";

interface ExpenseCategoriesTableProps {
  onEditCategory?: (category: ExpenseCategoryConfig) => void;
}

function CategoryStatus({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <StatusBadge tone="success">Active</StatusBadge>
  ) : (
    <StatusBadge tone="neutral">Archived</StatusBadge>
  );
}

export function ExpenseCategoriesTable({ onEditCategory }: ExpenseCategoriesTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "display_order", desc: false }]);
  const [globalFilter, setGlobalFilter] = useState("");

  const { data: categories = [], isLoading, isError, refetch } = useExpenseCategories();
  const archive = useArchiveExpenseCategory();
  const restore = useRestoreExpenseCategory();

  const categoryActions = (category: ExpenseCategoryConfig): ActionMenuAction[] => [
    { label: "Edit", onClick: () => onEditCategory?.(category) },
    category.is_active
      ? { label: "Archive", onClick: () => archive.mutate(category.id) }
      : { label: "Restore", onClick: () => restore.mutate(category.id) },
  ];

  const columns: ColumnDef<ExpenseCategoryConfig>[] = [
    {
      accessorKey: "name",
      header: ({ header }) => <SortableHeader header={header}>Category Name</SortableHeader>,
      cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
    },
    {
      accessorKey: "display_order",
      header: ({ header }) => <SortableHeader header={header}>Order</SortableHeader>,
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.display_order}</span>
      ),
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => <CategoryStatus isActive={row.original.is_active} />,
    },
    {
      id: "actions",
      meta: { pinned: true, align: "right" },
      cell: ({ row }) => (
        <ActionMenu
          label={`Actions for ${row.original.name}`}
          actions={categoryActions(row.original)}
        />
      ),
    },
  ];

  const table = useReactTable({
    data: categories,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      globalFilter,
    },
  });

  if (isLoading) {
    return <TableSkeleton rows={4} columns={4} toolbar label="Loading expense categories" />;
  }

  if (isError) {
    return (
      <div className="py-12 text-center">
        <p className="text-destructive">Failed to load expense categories</p>
        <Button variant="outline" onClick={() => refetch()} className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and filters */}
      <div className="flex items-center gap-4">
        <Input
          aria-label="Search categories"
          placeholder="Search categories..."
          value={globalFilter ?? ""}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <DataTable
        table={table}
        label="Expense categories"
        renderCard={(row) => (
          <ListCard>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 font-medium break-words">{row.original.name}</div>
              <ActionMenu
                label={`Actions for ${row.original.name}`}
                actions={categoryActions(row.original)}
              />
            </div>
            <ListCardRow
              label="Status"
              value={<CategoryStatus isActive={row.original.is_active} />}
            />
            <ListCardRow label="Order" value={row.original.display_order} />
          </ListCard>
        )}
        emptyState={
          <TableEmptyState
            title="No expense categories"
            description={
              globalFilter
                ? "No categories match your search."
                : "Add a category to start sorting expenses."
            }
          />
        }
      />
    </div>
  );
}
