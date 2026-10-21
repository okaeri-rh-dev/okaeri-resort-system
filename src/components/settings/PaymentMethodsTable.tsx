import { useState } from "react";

import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Banknote, Building2, CreditCard, RefreshCcw, Smartphone, Wallet } from "lucide-react";

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
  useDeletePaymentMethod,
  usePaymentMethods,
  useReactivatePaymentMethod,
} from "@/hooks/usePaymentMethods";
import { cn } from "@/lib/utils";
import type { PaymentMethodConfig, PaymentMethodType } from "@/types";

const METHOD_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Smartphone,
  Building2,
  CreditCard,
  Wallet,
  Banknote,
};

const METHOD_TYPE_LABELS: Record<PaymentMethodType, string> = {
  "e-wallet": "E-Wallet",
  "bank-transfer": "Bank Transfer",
  cash: "Cash",
  other: "Other",
};

interface PaymentMethodsTableProps {
  onEditMethod?: (method: PaymentMethodConfig) => void;
}

function MethodName({ method }: { method: PaymentMethodConfig }) {
  const Icon = METHOD_TYPE_ICONS[method.icon_name] || CreditCard;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
        <Icon className={cn("size-5", method.icon_color)} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <div className="font-medium break-words">{method.display_name}</div>
        <div className="text-muted-foreground text-xs">{method.provider_name}</div>
      </div>
    </div>
  );
}

function MethodType({ type }: { type: PaymentMethodType }) {
  return (
    <StatusBadge tone="neutral">{METHOD_TYPE_LABELS[type] ?? METHOD_TYPE_LABELS.other}</StatusBadge>
  );
}

function AccountNumber({ number }: { number: string | null }) {
  return number ? (
    <span className="text-sm whitespace-nowrap tabular-nums">{number}</span>
  ) : (
    <span className="text-muted-foreground text-sm">-</span>
  );
}

function QrCode({ method }: { method: PaymentMethodConfig }) {
  return method.qr_code_url ? (
    <img
      src={method.qr_code_url}
      alt={`${method.display_name} QR`}
      width={40}
      height={40}
      className="size-10 rounded border object-contain"
    />
  ) : (
    <span className="text-muted-foreground text-xs">None</span>
  );
}

function MethodStatus({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <StatusBadge tone="success">Active</StatusBadge>
  ) : (
    <StatusBadge tone="neutral">Inactive</StatusBadge>
  );
}

export function PaymentMethodsTable({ onEditMethod }: PaymentMethodsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "display_order", desc: false }]);
  const [globalFilter, setGlobalFilter] = useState("");

  const { data: methods = [], isLoading, isError, refetch } = usePaymentMethods();
  const deactivate = useDeletePaymentMethod();
  const reactivate = useReactivatePaymentMethod();

  const methodActions = (method: PaymentMethodConfig): ActionMenuAction[] => [
    { label: "Edit", onClick: () => onEditMethod?.(method) },
    method.is_active
      ? { label: "Deactivate", onClick: () => deactivate.mutate(method.id) }
      : { label: "Reactivate", onClick: () => reactivate.mutate(method.id) },
  ];

  const columns: ColumnDef<PaymentMethodConfig>[] = [
    {
      accessorKey: "display_name",
      header: ({ header }) => <SortableHeader header={header}>Payment Method</SortableHeader>,
      cell: ({ row }) => <MethodName method={row.original} />,
    },
    {
      accessorKey: "method_type",
      header: "Type",
      cell: ({ row }) => <MethodType type={row.original.method_type} />,
    },
    {
      accessorKey: "account_number",
      header: "Account Number",
      cell: ({ row }) => <AccountNumber number={row.original.account_number} />,
    },
    {
      id: "qr_code",
      header: "QR Code",
      cell: ({ row }) => <QrCode method={row.original} />,
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
      cell: ({ row }) => <MethodStatus isActive={row.original.is_active} />,
    },
    {
      id: "actions",
      meta: { pinned: true, align: "right" },
      cell: ({ row }) => (
        <ActionMenu
          label={`Actions for ${row.original.display_name}`}
          actions={methodActions(row.original)}
        />
      ),
    },
  ];

  const table = useReactTable({
    data: methods,
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
    return <TableSkeleton rows={4} columns={7} toolbar label="Loading payment methods" />;
  }

  if (isError) {
    return (
      <div className="py-12 text-center">
        <p className="text-destructive">Failed to load payment methods</p>
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
          aria-label="Search payment methods"
          placeholder="Search payment methods..."
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
        label="Payment methods"
        renderCard={(row) => (
          <ListCard>
            <div className="flex items-start justify-between gap-2">
              <MethodName method={row.original} />
              <ActionMenu
                label={`Actions for ${row.original.display_name}`}
                actions={methodActions(row.original)}
              />
            </div>
            <ListCardRow label="Type" value={<MethodType type={row.original.method_type} />} />
            <ListCardRow
              label="Account Number"
              value={<AccountNumber number={row.original.account_number} />}
            />
            <ListCardRow
              label="Status"
              value={<MethodStatus isActive={row.original.is_active} />}
            />
            <ListCardRow label="Order" value={row.original.display_order} />
            {row.original.qr_code_url ? (
              <ListCardRow label="QR Code" value={<QrCode method={row.original} />} />
            ) : null}
          </ListCard>
        )}
        emptyState={
          <TableEmptyState
            title="No payment methods"
            description={
              globalFilter
                ? "No payment methods match your search."
                : "Add a payment method so guests know how to pay."
            }
          />
        }
      />
    </div>
  );
}
