import React, { useCallback, useMemo, useState } from "react";

import { Link } from "@tanstack/react-router";
import {
  createColumnHelper,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type Header,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { Download, Edit } from "lucide-react";
import { toast } from "sonner";

import { withErrorBoundary } from "@/components/ErrorBoundary";
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
  FilterBar,
  FilterPopover,
  ListCard,
  ListCardRow,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SortableHeader,
  StatusBadge,
  TableEmptyState,
  TablePagination,
  TableSearch,
} from "@/components/patterns";
import { useUserRole } from "@/hooks";
import { formatCurrency, formatTableDate } from "@/lib/formatters";
import { statusBadgeProps, statusTone } from "@/lib/status-tone";
import { cn } from "@/lib/utils";
import {
  useExportPayments,
  usePayments,
  usePaymentStore,
  useSoftDeletePayment,
  useVerifyPayment,
} from "@/stores/usePaymentStore";
import type { Payment } from "@/types";

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
  const [paymentToSoftDelete, setPaymentToSoftDelete] = useState<Payment | null>(null);

  // Role-based permissions for actions
  const { canEdit, canSoftDelete, canVerifyPayments } = useUserRole();

  // Mutations
  const softDeletePayment = useSoftDeletePayment();
  const verifyPayment = useVerifyPayment();
  const exportPayments = useExportPayments();

  // Data
  const { data: payments = [], isLoading, error } = usePayments();

  // Filter by booking if provided
  const filteredPayments = bookingId
    ? payments.filter((p) => p.booking_id === bookingId)
    : payments;

  const handleSoftDelete = useCallback((payment: Payment) => {
    setPaymentToSoftDelete(payment);
  }, []);

  const confirmSoftDelete = useCallback(async () => {
    if (!paymentToSoftDelete) return;

    try {
      await softDeletePayment.mutateAsync(paymentToSoftDelete.payment_id);
    } catch (error) {
      console.error("Failed to remove payment:", error);
      toast.error("Failed to remove payment. Please try again.");
    } finally {
      setPaymentToSoftDelete(null);
    }
  }, [softDeletePayment, paymentToSoftDelete]);

  const handleVerify = useCallback(
    async (payment: Payment) => {
      try {
        await verifyPayment.mutateAsync(payment.payment_id);
      } catch (error) {
        console.error("Failed to verify payment:", error);
        toast.error("Failed to verify payment. Please try again.");
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
        header: ({ header }: { header: Header<Payment, unknown> }) => (
          <SortableHeader header={header}>Date</SortableHeader>
        ),
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
                to="/admin/bookings/$bookingId"
                params={{ bookingId }}
                className="text-primary font-medium whitespace-nowrap hover:underline"
                preload="intent"
              >
                {booking.booking_reference}
              </Link>
              <div className="text-muted-foreground text-xs">{booking.guest_name}</div>
            </div>
          );
        },
        size: 150,
      }),

      columnHelper.accessor("amount", {
        id: "amount",
        header: ({ header }: { header: Header<Payment, unknown> }) => (
          <SortableHeader header={header} className="text-right">
            Amount
          </SortableHeader>
        ),
        cell: ({ getValue }) => (
          <span className="text-foreground font-semibold tabular-nums">
            {formatCurrency(getValue())}
          </span>
        ),
        meta: { align: "right" },
        size: 100,
      }),

      columnHelper.accessor("payment_method", {
        id: "payment_method",
        header: "Method",
        cell: ({ getValue }) => {
          const method = getValue();
          if (!method) return "-";

          return <StatusBadge tone="neutral">{method}</StatusBadge>;
        },
        size: 100,
      }),

      columnHelper.accessor((row) => row.booking?.payment_status, {
        id: "payment_status",
        header: "Booking Payment Status",
        cell: ({ getValue }) => {
          const status = getValue() as string | undefined;
          if (!status) return "-";

          return <StatusBadge tone={statusTone(status)}>{status}</StatusBadge>;
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
            <span className="text-muted-foreground text-xs">No receipt</span>
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
            // View Details - always visible
            {
              label: "View Details",
              onClick: () => onViewPayment?.(payment),
            },
            // Edit Payment - requires canEdit permission
            ...(canEdit
              ? [
                  {
                    label: "Edit Payment",
                    onClick: () => onEditPayment?.(payment),
                  },
                ]
              : []),
            // Verify Payment - requires canVerifyPayments permission
            ...(canVerifyPayments && payment.booking?.payment_status !== "Completed"
              ? [
                  {
                    label: "Verify Payment",
                    onClick: () => handleVerify(payment),
                  },
                ]
              : []),
            // Download Receipt - always visible (read-only action)
            {
              label: "Download Receipt",
              onClick: () => payment.proof_url && window.open(payment.proof_url, "_blank"),
              disabled: !payment.proof_url,
            },
            // Remove (soft-delete) - manager+; payments are never hard-deleted from the UI
            ...(canSoftDelete
              ? [
                  {
                    label: "Remove",
                    onClick: () => handleSoftDelete(payment),
                  },
                ]
              : []),
          ];

          return <ActionMenu actions={actions} />;
        },
        size: 80,
      }),
    ],
    [
      onViewPayment,
      onEditPayment,
      handleSoftDelete,
      handleVerify,
      canEdit,
      canSoftDelete,
      canVerifyPayments,
    ]
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
          <div className="bg-muted h-4 w-1/4 rounded"></div>
          <div className="bg-muted h-10 rounded"></div>
          <div className="bg-muted h-10 rounded"></div>
          <div className="bg-muted h-10 rounded"></div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-danger-foreground text-center">
          Error loading payments: {error.message}
        </div>
      </Card>
    );
  }

  const activeFilterCount = [filters.status, filters.method].filter(Boolean).length;

  return (
    <div className={cn("@container space-y-4", className)}>
      {/* Summary for narrow panes; wide panes read the table */}
      <div className="grid grid-cols-2 gap-3 @3xl:hidden">
        <Card className="p-3">
          <div className="text-muted-foreground text-xs">Total Amount</div>
          <div className="text-lg font-semibold tabular-nums">{formatCurrency(stats.total)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-muted-foreground text-xs">Payments</div>
          <div className="text-lg font-semibold tabular-nums">
            {stats.verified}/{stats.count} Verified
          </div>
        </Card>
      </div>

      <FilterBar
        search={
          <TableSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search payments..."
          />
        }
        filters={
          <>
            <FilterPopover
              isActive={!!filters.status}
              content={
                <div className="space-y-2">
                  <div className="text-sm font-medium">Payment Status</div>
                  <Select
                    value={filters.status || "all"}
                    onValueChange={(value) =>
                      setFilters({
                        ...filters,
                        status: value === "all" ? undefined : (value as typeof filters.status),
                      })
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
                      setFilters({
                        ...filters,
                        method: value === "all" ? undefined : (value as typeof filters.method),
                      })
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
          </>
        }
        activeFilterCount={activeFilterCount}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exportPayments.isPending}
          >
            <Download className="mr-1 h-3 w-3" />
            Export CSV
          </Button>
        }
      />

      <DataTable
        table={table}
        label="Payments"
        renderCard={(row) => (
          <PaymentCard
            payment={row.original}
            canEdit={canEdit}
            onEdit={() =>
              onEditPayment?.({
                ...row.original,
                booking: row.original.booking || undefined,
              } as Payment)
            }
          />
        )}
        emptyState={
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
        }
      />

      <TablePagination table={table} totalItems={filteredPayments.length} />

      {/* Soft-Delete (Remove) Confirmation Dialog */}
      <AlertDialog
        open={!!paymentToSoftDelete}
        onOpenChange={(open) => !open && setPaymentToSoftDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this payment of{" "}
              <span className="font-semibold">
                {paymentToSoftDelete && formatCurrency(paymentToSoftDelete.amount)}
              </span>
              ? The payment record will be hidden but can be restored by an owner.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSoftDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

function PaymentCard({
  payment,
  canEdit,
  onEdit,
}: {
  payment: Payment;
  canEdit: boolean;
  onEdit: () => void;
}) {
  return (
    <ListCard>
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-lg font-semibold tabular-nums">
              {formatCurrency(payment.amount)}
            </div>
            <div className="text-muted-foreground text-xs">
              {formatTableDate(payment.payment_date || "")}
            </div>
          </div>
          <StatusBadge {...statusBadgeProps(payment.booking?.payment_status, "Pending")} />
        </div>

        {payment.booking && (
          <ListCardRow label="Booking" value={payment.booking.booking_reference} />
        )}

        {payment.payment_method && <ListCardRow label="Method" value={payment.payment_method} />}

        <div className="flex gap-2 pt-2">
          {payment.proof_url && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => payment.proof_url && window.open(payment.proof_url, "_blank")}
            >
              <Download className="mr-1 h-4 w-4" />
              Receipt
            </Button>
          )}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="mr-1 h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      </div>
    </ListCard>
  );
}

// Export with error boundary
export const PaymentsTable = withErrorBoundary(PaymentsTableComponent, {
  level: "component",
});
