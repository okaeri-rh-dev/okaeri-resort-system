import React, { useCallback, useState } from "react";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
import {
  ArrowRight,
  ArrowUpDown,
  Building2,
  CreditCard,
  MoreHorizontal,
  RefreshCcw,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useDeleteTransfer, useTransfers } from "@/stores/useTransferStore";
import type { Account, AccountTransfer, AccountType } from "@/types";

// Icon mapping
const AccountTypeIcon: Record<AccountType, React.ComponentType<{ className?: string }>> = {
  Bank: Building2,
  "E-Wallet": Wallet,
  Cash: CreditCard,
};

interface TransfersTableProps {
  accountId?: string; // Filter by account if provided
}

export const TransfersTable: React.FC<TransfersTableProps> = ({ accountId }) => {
  const [sorting, setSorting] = useState<SortingState>([{ id: "transfer_date", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");

  const [transferToDelete, setTransferToDelete] = useState<AccountTransfer | null>(null);

  const { data: transfers = [], isLoading, isError, refetch } = useTransfers();
  const deleteTransfer = useDeleteTransfer();

  // Filter transfers if accountId is provided
  const filteredTransfers = accountId
    ? transfers.filter((t) => t.from_account_id === accountId || t.to_account_id === accountId)
    : transfers;

  const confirmDelete = useCallback(async () => {
    if (!transferToDelete) return;
    try {
      await deleteTransfer.mutateAsync(transferToDelete.transfer_id);
      toast.success("Transfer deleted successfully");
    } catch (_error) {
      toast.error("Failed to delete transfer");
    } finally {
      setTransferToDelete(null);
    }
  }, [deleteTransfer, transferToDelete]);

  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (date: string) => {
    return format(new Date(date), "MMM d, yyyy");
  };

  const AccountDisplay: React.FC<{ account?: Account }> = ({ account }) => {
    if (!account) return <span className="text-muted-foreground">Unknown</span>;

    const Icon = AccountTypeIcon[account.account_type as AccountType] || CreditCard;

    return (
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md",
            account.account_type === "Bank" && "bg-blue-100 text-blue-600",
            account.account_type === "E-Wallet" && "bg-green-100 text-green-600",
            account.account_type === "Cash" && "bg-amber-100 text-amber-600"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{account.account_name}</div>
          <div className="text-muted-foreground text-xs">{account.account_code}</div>
        </div>
      </div>
    );
  };

  const columns: ColumnDef<AccountTransfer>[] = [
    {
      accessorKey: "transfer_reference",
      header: "Reference",
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.getValue("transfer_reference")}</span>
      ),
    },
    {
      accessorKey: "transfer_date",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => formatDate(row.getValue("transfer_date")),
    },
    {
      id: "from_account",
      header: "From",
      cell: ({ row }) => <AccountDisplay account={row.original.from_account} />,
    },
    {
      id: "direction",
      header: "",
      cell: () => (
        <div className="flex justify-center">
          <ArrowRight className="text-muted-foreground h-4 w-4" />
        </div>
      ),
    },
    {
      id: "to_account",
      header: "To",
      cell: ({ row }) => <AccountDisplay account={row.original.to_account} />,
    },
    {
      accessorKey: "amount",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Amount
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-semibold tabular-nums">{formatCurrency(row.getValue("amount"))}</span>
      ),
    },
    {
      accessorKey: "notes",
      header: "Notes",
      cell: ({ row }) => {
        const notes = row.getValue("notes") as string | null;
        return notes ? (
          <span className="text-muted-foreground max-w-[200px] truncate text-sm">{notes}</span>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const transfer = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setTransferToDelete(transfer)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: filteredTransfers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  // Calculate totals
  const totalAmount = filteredTransfers.reduce((sum, t) => sum + t.amount, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-12 text-center">
        <p className="text-destructive">Failed to load transfers</p>
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
          placeholder="Search transfers..."
          value={globalFilter ?? ""}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              <>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {/* Totals row */}
                <TableRow className="bg-muted/50 font-medium">
                  <TableCell colSpan={5}>
                    <span className="font-semibold">
                      Total ({filteredTransfers.length} transfers)
                    </span>
                  </TableCell>
                  <TableCell className="font-bold tabular-nums">
                    {formatCurrency(totalAmount)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </>
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No transfers found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-muted-foreground text-sm">
          Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}{" "}
          to{" "}
          {Math.min(
            (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
            filteredTransfers.length
          )}{" "}
          of {filteredTransfers.length} transfers
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Delete Transfer Confirmation Dialog */}
      <AlertDialog
        open={!!transferToDelete}
        onOpenChange={(open) => !open && setTransferToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transfer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete transfer {transferToDelete?.transfer_reference}? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
