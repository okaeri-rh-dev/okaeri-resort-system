import React, { useCallback, useMemo, useState } from "react";

import { Link } from "@tanstack/react-router";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { Download, Edit } from "lucide-react";

import { withErrorBoundary } from "@/components/ErrorBoundary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useResponsiveView } from "@/hooks";
import { cn } from "@/lib/utils";
import {
  useDeletePayment,
  useExportPayments,
  usePayments,
  usePaymentStore,
  useVerifyPayment,
} from "@/stores/usePaymentStore";
import type { Payment } from "@/types";

import {
  ActionMenu,
  FilterPopover,
  formatCurrency,
  formatTableDate,
  MobileCard,
  MobileCardRow,
  ResponsiveTable,
  SortableHeader,
  StatusBadge,
  TableEmptyState,
  TablePagination,
  TableSearch,
} from "../tables/utils";

const columnHelper = createColumnHelper<Payment>();

interface PaymentsTableProps {
  onViewPayment?: (payment: Payment) => void;
  onEditPayment?: (payment: Payment) => void;
  bookingId?: string; // Optional: Show only payments for specific booking
  className?: string;
}

const PaymentsTableComponent: React.FC<PaymentsTableProps> = ({
  onViewPayment,
  onEditPayment,
  bookingId,
  className,
}) => {
  // Store state
  const { filters, setFilters, searchQuery, setSearchQuery } = usePaymentStore();

  // Local state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // Use ultra-performant MediaQuery API for responsive detection
  const { isMobile } = useResponsiveView();

  // Mutations
  const deletePayment = useDeletePayment();
  const verifyPayment = useVerifyPayment();
  const exportPayments = useExportPayments();

  // Data
  const { data: payments = [], isLoading, error } = usePayments();

  // Filter by booking if provided
  const filteredPayments = bookingId
    ? payments.filter((p) => p.booking_id === bookingId)
    : payments;

  const handleDelete = useCallback(
    async (payment: Payment) => {
      if (
        !confirm(
          `Are you sure you want to delete this payment of ${formatCurrency(payment.amount)}?`
        )
      ) {
        return;
      }

      try {
        await deletePayment.mutateAsync(payment.payment_id);
      } catch (error) {
        console.error("Failed to delete payment:", error);
      }
    },
    [deletePayment]
  );

  const handleVerify = useCallback(
    async (payment: Payment) => {
      try {
        await verifyPayment.mutateAsync(payment.payment_id);
      } catch (error) {
        console.error("Failed to verify payment:", error);
      }
    },
    [verifyPayment]
  );

  const handleExport = () => {
    exportPayments.mutate(undefined);
  };

  // Define columns
  const columns = useMemo(
    () => [
      columnHelper.accessor("payment_date", {
        id: "payment_date",
        header: ({ header }) => <SortableHeader header={header}>Date</SortableHeader>,
        cell: ({ getValue }) => formatTableDate(getValue() || ""),
        size: 100,
      }),

      columnHelper.accessor((row) => row.booking?.booking_reference, {
        id: "booking_reference",
        header: "Booking",
        cell: ({ row }) => {
          const booking = row.original.booking;
          const bookingId = row.original.booking_id;

          if (!booking || !bookingId) return "-";

          return (
            <div className="space-y-1">
              <Link
                to="/bookings/$bookingId"
                params={{ bookingId }}
                className="font-mono text-blue-600 transition-colors hover:underline"
                preload="intent"
              >
                {booking.booking_reference}
              </Link>
              <div className="text-xs text-neutral-500">{booking.guest_name}</div>
            </div>
          );
        },
        size: 150,
      }),

      columnHelper.accessor("amount", {
        id: "amount",
        header: ({ header }) => <SortableHeader header={header}>Amount</SortableHeader>,
        cell: ({ getValue }) => (
          <span className="font-mono font-semibold text-neutral-900">
            {formatCurrency(getValue())}
          </span>
        ),
        size: 100,
      }),

      columnHelper.accessor("payment_method", {
        id: "payment_method",
        header: "Method",
        cell: ({ getValue }) => {
          const method = getValue();
          if (!method) return "-";

          const colors = {
            Cash: "bg-green-100 text-green-800",
            GCash: "bg-blue-100 text-blue-800",
            BankTransfer: "bg-purple-100 text-purple-800",
            Card: "bg-gray-100 text-gray-800",
            Other: "bg-neutral-100 text-neutral-800",
          };

          return (
            <Badge className={cn("text-xs", colors[method as keyof typeof colors])}>{method}</Badge>
          );
        },
        size: 100,
      }),

      columnHelper.accessor((row) => row.booking?.payment_status, {
        id: "payment_status",
        header: "Booking Payment Status",
        cell: ({ getValue }) => {
          const status = getValue() as string | undefined;
          if (!status) return "-";

          return (
            <StatusBadge
              status={status}
              variant={
                status === "Completed"
                  ? "default"
                  : status === "Partial"
                    ? "secondary"
                    : status === "Refunded"
                      ? "destructive"
                      : "default"
              }
            />
          );
        },
        size: 120,
      }),

      columnHelper.accessor("proof_url", {
        id: "proof",
        header: "Receipt",
        cell: ({ getValue }) => {
          const url = getValue();
          return url ? (
            <Button variant="ghost" size="sm" onClick={() => window.open(url, "_blank")}>
              <Download className="h-4 w-4" />
            </Button>
          ) : (
            <span className="text-xs text-neutral-400">No receipt</span>
          );
        },
        size: 80,
      }),

      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const payment = row.original;

          const actions = [
            {
              label: "View Details",
              onClick: () => onViewPayment?.(payment),
            },
            {
              label: "Edit Payment",
              onClick: () => onEditPayment?.(payment),
            },
            ...(payment.booking?.payment_status !== "Completed"
              ? [
                  {
                    label: "Verify Payment",
                    onClick: () => handleVerify(payment),
                  },
                ]
              : []),
            {
              label: "Download Receipt",
              onClick: () => payment.proof_url && window.open(payment.proof_url, "_blank"),
              disabled: !payment.proof_url,
            },
            {
              label: "Delete",
              onClick: () => handleDelete(payment),
              className: "text-red-600 hover:text-red-700",
            },
          ];

          return <ActionMenu actions={actions} />;
        },
        size: 80,
      }),
    ],
    [onViewPayment, onEditPayment, handleDelete, handleVerify]
  );

  // Transform payments data to match Payment interface
  // Cast to Payment type as the booking relation has partial data only
  const typedPayments = filteredPayments as Payment[];

  // Create table instance
  const table = useReactTable({
    data: typedPayments,
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
  });

  // Calculate statistics
  const stats = useMemo(() => {
    const total = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
    const verified = filteredPayments.filter(
      (p) => p.booking?.payment_status === "Completed"
    ).length;
    const pending = filteredPayments.filter((p) => p.booking?.payment_status === "Pending").length;

    return { total, verified, pending, count: filteredPayments.length };
  }, [filteredPayments]);

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-1/4 rounded bg-neutral-200"></div>
          <div className="h-10 rounded bg-neutral-200"></div>
          <div className="h-10 rounded bg-neutral-200"></div>
          <div className="h-10 rounded bg-neutral-200"></div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">Error loading payments: {error.message}</div>
      </Card>
    );
  }

  // Mobile view
  if (isMobile) {
    return (
      <div className={cn("space-y-4", className)}>
        {/* Mobile stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3">
            <div className="text-xs text-neutral-500">Total Amount</div>
            <div className="font-mono text-lg font-bold">{formatCurrency(stats.total)}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-neutral-500">Payments</div>
            <div className="text-lg font-bold">
              {stats.verified}/{stats.count} Verified
            </div>
          </Card>
        </div>

        {/* Mobile search */}
        <Card className="p-3">
          <TableSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search payments..."
          />
        </Card>

        {/* Mobile cards */}
        <div className="space-y-3">
          {filteredPayments.map((payment) => (
            <MobileCard key={payment.payment_id}>
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-lg font-semibold">
                      {formatCurrency(payment.amount)}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {formatTableDate(payment.payment_date || "")}
                    </div>
                  </div>
                  <StatusBadge
                    status={payment.booking?.payment_status || "Pending"}
                    variant={
                      payment.booking?.payment_status === "Completed"
                        ? "default"
                        : payment.booking?.payment_status === "Partial"
                          ? "secondary"
                          : "default"
                    }
                  />
                </div>

                {payment.booking && (
                  <MobileCardRow label="Booking" value={payment.booking.booking_reference} />
                )}

                {payment.payment_method && (
                  <MobileCardRow label="Method" value={payment.payment_method} />
                )}

                <div className="flex gap-2 pt-2">
                  {payment.proof_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(payment.proof_url!, "_blank")}
                    >
                      <Download className="mr-1 h-4 w-4" />
                      Receipt
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      onEditPayment?.({
                        ...payment,
                        booking: payment.booking || undefined,
                      } as Payment)
                    }
                  >
                    <Edit className="mr-1 h-4 w-4" />
                    Edit
                  </Button>
                </div>
              </div>
            </MobileCard>
          ))}
        </div>

        {filteredPayments.length === 0 && (
          <Card className="p-8 text-center">
            <div className="text-neutral-500">No payments found</div>
          </Card>
        )}
      </div>
    );
  }

  // Desktop view
  return (
    <div className={cn("space-y-4", className)}>
      {/* Desktop stats - commented out to match other tables */}
      {/* <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="text-sm text-neutral-500">Total Collected</div>
          <div className="font-mono font-bold text-xl">{formatCurrency(stats.total)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-neutral-500">Total Payments</div>
          <div className="font-bold text-xl">{stats.count}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-neutral-500">Verified</div>
          <div className="font-bold text-xl">{stats.verified}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-neutral-500">Pending</div>
          <div className="font-bold text-xl">{stats.pending}</div>
        </Card>
      </div> */}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center space-x-3">
          <TableSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search payments..."
            className="min-w-[200px]"
          />

          <FilterPopover
            isActive={!!filters.status}
            content={
              <div className="space-y-2">
                <div className="text-sm font-medium">Payment Status</div>
                <Select
                  value={filters.status || "all"}
                  onValueChange={(value) =>
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    setFilters({ ...filters, status: value === "all" ? undefined : (value as any) })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Partial">Partial</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Refunded">Refunded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            }
          >
            Status
          </FilterPopover>

          <FilterPopover
            isActive={!!filters.method}
            content={
              <div className="space-y-2">
                <div className="text-sm font-medium">Payment Method</div>
                <Select
                  value={filters.method || "all"}
                  onValueChange={(value) =>
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    setFilters({ ...filters, method: value === "all" ? undefined : (value as any) })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="GCash">GCash</SelectItem>
                    <SelectItem value="BankTransfer">Bank Transfer</SelectItem>
                    <SelectItem value="Card">Card</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            }
          >
            Method
          </FilterPopover>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exportPayments.isPending}
        >
          <Download className="mr-1 h-3 w-3" />
          Export CSV
        </Button>
      </div>

      {/* Table */}
      <ResponsiveTable>
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className="px-4 py-3 text-left text-xs font-medium tracking-wide text-neutral-700 uppercase"
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
                  "h-10 border-b border-neutral-100 hover:bg-neutral-50",
                  index % 2 === 0 && "bg-neutral-50/30"
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 text-sm text-neutral-900">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {filteredPayments.length === 0 && (
          <div className="p-8">
            <TableEmptyState
              title="No payments found"
              description={
                searchQuery
                  ? "Try adjusting your search or filters"
                  : bookingId
                    ? "No payments recorded for this booking"
                    : "No payments in the system yet"
              }
              action={
                searchQuery
                  ? {
                      label: "Clear Search",
                      onClick: () => setSearchQuery(""),
                    }
                  : undefined
              }
            />
          </div>
        )}
      </ResponsiveTable>

      {/* Desktop pagination */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <TablePagination table={table as any} totalItems={filteredPayments.length} />
    </div>
  );
};

// Export with error boundary
export const PaymentsTable = withErrorBoundary(PaymentsTableComponent, {
  level: "component",
});
