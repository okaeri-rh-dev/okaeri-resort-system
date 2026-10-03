import React, { useCallback, useState } from "react";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  Building2,
  CreditCard,
  Edit,
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
import { Badge } from "@/components/ui/badge";
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
import {
  useAccountBalances,
  useDeleteAccount,
  useReactivateAccount,
} from "@/stores/useAccountStore";
import type { AccountType, AccountWithBalance } from "@/types";

// Icon and color mapping
const AccountTypeIcon: Record<AccountType, React.ComponentType<{ className?: string }>> = {
  Bank: Building2,
  "E-Wallet": Wallet,
  Cash: CreditCard,
};

const AccountTypeBadgeVariant: Record<AccountType, "default" | "secondary" | "outline"> = {
  Bank: "default",
  "E-Wallet": "secondary",
  Cash: "outline",
};

interface AccountsTableProps {
  onEditAccount?: (account: AccountWithBalance) => void;
  showInactive?: boolean;
}

export const AccountsTable: React.FC<AccountsTableProps> = ({
  onEditAccount,
  showInactive = false,
}) => {
  const [sorting, setSorting] = useState<SortingState>([{ id: "display_order", desc: false }]);
  const [globalFilter, setGlobalFilter] = useState("");

  const [accountToDeactivate, setAccountToDeactivate] = useState<AccountWithBalance | null>(null);

  const { data: accounts = [], isLoading, isError, refetch } = useAccountBalances();
  const deleteAccount = useDeleteAccount();
  const reactivateAccount = useReactivateAccount();

  // Filter accounts based on showInactive
  const filteredAccounts = showInactive ? accounts : accounts.filter((a) => a.is_active);

  const confirmDeactivate = useCallback(async () => {
    if (!accountToDeactivate) return;
    try {
      await deleteAccount.mutateAsync(accountToDeactivate.account_id);
      toast.success("Account deactivated successfully");
    } catch (_error) {
      toast.error("Failed to deactivate account");
    } finally {
      setAccountToDeactivate(null);
    }
  }, [deleteAccount, accountToDeactivate]);

  const handleReactivate = async (account: AccountWithBalance) => {
    try {
      await reactivateAccount.mutateAsync(account.account_id);
      toast.success("Account reactivated successfully");
    } catch (_error) {
      toast.error("Failed to reactivate account");
    }
  };

  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const columns: ColumnDef<AccountWithBalance>[] = [
    {
      accessorKey: "account_name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Account
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const account = row.original;
        const Icon = AccountTypeIcon[account.account_type as AccountType] || CreditCard;

        return (
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg",
                account.account_type === "Bank" && "bg-blue-100 text-blue-600",
                account.account_type === "E-Wallet" && "bg-green-100 text-green-600",
                account.account_type === "Cash" && "bg-amber-100 text-amber-600"
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="font-medium">{account.account_name}</div>
              <div className="text-muted-foreground text-xs">{account.account_code}</div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "account_type",
      header: "Type",
      cell: ({ row }) => {
        const type = row.getValue("account_type") as AccountType;
        return (
          <Badge variant={AccountTypeBadgeVariant[type] || "default"}>
            {type === "E-Wallet" ? "E-Wallet" : type}
          </Badge>
        );
      },
    },
    {
      accessorKey: "initial_balance",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Initial
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {formatCurrency(row.getValue("initial_balance"))}
        </span>
      ),
    },
    {
      accessorKey: "total_payments",
      header: "Received",
      cell: ({ row }) => (
        <span className="text-green-600 tabular-nums">
          +{formatCurrency(row.getValue("total_payments"))}
        </span>
      ),
    },
    {
      accessorKey: "total_expenses",
      header: "Spent",
      cell: ({ row }) => (
        <span className="text-red-600 tabular-nums">
          -{formatCurrency(row.getValue("total_expenses"))}
        </span>
      ),
    },
    {
      id: "net_transfers",
      header: "Transfers",
      cell: ({ row }) => {
        const account = row.original;
        const netTransfer = account.transfers_in - account.transfers_out;
        const isPositive = netTransfer >= 0;

        return (
          <span className={cn("tabular-nums", isPositive ? "text-green-600" : "text-red-600")}>
            {isPositive ? "+" : ""}
            {formatCurrency(netTransfer)}
          </span>
        );
      },
    },
    {
      accessorKey: "current_balance",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Balance
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const balance = row.getValue("current_balance") as number;
        const isNegative = balance < 0;

        return (
          <span className={cn("font-semibold tabular-nums", isNegative && "text-destructive")}>
            {formatCurrency(balance)}
          </span>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const account = row.original;

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
              <DropdownMenuItem onClick={() => onEditAccount?.(account)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              {account.is_active ? (
                <DropdownMenuItem
                  onClick={() => setAccountToDeactivate(account)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Deactivate
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => handleReactivate(account)}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Reactivate
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: filteredAccounts,
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
  const totals = React.useMemo(() => {
    return filteredAccounts.reduce(
      (acc, account) => ({
        initial: acc.initial + account.initial_balance,
        payments: acc.payments + account.total_payments,
        expenses: acc.expenses + account.total_expenses,
        transfers: acc.transfers + (account.transfers_in - account.transfers_out),
        balance: acc.balance + account.current_balance,
      }),
      { initial: 0, payments: 0, expenses: 0, transfers: 0, balance: 0 }
    );
  }, [filteredAccounts]);

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
        <p className="text-destructive">Failed to load accounts</p>
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
          placeholder="Search accounts..."
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
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(!row.original.is_active && "opacity-50")}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {/* Totals row */}
                <TableRow className="bg-muted/50 font-medium">
                  <TableCell>
                    <span className="font-semibold">
                      Total ({filteredAccounts.length} accounts)
                    </span>
                  </TableCell>
                  <TableCell />
                  <TableCell className="text-muted-foreground tabular-nums">
                    {formatCurrency(totals.initial)}
                  </TableCell>
                  <TableCell className="text-green-600 tabular-nums">
                    +{formatCurrency(totals.payments)}
                  </TableCell>
                  <TableCell className="text-red-600 tabular-nums">
                    -{formatCurrency(totals.expenses)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "tabular-nums",
                      totals.transfers >= 0 ? "text-green-600" : "text-red-600"
                    )}
                  >
                    {totals.transfers >= 0 ? "+" : ""}
                    {formatCurrency(totals.transfers)}
                  </TableCell>
                  <TableCell className="font-bold tabular-nums">
                    {formatCurrency(totals.balance)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </>
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No accounts found.
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
            filteredAccounts.length
          )}{" "}
          of {filteredAccounts.length} accounts
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

      {/* Deactivate Account Confirmation Dialog */}
      <AlertDialog
        open={!!accountToDeactivate}
        onOpenChange={(open) => !open && setAccountToDeactivate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate &quot;{accountToDeactivate?.account_name}&quot;?
              This account will be hidden but can be reactivated later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeactivate} className="bg-red-600 hover:bg-red-700">
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
