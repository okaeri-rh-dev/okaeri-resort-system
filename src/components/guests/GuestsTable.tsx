import React, { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getExpandedRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type ExpandedState,
} from "@tanstack/react-table";
import { withErrorBoundary } from "@/components/ErrorBoundary";
import { useResponsiveView } from "@/hooks";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  Edit,
  Mail,
  Phone,
  Download,
  Calendar,
  DollarSign,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Link } from "@tanstack/react-router";

import {
  useGuests,
  useGuestBookings,
  useGuestStore,
  useDeleteGuest,
  useExportGuests,
} from "../../stores/useGuestStore";

import type { Guest } from "@/types";
import { GuestEditDialog } from "./GuestEditDialog";

import {
  formatCurrency,
  formatTableDate,
  formatPhoneNumber,
  StatusBadge,
  SortableHeader,
  TableSearch,
  TablePagination,
  ActionMenu,
  TableEmptyState,
  ResponsiveTable,
  MobileCard,
} from "../tables/utils";
import { GuestsTableSkeleton } from "@/components/skeletons";

const columnHelper = createColumnHelper<Guest>();

// ============================================
// GUEST BOOKING HISTORY COMPONENT
// ============================================

interface GuestBookingHistoryProps {
  guestId: string;
  className?: string;
}

const GuestBookingHistory: React.FC<GuestBookingHistoryProps> = ({ guestId, className }) => {
  const { data: bookings = [], isLoading } = useGuestBookings(guestId);

  if (isLoading) {
    return (
      <div className={cn("space-y-2 p-4", className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-4 animate-pulse rounded bg-neutral-200" />
        ))}
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className={cn("p-4 text-center text-neutral-500", className)}>
        No booking history available
      </div>
    );
  }

  return (
    <div className={cn("space-y-3 p-4", className)}>
      <div className="text-sm font-medium text-neutral-700">
        Booking History ({bookings.length} bookings)
      </div>
      <div className="space-y-2">
        {bookings.slice(0, 5).map((booking) => (
          <div
            key={booking.booking_id}
            className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 p-3"
          >
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <div className="font-mono text-xs font-medium text-blue-600">
                  {booking.booking_reference}
                </div>
                <StatusBadge status={booking.booking_status ?? "Pending"} />
              </div>
              <div className="text-sm text-neutral-600">
                {booking.unit?.unit_name} • {formatTableDate(booking.check_in)} -{" "}
                {formatTableDate(booking.check_out)}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-sm font-semibold">
                {formatCurrency(booking.total_amount)}
              </div>
              <div className="text-xs text-neutral-600">{booking.num_guests} guests</div>
            </div>
          </div>
        ))}
        {bookings.length > 5 && (
          <div className="text-center text-xs text-neutral-500">
            And {bookings.length - 5} more bookings...
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// MOBILE CARD COMPONENT
// ============================================

interface GuestCardProps {
  guest: Guest;
  onView: () => void;
  onEdit: () => void;
  onEmail: () => void;
  onCall: () => void;
}

const GuestCard: React.FC<GuestCardProps> = ({ guest, onView, onEdit, onEmail, onCall }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <MobileCard className="space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-1">
          <div className="font-medium text-neutral-900">{guest.guest_name}</div>
          <div className="text-sm text-neutral-600">{guest.email}</div>
          <div className="text-sm text-neutral-600">{formatPhoneNumber(guest.phone_number)}</div>
        </div>
        <div className="space-y-1 text-right">
          <div className="font-mono font-semibold text-neutral-900">
            {formatCurrency(guest.total_spent ?? 0)}
          </div>
          <div className="text-xs text-neutral-600">{guest.total_bookings ?? 0} bookings</div>
        </div>
      </div>

      <div className="flex space-x-2">
        <Button variant="outline" size="sm" onClick={onView} className="flex-1">
          <Eye className="mr-1 h-3 w-3" />
          View
        </Button>
        <Button variant="outline" size="sm" onClick={onEdit} className="flex-1">
          <Edit className="mr-1 h-3 w-3" />
          Edit
        </Button>
        <Button variant="outline" size="sm" onClick={onEmail} className="flex-1">
          <Mail className="mr-1 h-3 w-3" />
          Email
        </Button>
        <Button variant="outline" size="sm" onClick={onCall} className="flex-1">
          <Phone className="mr-1 h-3 w-3" />
          Call
        </Button>
      </div>

      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-auto w-full justify-between p-2">
            <span className="text-xs text-neutral-600">Booking History</span>
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <GuestBookingHistory guestId={guest.guest_id} />
        </CollapsibleContent>
      </Collapsible>
    </MobileCard>
  );
};

// ============================================
// MAIN GUESTS TABLE COMPONENT
// ============================================

interface GuestsTableProps {
  onViewGuest?: (guest: Guest) => void;
  onEditGuest?: (guest: Guest) => void;
  className?: string;
}

const GuestsTableComponent: React.FC<GuestsTableProps> = ({
  onViewGuest,
  onEditGuest,
  className,
}) => {
  // Store state
  const { searchQuery, setSearchQuery } = useGuestStore();

  // Local state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);

  // Use ultra-performant MediaQuery API for responsive detection
  const { isMobile } = useResponsiveView();

  // Mutations
  const exportGuests = useExportGuests();
  const deleteGuest = useDeleteGuest();

  // Data
  const { data: guests = [], isLoading, error } = useGuests();

  // Contact actions
  const handleEmail = (guest: Guest) => {
    window.open(`mailto:${guest.email}`, "_blank");
  };

  const handleCall = (guest: Guest) => {
    window.open(`tel:${guest.phone_number}`, "_blank");
  };

  const handleDelete = async (guest: Guest) => {
    if (
      !confirm(
        `Are you sure you want to delete guest "${guest.guest_name}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await deleteGuest.mutateAsync(guest.guest_id);
      // Using toast from the component would require importing it
      console.log("Guest deleted successfully");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete guest");
    }
  };

  // Export action
  const handleExport = () => {
    exportGuests.mutate();
  };

  // Define columns
  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "expander",
        header: "",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={row.getToggleExpandedHandler()}
            className="h-6 w-6 p-0"
          >
            {row.getIsExpanded() ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </Button>
        ),
        size: 50,
      }),

      columnHelper.accessor("guest_name", {
        header: ({ header }) => <SortableHeader header={header}>Guest Name</SortableHeader>,
        cell: ({ getValue, row }) => (
          <div className="space-y-1">
            <Link
              to="/guests/$guestId"
              params={{ guestId: row.original.guest_id }}
              className="text-blue-600 hover:underline font-medium transition-colors"
              preload="intent"
            >
              {getValue()}
            </Link>
            <div className="text-xs text-neutral-600">
              Member since{" "}
              {row.original.created_at ? formatTableDate(row.original.created_at) : "N/A"}
            </div>
          </div>
        ),
        size: 200,
      }),

      columnHelper.accessor("email", {
        header: "Contact Info",
        cell: ({ getValue, row }) => (
          <div className="space-y-1">
            <div className="text-sm break-all text-neutral-900">{getValue()}</div>
            <div className="text-sm text-neutral-600">
              {formatPhoneNumber(row.original.phone_number)}
            </div>
          </div>
        ),
        size: 250,
      }),

      columnHelper.accessor("total_bookings", {
        header: ({ header }) => (
          <SortableHeader header={header} className="text-center">
            Bookings
          </SortableHeader>
        ),
        cell: ({ getValue }) => (
          <div className="text-center">
            <div className="font-mono text-lg font-semibold text-neutral-900">{getValue()}</div>
            <div className="text-xs text-neutral-600">total</div>
          </div>
        ),
        size: 100,
      }),

      columnHelper.accessor("total_spent", {
        header: ({ header }) => (
          <SortableHeader header={header} className="text-right">
            Total Spent
          </SortableHeader>
        ),
        cell: ({ getValue, row }) => {
          const avgPerBooking =
            (row.original.total_bookings ?? 0) > 0
              ? (getValue() ?? 0) / (row.original.total_bookings ?? 0)
              : 0;

          return (
            <div className="space-y-1 text-right">
              <div className="font-mono font-semibold text-neutral-900">
                {formatCurrency(getValue() ?? 0)}
              </div>
              <div className="text-xs text-neutral-600">{formatCurrency(avgPerBooking)} avg</div>
            </div>
          );
        },
        size: 120,
      }),

      columnHelper.display({
        id: "guest_type",
        header: "Type",
        cell: ({ row }) => {
          const guest = row.original;
          const isVIP = (guest.total_spent ?? 0) > 50000; // ₱50k+
          const isRepeat = (guest.total_bookings ?? 0) > 1;

          return (
            <div className="space-y-1">
              {isVIP && (
                <Badge variant="default" className="text-xs">
                  VIP
                </Badge>
              )}
              {isRepeat && (
                <Badge variant="secondary" className="text-xs">
                  Repeat
                </Badge>
              )}
              {!isVIP && !isRepeat && (
                <Badge variant="outline" className="text-xs">
                  New
                </Badge>
              )}
            </div>
          );
        },
        size: 80,
      }),

      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const guest = row.original;

          const actions = [
            {
              label: "View Profile",
              onClick: () => onViewGuest?.(guest),
            },
            {
              label: "Edit Guest",
              onClick: () => setEditingGuest(guest),
            },
            {
              label: "Send Email",
              onClick: () => handleEmail(guest),
            },
            {
              label: "Call Guest",
              onClick: () => handleCall(guest),
            },
            {
              label: "Delete Guest",
              onClick: () => handleDelete(guest),
              className: "text-red-600 hover:text-red-700",
            },
          ];

          return <ActionMenu actions={actions} />;
        },
        size: 80,
      }),
    ],
    [onViewGuest, onEditGuest]
  );

  // Create table instance
  const table = useReactTable({
    data: guests,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      expanded,
      pagination: { pageIndex: 0, pageSize: 10 },
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
  });

  // Stats calculation
  const stats = useMemo(() => {
    const totalGuests = guests.length;
    const totalRevenue = guests.reduce((sum, guest) => sum + (guest.total_spent ?? 0), 0);
    const totalBookings = guests.reduce((sum, guest) => sum + (guest.total_bookings ?? 0), 0);
    const avgRevenuePerGuest = totalGuests > 0 ? totalRevenue / totalGuests : 0;
    const repeatCustomers = guests.filter((guest) => (guest.total_bookings ?? 0) > 1).length;

    return {
      totalGuests,
      totalRevenue,
      totalBookings,
      avgRevenuePerGuest,
      repeatCustomers,
      repeatRate: totalGuests > 0 ? (repeatCustomers / totalGuests) * 100 : 0,
    };
  }, [guests]);

  // Loading state
  if (isLoading) {
    return <GuestsTableSkeleton isMobile={isMobile} rows={6} />;
  }

  // Error state
  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">Error loading guests: {error.message}</div>
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
            <div className="space-y-1">
              <div className="text-xs text-neutral-600">Total Guests</div>
              <div className="text-lg font-semibold text-neutral-900">{stats.totalGuests}</div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="space-y-1">
              <div className="text-xs text-neutral-600">Total Revenue</div>
              <div className="font-mono text-lg font-semibold text-neutral-900">
                {formatCurrency(stats.totalRevenue)}
              </div>
            </div>
          </Card>
        </div>

        {/* Mobile search */}
        <TableSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search guests..."
          className="w-full"
        />

        <div className="flex justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSearchQuery("")}
            disabled={!searchQuery}
          >
            Clear Search
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exportGuests.isPending}
          >
            <Download className="mr-1 h-3 w-3" />
            Export
          </Button>
        </div>

        {/* Mobile cards */}
        <div className="space-y-3">
          {table.getRowModel().rows.length === 0 ? (
            <TableEmptyState
              title="No guests found"
              description={
                searchQuery ? "No guests match your search." : "No guests in the system yet."
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
          ) : (
            table
              .getRowModel()
              .rows.map((row) => (
                <GuestCard
                  key={row.id}
                  guest={row.original}
                  onView={() => onViewGuest?.(row.original)}
                  onEdit={() => onEditGuest?.(row.original)}
                  onEmail={() => handleEmail(row.original)}
                  onCall={() => handleCall(row.original)}
                />
              ))
          )}
        </div>

        {/* Mobile pagination */}
        <TablePagination table={table} totalItems={guests.length} />
      </div>
    );
  }

  // Desktop view
  return (
    <div className={cn("space-y-4", className)}>
      {/* Desktop stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card className="p-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <div className="text-sm font-medium text-neutral-700">Total Guests</div>
            </div>
            <div className="text-2xl font-semibold text-neutral-900">{stats.totalGuests}</div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              <div className="text-sm font-medium text-neutral-700">Total Revenue</div>
            </div>
            <div className="font-mono text-2xl font-semibold text-neutral-900">
              {formatCurrency(stats.totalRevenue)}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-orange-500" />
              <div className="text-sm font-medium text-neutral-700">Avg per Guest</div>
            </div>
            <div className="font-mono text-2xl font-semibold text-neutral-900">
              {formatCurrency(stats.avgRevenuePerGuest)}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-purple-500" />
              <div className="text-sm font-medium text-neutral-700">Repeat Rate</div>
            </div>
            <div className="text-2xl font-semibold text-neutral-900">
              {stats.repeatRate.toFixed(1)}%
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-indigo-500" />
              <div className="text-sm font-medium text-neutral-700">Total Bookings</div>
            </div>
            <div className="text-2xl font-semibold text-neutral-900">{stats.totalBookings}</div>
          </div>
        </Card>
      </div>

      {/* Desktop filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <TableSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search guests by name, email, or phone..."
            className="w-80"
          />

          {searchQuery && (
            <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>
              Clear Search
            </Button>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exportGuests.isPending}
        >
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
              <React.Fragment key={row.id}>
                <tr
                  className={cn(
                    "h-12 border-b border-neutral-100 hover:bg-neutral-50",
                    index % 2 === 0 && "bg-neutral-50/30"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 text-sm text-neutral-900">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {row.getIsExpanded() && (
                  <tr>
                    <td colSpan={row.getVisibleCells().length} className="p-0">
                      <div className="border-b border-neutral-200 bg-neutral-50">
                        <GuestBookingHistory guestId={row.original.guest_id} />
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {table.getRowModel().rows.length === 0 && (
          <div className="p-8">
            <TableEmptyState
              title="No guests found"
              description={
                searchQuery
                  ? "No guests match your search criteria."
                  : "No guests in the system yet."
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
      <TablePagination table={table} totalItems={guests.length} />

      {/* Edit Guest Dialog */}
      {editingGuest && (
        <GuestEditDialog
          guest={editingGuest}
          open={!!editingGuest}
          onClose={() => setEditingGuest(null)}
          onSuccess={() => setEditingGuest(null)}
        />
      )}
    </div>
  );
};

// Export with error boundary
export const GuestsTable = withErrorBoundary(GuestsTableComponent, {
  level: "component",
});
