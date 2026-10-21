import React, { useCallback, useState } from "react";

import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { ArrowRight, Building2, CreditCard, RefreshCcw, Wallet } from "lucide-react";
import { toast } from "sonner";

import {
  ActionMenu,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  DataTable,
  ListCard,
  ListCardRow,
  SortableHeader,
  TableEmptyState,
  TablePagination,
  TableSearch,
} from "@/components/patterns";
import { formatCurrency, pluralize } from "@/lib/formatters";
import { useDeleteTransfer, useTransfers } from "@/stores/useTransferStore";
import type { Account, AccountTransfer, AccountType } from "@/types";

const AccountTypeIcon: Record<AccountType, React.ComponentType<{ className?: string }>> = {
  Bank: Building2,
  "E-Wallet": Wallet,
  Cash: CreditCard,
};

const formatTransferDate = (date: string) => format(new Date(date), "MMM d, yyyy");

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

  const transferActions = (transfer: AccountTransfer) => [
    {
      label: "Delete",
      onClick: () => setTransferToDelete(transfer),
      variant: "destructive" as const,
    },
  ];

  const columns: ColumnDef<AccountTransfer>[] = [
    {
      accessorKey: "transfer_reference",
      header: "Reference",
      cell: ({ row }) => (
        <span className="text-sm whitespace-nowrap tabular-nums">
          {row.getValue("transfer_reference")}
        </span>
      ),
    },
    {
      accessorKey: "transfer_date",
      header: ({ header }) => <SortableHeader header={header}>Date</SortableHeader>,
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {formatTransferDate(row.getValue("transfer_date"))}
        </span>
      ),
    },
    {
      id: "from_account",
      header: "From",
      cell: ({ row }) => <AccountDisplay account={row.original.from_account} />,
    },
    {
      id: "direction",
      header: () => <span className="sr-only">Direction</span>,
      cell: () => (
        <div className="flex justify-center">
          <ArrowRight className="text-muted-foreground size-4" aria-hidden="true" />
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
      header: ({ header }) => <SortableHeader header={header}>Amount</SortableHeader>,
      cell: ({ row }) => (
        <span className="font-semibold tabular-nums">{formatCurrency(row.getValue("amount"))}</span>
      ),
      meta: { align: "right" },
    },
    {
      accessorKey: "notes",
      header: "Notes",
      cell: ({ row }) => {
        const notes = row.getValue("notes") as string | null;
        return (
          <span className="text-muted-foreground block max-w-48 truncate text-sm">
            {notes || "-"}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <ActionMenu
          actions={transferActions(row.original)}
          label={`Actions for ${row.original.transfer_reference}`}
        />
      ),
      meta: { pinned: true },
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

  const totalAmount = filteredTransfers.reduce((sum, t) => sum + t.amount, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div
          role="status"
          aria-label="Loading transfers"
          className="border-primary size-8 animate-spin rounded-full border-b-2"
        />
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
      <div className="flex items-center gap-4">
        <TableSearch
          value={globalFilter}
          onChange={setGlobalFilter}
          placeholder="Search transfers..."
          className="max-w-sm"
        />
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCcw className="mr-2 size-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      <DataTable
        table={table}
        label="Transfers"
        renderCard={(row) => (
          <TransferCard transfer={row.original} actions={transferActions(row.original)} />
        )}
        emptyState={
          <TableEmptyState
            title="No transfers found"
            description="Try a different search, or record a transfer."
          />
        }
      />

      {filteredTransfers.length > 0 && (
        <Card padding="sm" className="flex items-center justify-between gap-4">
          <span className="text-sm font-semibold">
            Total ({filteredTransfers.length} {pluralize(filteredTransfers.length, "transfer")})
          </span>
          <span className="font-bold tabular-nums">{formatCurrency(totalAmount)}</span>
        </Card>
      )}

      <TablePagination table={table} totalItems={filteredTransfers.length} />

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
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

function AccountDisplay({ account }: { account?: Account }) {
  if (!account) return <span className="text-muted-foreground">Unknown</span>;

  const Icon = AccountTypeIcon[account.account_type as AccountType] || CreditCard;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 text-left">
        <div className="truncate text-sm font-medium">{account.account_name}</div>
        <div className="text-muted-foreground text-xs">{account.account_code}</div>
      </div>
    </div>
  );
}

function TransferCard({
  transfer,
  actions,
}: {
  transfer: AccountTransfer;
  actions: React.ComponentProps<typeof ActionMenu>["actions"];
}) {
  return (
    <ListCard>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-lg font-semibold tabular-nums">
            {formatCurrency(transfer.amount)}
          </div>
          <div className="text-muted-foreground text-xs">
            {formatTransferDate(transfer.transfer_date)}
          </div>
        </div>
        <ActionMenu actions={actions} label={`Actions for ${transfer.transfer_reference}`} />
      </div>
      <ListCardRow
        label="Reference"
        value={<span className="whitespace-nowrap">{transfer.transfer_reference}</span>}
      />
      <ListCardRow label="From" value={<AccountDisplay account={transfer.from_account} />} />
      <ListCardRow label="To" value={<AccountDisplay account={transfer.to_account} />} />
      {transfer.notes && (
        <p className="text-muted-foreground text-sm break-words">{transfer.notes}</p>
      )}
    </ListCard>
  );
}
