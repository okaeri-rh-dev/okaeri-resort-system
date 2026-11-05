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
import { Building2, CreditCard, RefreshCcw, Wallet } from "lucide-react";
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
  Label,
  ListCard,
  ListCardRow,
  SortableHeader,
  StatusBadge,
  Switch,
  TableEmptyState,
  TablePagination,
  TableSearch,
} from "@/components/patterns";
import { formatCurrency, pluralize } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import {
  useAccountBalances,
  useDeleteAccount,
  useReactivateAccount,
} from "@/stores/useAccountStore";
import type { AccountType, AccountWithBalance } from "@/types";

const AccountTypeIcon: Record<AccountType, React.ComponentType<{ className?: string }>> = {
  Bank: Building2,
  "E-Wallet": Wallet,
  Cash: CreditCard,
};

const netTransfers = (account: AccountWithBalance) => account.transfers_in - account.transfers_out;

interface AccountsTableProps {
  onEditAccount?: (account: AccountWithBalance) => void;
}

export const AccountsTable: React.FC<AccountsTableProps> = ({ onEditAccount }) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [accountToDeactivate, setAccountToDeactivate] = useState<AccountWithBalance | null>(null);

  const { data: accounts = [], isLoading, isError, refetch } = useAccountBalances();
  const deleteAccount = useDeleteAccount();
  const reactivateAccount = useReactivateAccount();

  // A stable array: TanStack resets the page whenever `data` changes identity
  const filteredAccounts = React.useMemo(
    () =>
      (showInactive ? [...accounts] : accounts.filter((a) => a.is_active)).sort(
        (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
      ),
    [accounts, showInactive]
  );

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

  const accountActions = (account: AccountWithBalance) => [
    { label: "Edit", onClick: () => onEditAccount?.(account) },
    account.is_active
      ? {
          label: "Deactivate",
          onClick: () => setAccountToDeactivate(account),
          variant: "destructive" as const,
        }
      : { label: "Reactivate", onClick: () => handleReactivate(account) },
  ];

  const columns: ColumnDef<AccountWithBalance>[] = [
    {
      accessorKey: "account_name",
      header: ({ header }) => <SortableHeader header={header}>Account</SortableHeader>,
      cell: ({ row }) => <AccountName account={row.original} />,
    },
    {
      accessorKey: "account_type",
      header: "Type",
      cell: ({ row }) => (
        <StatusBadge tone="neutral">{row.getValue<AccountType>("account_type")}</StatusBadge>
      ),
    },
    {
      accessorKey: "initial_balance",
      header: ({ header }) => <SortableHeader header={header}>Initial</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {formatCurrency(row.getValue("initial_balance"))}
        </span>
      ),
      meta: { align: "right" },
    },
    {
      accessorKey: "total_payments",
      header: "Received",
      cell: ({ row }) => <SignedAmount amount={row.getValue("total_payments")} />,
      meta: { align: "right" },
    },
    {
      accessorKey: "total_expenses",
      header: "Spent",
      cell: ({ row }) => <SignedAmount amount={-row.getValue<number>("total_expenses")} />,
      meta: { align: "right" },
    },
    {
      id: "net_transfers",
      header: "Transfers",
      cell: ({ row }) => <SignedAmount amount={netTransfers(row.original)} />,
      meta: { align: "right" },
    },
    {
      accessorKey: "current_balance",
      header: ({ header }) => <SortableHeader header={header}>Balance</SortableHeader>,
      cell: ({ row }) => <Balance amount={row.getValue("current_balance")} />,
      meta: { align: "right" },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <ActionMenu
          actions={accountActions(row.original)}
          label={`Actions for ${row.original.account_name}`}
        />
      ),
      meta: { pinned: true },
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

  const totals = React.useMemo(() => {
    return filteredAccounts.reduce(
      (acc, account) => ({
        initial: acc.initial + account.initial_balance,
        payments: acc.payments + account.total_payments,
        expenses: acc.expenses + account.total_expenses,
        transfers: acc.transfers + netTransfers(account),
        balance: acc.balance + account.current_balance,
      }),
      { initial: 0, payments: 0, expenses: 0, transfers: 0, balance: 0 }
    );
  }, [filteredAccounts]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div
          role="status"
          aria-label="Loading accounts"
          className="border-primary size-8 animate-spin rounded-full border-b-2"
        />
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
      <div className="flex flex-wrap items-center gap-4">
        <TableSearch
          value={globalFilter}
          onChange={setGlobalFilter}
          placeholder="Search accounts..."
          className="max-w-sm"
        />
        <div className="flex items-center gap-2">
          <Switch
            id="show-inactive-accounts"
            checked={showInactive}
            onCheckedChange={setShowInactive}
          />
          <Label htmlFor="show-inactive-accounts">Show inactive</Label>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCcw className="mr-2 size-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      <DataTable
        table={table}
        label="Accounts"
        renderCard={(row) => (
          <AccountCard account={row.original} actions={accountActions(row.original)} />
        )}
        emptyState={
          <TableEmptyState
            title="No accounts found"
            description="Try a different search, or add an account."
          />
        }
      />

      {filteredAccounts.length > 0 && (
        <Card padding="sm" className="@container">
          <h3 className="text-sm font-semibold">
            Total ({filteredAccounts.length} {pluralize(filteredAccounts.length, "account")})
          </h3>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 @lg:grid-cols-5">
            <TotalFigure label="Initial">
              <span className="text-muted-foreground tabular-nums">
                {formatCurrency(totals.initial)}
              </span>
            </TotalFigure>
            <TotalFigure label="Received">
              <SignedAmount amount={totals.payments} />
            </TotalFigure>
            <TotalFigure label="Spent">
              <SignedAmount amount={-totals.expenses} />
            </TotalFigure>
            <TotalFigure label="Transfers">
              <SignedAmount amount={totals.transfers} />
            </TotalFigure>
            <TotalFigure label="Balance">
              <Balance amount={totals.balance} className="font-bold" />
            </TotalFigure>
          </dl>
        </Card>
      )}

      <TablePagination table={table} totalItems={filteredAccounts.length} />

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
            <AlertDialogAction
              onClick={confirmDeactivate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

/** Money in reads "+₱…" in success, money out "-₱…" in danger; nothing moved stays muted. */
function SignedAmount({ amount }: { amount: number }) {
  if (amount === 0) {
    return (
      <span className="text-muted-foreground whitespace-nowrap tabular-nums">
        {formatCurrency(0)}
      </span>
    );
  }
  return amount > 0 ? (
    <span className="text-success-foreground whitespace-nowrap tabular-nums">
      +{formatCurrency(amount)}
    </span>
  ) : (
    <span className="text-danger-foreground whitespace-nowrap tabular-nums">
      {formatCurrency(amount)}
    </span>
  );
}

function Balance({ amount, className }: { amount: number; className?: string }) {
  return (
    <span
      className={cn(
        "font-semibold whitespace-nowrap tabular-nums",
        amount < 0 && "text-danger-foreground",
        className
      )}
    >
      {formatCurrency(amount)}
    </span>
  );
}

function AccountName({ account }: { account: AccountWithBalance }) {
  const Icon = AccountTypeIcon[account.account_type as AccountType] || CreditCard;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <div className="truncate font-medium">{account.account_name}</div>
        <div className="text-muted-foreground text-xs">{account.account_code}</div>
      </div>
      {!account.is_active && <StatusBadge tone="neutral">Inactive</StatusBadge>}
    </div>
  );
}

function AccountCard({
  account,
  actions,
}: {
  account: AccountWithBalance;
  actions: React.ComponentProps<typeof ActionMenu>["actions"];
}) {
  return (
    <ListCard>
      <div className="flex items-start justify-between gap-2">
        <AccountName account={account} />
        <ActionMenu actions={actions} label={`Actions for ${account.account_name}`} />
      </div>
      <ListCardRow
        label="Type"
        value={<StatusBadge tone="neutral">{account.account_type}</StatusBadge>}
      />
      <ListCardRow label="Initial" value={formatCurrency(account.initial_balance)} />
      <ListCardRow label="Received" value={<SignedAmount amount={account.total_payments} />} />
      <ListCardRow label="Spent" value={<SignedAmount amount={-account.total_expenses} />} />
      <ListCardRow label="Transfers" value={<SignedAmount amount={netTransfers(account)} />} />
      <ListCardRow label="Balance" value={<Balance amount={account.current_balance} />} />
    </ListCard>
  );
}

function TotalFigure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}
