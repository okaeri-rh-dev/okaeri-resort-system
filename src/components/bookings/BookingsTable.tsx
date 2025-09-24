import React, { useState, useMemo, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useResponsiveView } from "@/hooks";
import { CalendarDays, Upload, Eye, Edit, X, Download } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  useBookings,
  useUpdateBookingStatus,
  useUploadPaymentProof,
  useCancelBooking,
  useDeleteBooking,
  useBookingStore,
} from "../../stores/useBookingStore";

import type { Booking, BookingStatus, PaymentStatus } from "@/types";

import {
  formatCurrency,
  formatTableDate,
  formatFullDate,
  formatPhoneNumber,
  StatusBadge,
  SortableHeader,
  TableSearch,
  FilterPopover,
  TablePagination,
  ActionMenu,
  TableEmptyState,
  ResponsiveTable,
  MobileCard,
  MobileCardRow,
  exportToCSV,
} from "../tables/utils";
import { BookingsTableSkeleton } from "@/components/skeletons";

const columnHelper = createColumnHelper<Booking>();

// ============================================
// MOBILE CARD COMPONENT
// ============================================

interface BookingCardProps {
  booking: Booking;
  onView: () => void;
  onEdit: () => void;
  onUploadPayment: () => void;
  onCancel: () => void;
}

const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  onView,
  onEdit,
  onUploadPayment,
  onCancel,
}) => {
  return (
    <MobileCard className="space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="font-mono text-sm font-medium text-blue-600">
            {booking.booking_reference}
          </div>
          <div className="font-medium text-neutral-900">{booking.guest_name}</div>
        </div>
        <div className="flex space-x-1">
          <StatusBadge status={booking.booking_status} />
          <StatusBadge status={booking.payment_status} />
        </div>
      </div>

      <div className="space-y-2">
        <MobileCardRow label="Unit" value={booking.unit?.unit_name || "N/A"} />
        <MobileCardRow
          label="Dates"
          value={`${formatTableDate(booking.check_in)} - ${formatTableDate(booking.check_out)}`}
        />
        <MobileCardRow label="Guests" value={booking.num_guests} />
        <MobileCardRow
          label="Amount"
          value={
            <span className="font-mono font-semibold text-neutral-900">
              {formatCurrency(booking.total_amount)}
            </span>
          }
        />
        <MobileCardRow label="Contact" value={formatPhoneNumber(booking.contact_number)} />
      </div>

      <div className="flex space-x-2 border-t border-neutral-100 pt-2">
        <Button variant="outline" size="sm" onClick={onView} className="flex-1">
          <Eye className="mr-1 h-3 w-3" />
          View
        </Button>
        <Button variant="outline" size="sm" onClick={onEdit} className="flex-1">
          <Edit className="mr-1 h-3 w-3" />
          Edit
        </Button>
        {booking.payment_status !== "Completed" && (
          <Button variant="outline" size="sm" onClick={onUploadPayment} className="flex-1">
            <Upload className="mr-1 h-3 w-3" />
            Payment
          </Button>
        )}
        {booking.booking_status !== "Cancelled" && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="flex-1 text-red-600 hover:text-red-700"
          >
            <X className="mr-1 h-3 w-3" />
            Cancel
          </Button>
        )}
      </div>
    </MobileCard>
  );
};

// ============================================
// MAIN BOOKINGS TABLE COMPONENT
// ============================================

interface BookingsTableProps {
  onViewBooking?: (booking: Booking) => void;
  onEditBooking?: (booking: Booking) => void;
  className?: string;
}

export const BookingsTable: React.FC<BookingsTableProps> = ({
  onViewBooking,
  onEditBooking,
  className,
}) => {
  // Store state
  const {
    filters,
    setFilters,
    resetFilters,
    searchQuery,
    setSearchQuery,
    tableState,
    setTableState,
  } = useBookingStore();

  // Local state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to?: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [tempDateRange, setTempDateRange] = useState<{
    from: Date | undefined;
    to?: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });
  const [dateFilterOpen, setDateFilterOpen] = useState(false);

  // Use ultra-performant responsive detection with MediaQuery API
  const { isMobile } = useResponsiveView();

  // Mutations
  const updateBookingStatus = useUpdateBookingStatus();
  const uploadPaymentProof = useUploadPaymentProof();
  const cancelBooking = useCancelBooking();
  const deleteBooking = useDeleteBooking();

  // Data
  const { data: bookings = [], isLoading, error } = useBookings();

  // Memoize payment upload handler to prevent columns re-creation
  const handleUploadPayment = useCallback(
    (booking: Booking) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*,.pdf";
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          uploadPaymentProof.mutate({
            bookingId: booking.booking_id,
            file,
          });
        }
      };
      input.click();
    },
    [uploadPaymentProof]
  );

  // Define columns
  const columns = useMemo(
    () => [
      columnHelper.accessor("guest_name", {
        header: ({ header }) => <SortableHeader header={header}>Guest</SortableHeader>,
        cell: ({ row }) => (
          <div className="space-y-1">
            <div className="font-medium text-neutral-900">{row.original.guest_name}</div>
            <div className="text-xs text-neutral-600">
              {formatPhoneNumber(row.original.contact_number)}
            </div>
          </div>
        ),
        size: 200,
      }),

      columnHelper.accessor("unit", {
        header: "Unit",
        cell: ({ getValue }) => {
          const unit = getValue();
          return <div className="text-sm">{unit?.unit_name || "N/A"}</div>;
        },
        size: 120,
      }),

      columnHelper.accessor("check_in", {
        header: ({ header }) => <SortableHeader header={header}>Check-in</SortableHeader>,
        cell: ({ getValue, row }) => (
          <div className="space-y-1">
            <div className="text-sm font-medium">{formatTableDate(getValue())}</div>
            <div className="text-xs text-neutral-600">
              {formatTableDate(row.original.check_out)}
            </div>
          </div>
        ),
        size: 100,
      }),

      columnHelper.accessor("num_guests", {
        header: "Guests",
        cell: ({ getValue }) => <div className="text-center font-mono text-sm">{getValue()}</div>,
        size: 80,
      }),

      columnHelper.accessor("total_amount", {
        header: ({ header }) => (
          <SortableHeader header={header} className="text-right">
            Amount
          </SortableHeader>
        ),
        cell: ({ getValue }) => (
          <div className="text-right font-mono font-semibold text-neutral-900">
            {formatCurrency(getValue())}
          </div>
        ),
        size: 120,
      }),

      columnHelper.accessor("booking_status", {
        header: "Status",
        cell: ({ getValue }) => <StatusBadge status={getValue()} />,
        size: 100,
      }),

      columnHelper.accessor("payment_status", {
        header: "Payment",
        cell: ({ getValue }) => <StatusBadge status={getValue()} />,
        size: 100,
      }),

      columnHelper.accessor("booking_reference", {
        header: ({ header }) => <SortableHeader header={header}>Reference</SortableHeader>,
        cell: ({ getValue }) => (
          <div className="font-mono text-sm font-medium text-blue-600">{getValue()}</div>
        ),
        size: 120,
      }),

      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const booking = row.original;

          const actions = [
            {
              label: "View Details",
              onClick: () => onViewBooking?.(booking),
            },
            {
              label: "Edit Booking",
              onClick: () => onEditBooking?.(booking),
            },
            ...(booking.payment_status !== "Completed"
              ? [
                  {
                    label: "Upload Payment",
                    onClick: () => handleUploadPayment(booking),
                  },
                ]
              : []),
            ...(booking.booking_status === "Pending"
              ? [
                  {
                    label: "Confirm",
                    onClick: () =>
                      updateBookingStatus.mutate({
                        bookingId: booking.booking_id,
                        status: "Confirmed",
                      }),
                  },
                ]
              : []),
            ...(booking.booking_status !== "Cancelled"
              ? [
                  {
                    label: "Cancel",
                    onClick: () => cancelBooking.mutate(booking.booking_id),
                    variant: "destructive" as const,
                  },
                ]
              : []),
            {
              label: "Delete",
              onClick: () => {
                if (
                  confirm(
                    `Are you sure you want to permanently delete booking "${booking.booking_reference}"? This action cannot be undone.`
                  )
                ) {
                  deleteBooking.mutate(booking.booking_id);
                }
              },
              className: "text-red-600 hover:text-red-700",
            },
          ];

          return <ActionMenu actions={actions} />;
        },
        size: 80,
      }),
    ],
    [
      onViewBooking,
      onEditBooking,
      updateBookingStatus,
      cancelBooking,
      deleteBooking,
      handleUploadPayment,
    ]
  );

  // Export data with Philippine business compliance
  const handleExport = async () => {
    try {
      // Import the enhanced export function for Philippine compliance
      const { exportToCSV: exportEnhanced } = await import("@/utils/reports");

      const exportData = bookings.map((booking) => ({
        booking_reference: booking.booking_reference,
        guest_name: booking.guest_name,
        unit_name: booking.unit?.unit_name || "N/A",
        check_in: booking.check_in, // Let the export function handle date formatting
        check_out: booking.check_out,
        number_of_guests: booking.num_guests,
        total_amount: booking.total_amount, // Let the export function handle currency formatting
        booking_status: booking.booking_status,
        payment_status: booking.payment_status,
        payment_method: booking.payment_method || "N/A",
        contact_number: booking.contact_number, // Let the export function handle phone formatting
        email: booking.email,
        special_requests: booking.special_requests || "",
        created_date: booking.created_at,
      }));

      await exportEnhanced(
        exportData,
        "bookings",
        [
          "Booking Reference",
          "Guest Name",
          "Unit Name",
          "Check In",
          "Check Out",
          "Number of Guests",
          "Total Amount",
          "Booking Status",
          "Payment Status",
          "Payment Method",
          "Contact Number",
          "Email",
          "Special Requests",
          "Created Date",
        ],
        {
          philippineFormat: true,
          includeTimestamp: true,
          onSuccess: (filename) => {
            console.log(`Successfully exported bookings to ${filename}`);
          },
          onError: (error) => {
            console.error("Export failed:", error);
            alert(`Export failed: ${error}`);
          },
        }
      );
    } catch (error) {
      // Fallback to basic export if enhanced version fails
      console.error("Enhanced export failed, using fallback:", error);
      exportToCSV(
        bookings.map((booking) => ({
          reference: booking.booking_reference,
          guest_name: booking.guest_name,
          unit: booking.unit?.unit_name || "N/A",
          check_in: formatFullDate(booking.check_in),
          check_out: formatFullDate(booking.check_out),
          guests: booking.num_guests,
          amount: booking.total_amount,
          booking_status: booking.booking_status,
          payment_status: booking.payment_status,
          contact: booking.contact_number,
          email: booking.email,
        })),
        "bookings"
      );
    }
  };

  // Memoize data transformation to prevent table re-initialization
  // Note: API response may not include all Unit properties, adding defaults
  const typedBookings = useMemo(
    () =>
      bookings.map((booking) => ({
        ...booking,
        unit: booking.unit
          ? {
              ...booking.unit,
              base_occupancy: booking.unit.base_occupancy || 1,
              extra_person_rate: booking.unit.extra_person_rate || 0,
            }
          : undefined,
      })),
    [bookings] // Only recalculate when bookings data changes
  );

  const table = useReactTable({
    data: typedBookings,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      pagination: tableState.pagination || { pageIndex: 0, pageSize: 10 },
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: (updater) => {
      const newPagination =
        typeof updater === "function"
          ? updater(tableState.pagination || { pageIndex: 0, pageSize: 10 })
          : updater;
      setTableState({ pagination: newPagination });
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // Loading state
  if (isLoading) {
    return <BookingsTableSkeleton isMobile={isMobile} rows={8} />;
  }

  // Error state
  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">Error loading bookings: {error.message}</div>
      </Card>
    );
  }

  // Mobile view
  if (isMobile) {
    return (
      <div className={cn("space-y-4", className)}>
        {/* Mobile filters */}
        <div className="space-y-3">
          <TableSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search bookings..."
            className="w-full"
          />

          <div className="flex space-x-2">
            <Select
              value={filters.status || "all"}
              onValueChange={(value: string) =>
                setFilters({
                  ...filters,
                  status: value === "all" ? undefined : (value as BookingStatus),
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Confirmed">Confirmed</SelectItem>
                <SelectItem value="CheckedIn">Checked In</SelectItem>
                <SelectItem value="CheckedOut">Checked Out</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.payment_status || "all"}
              onValueChange={(value: string) =>
                setFilters({
                  ...filters,
                  payment_status: value === "all" ? undefined : (value as PaymentStatus),
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Payments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Partial">Partial</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              disabled={!Object.keys(filters).length && !searchQuery}
            >
              Clear Filters
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-1 h-3 w-3" />
              Export
            </Button>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="space-y-3">
          {table.getRowModel().rows.length === 0 ? (
            <TableEmptyState
              title="No bookings found"
              description="No bookings match your current filters."
              action={{
                label: "Clear Filters",
                onClick: resetFilters,
              }}
            />
          ) : (
            table
              .getRowModel()
              .rows.map((row) => (
                <BookingCard
                  key={row.id}
                  booking={row.original}
                  onView={() => onViewBooking?.(row.original)}
                  onEdit={() => onEditBooking?.(row.original)}
                  onUploadPayment={() => handleUploadPayment(row.original)}
                  onCancel={() => cancelBooking.mutate(row.original.booking_id)}
                />
              ))
          )}
        </div>

        {/* Mobile pagination */}
        <TablePagination table={table} totalItems={bookings.length} />
      </div>
    );
  }

  // Desktop view
  return (
    <div className={cn("space-y-4", className)}>
      {/* Desktop filters */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <TableSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search bookings..."
            className="min-w-[200px]"
          />

          <FilterPopover
            isActive={!!filters.status}
            content={
              <div className="space-y-2">
                <div className="text-sm font-medium">Booking Status</div>
                <Select
                  value={filters.status || "all"}
                  onValueChange={(value: string) =>
                    setFilters({
                      ...filters,
                      status: value === "all" ? undefined : (value as BookingStatus),
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Confirmed">Confirmed</SelectItem>
                    <SelectItem value="CheckedIn">Checked In</SelectItem>
                    <SelectItem value="CheckedOut">Checked Out</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            }
          >
            Status
          </FilterPopover>

          <FilterPopover
            isActive={!!filters.payment_status}
            content={
              <div className="space-y-2">
                <div className="text-sm font-medium">Payment Status</div>
                <Select
                  value={filters.payment_status || "all"}
                  onValueChange={(value: string) =>
                    setFilters({
                      ...filters,
                      payment_status: value === "all" ? undefined : (value as PaymentStatus),
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Payments</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Partial">Partial</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Refunded">Refunded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            }
          >
            Payment
          </FilterPopover>

          <FilterPopover
            isActive={!!(filters.date_from || filters.date_to)}
            open={dateFilterOpen}
            onOpenChange={(open) => {
              setDateFilterOpen(open);
              if (open) {
                // Initialize temp state with applied filters when opening
                setTempDateRange(dateRange);
              }
            }}
            showActions={true}
            onApply={() => {
              // Apply the temporary selection to the actual filters
              setDateRange(tempDateRange);
              setFilters({
                ...filters,
                date_from: tempDateRange?.from?.toISOString(),
                date_to: tempDateRange?.to?.toISOString(),
              });
            }}
            onClear={() => {
              // Clear the temporary selection
              setTempDateRange({ from: undefined, to: undefined });
            }}
            content={
              <div className="space-y-3">
                <div className="text-sm font-medium">Date Range</div>
                <Calendar
                  mode="range"
                  selected={tempDateRange}
                  onSelect={setTempDateRange}
                  className="rounded-md border"
                  required={false}
                />
              </div>
            }
          >
            <CalendarDays className="mr-1 h-3 w-3" />
            Dates
          </FilterPopover>

          {(Object.keys(filters).length > 0 || searchQuery) && (
            <Button variant="outline" size="sm" onClick={resetFilters}>
              Clear Filters
            </Button>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-1 h-3 w-3" />
          Export CSV
        </Button>
      </div>

      {/* Desktop table */}
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

        {table.getRowModel().rows.length === 0 && (
          <div className="p-8">
            <TableEmptyState
              title="No bookings found"
              description="No bookings match your current filters."
              action={{
                label: "Clear Filters",
                onClick: resetFilters,
              }}
            />
          </div>
        )}
      </ResponsiveTable>

      {/* Desktop pagination */}
      <TablePagination table={table} totalItems={bookings.length} />
    </div>
  );
};
