import React, { useCallback, useMemo, useState } from "react";

import { Link } from "@tanstack/react-router";
import {
  createColumnHelper,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type ExpandedState,
  type Header,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Download,
  Edit,
  Eye,
  Mail,
  Phone,
} from "lucide-react";
import { toast } from "sonner";

import { withErrorBoundary } from "@/components/ErrorBoundary";
import {
  ActionMenu,
  DataTable,
  ListCard,
  SortableHeader,
  StatusBadge,
  TableEmptyState,
  TablePagination,
  TableSearch,
  TableSkeleton,
} from "@/components/patterns";
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
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatCurrency, formatPhoneNumber, formatTableDate } from "@/lib/formatters";
import { logger } from "@/lib/logger";
import { statusBadgeProps } from "@/lib/status-tone";
import { cn } from "@/lib/utils";
import type { Guest } from "@/types";

import {
  useDeleteGuest,
  useExportGuests,
  useGuestBookings,
  useGuests,
  useGuestStore,
} from "../../stores/useGuestStore";
import { GuestEditDialog } from "./GuestEditDialog";

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
                <StatusBadge {...statusBadgeProps(booking.booking_status, "Pending")} />
              </div>
              <div className="text-sm text-neutral-600">
                {booking.booking_units?.[0]?.unit?.unit_name} • {formatTableDate(booking.check_in)}{" "}
                - {formatTableDate(booking.check_out)}
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
    <ListCard className="space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-1">
          <div className="font-medium text-neutral-900">{guest.guest_name}</div>
          <div className="text-sm text-neutral-600">{guest.email || "\u2014"}</div>
          <div className="text-sm text-neutral-600">
            {guest.phone_number ? formatPhoneNumber(guest.phone_number) : "\u2014"}
          </div>
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
    </ListCard>
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
  const [guestToDelete, setGuestToDelete] = useState<Guest | null>(null);

  // Mutations
  const exportGuests = useExportGuests();
  const deleteGuest = useDeleteGuest();

  // Data
  const { data: guests = [], isLoading, error } = useGuests();

  // Contact actions
  const handleEmail = (guest: Guest) => {
    if (guest.email) {
      window.open(`mailto:${guest.email}`, "_blank");
    }
  };

  const handleCall = (guest: Guest) => {
    if (guest.phone_number) {
      window.open(`tel:${guest.phone_number}`, "_blank");
    }
  };

  const confirmDeleteGuest = useCallback(async () => {
    if (!guestToDelete) return;
    try {
      await deleteGuest.mutateAsync(guestToDelete.guest_id);
      toast.success("Guest deleted successfully");
      logger.info("Guest deleted successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete guest");
    } finally {
      setGuestToDelete(null);
    }
  }, [deleteGuest, guestToDelete]);

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
        header: ({ header }: { header: Header<Guest, unknown> }) => (
          <SortableHeader header={header}>Guest Name</SortableHeader>
        ),
        cell: ({ getValue, row }) => (
          <div className="space-y-1">
            <Link
              to="/admin/guests/$guestId"
              params={{ guestId: row.original.guest_id }}
              className="font-medium text-blue-600 transition-colors hover:underline"
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
            <div className="text-sm break-all text-neutral-900">{getValue() || "\u2014"}</div>
            <div className="text-sm text-neutral-600">
              {row.original.phone_number ? formatPhoneNumber(row.original.phone_number) : "\u2014"}
            </div>
          </div>
        ),
        size: 250,
      }),

      columnHelper.accessor("total_bookings", {
        header: ({ header }: { header: Header<Guest, unknown> }) => (
          <SortableHeader header={header} className="text-center">
            Bookings
          </SortableHeader>
        ),
        cell: ({ getValue }) => (
          <div className="text-center">
            <div className="font-mono text-lg font-semibold text-neutral-900">{getValue()}</div>
          </div>
        ),
        size: 100,
      }),

      columnHelper.accessor("total_spent", {
        header: ({ header }: { header: Header<Guest, unknown> }) => (
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
              onClick: () => setGuestToDelete(guest),
              className: "text-red-600 hover:text-red-700",
            },
          ];

          return <ActionMenu actions={actions} />;
        },
        size: 80,
      }),
    ],
    [onViewGuest]
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
    return <TableSkeleton rows={6} columns={6} toolbar label="Loading guests" />;
  }

  // Error state
  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">Error loading guests: {error.message}</div>
      </Card>
    );
  }

  return (
    <div className={cn("@container space-y-4", className)}>
      <div className="grid grid-cols-2 gap-4 @3xl:grid-cols-5">
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

        <Card className="p-4 @max-3xl:hidden">
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

        <Card className="p-4 @max-3xl:hidden">
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

        <Card className="p-4 @max-3xl:hidden">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-indigo-500" />
              <div className="text-sm font-medium text-neutral-700">Total Bookings</div>
            </div>
            <div className="text-2xl font-semibold text-neutral-900">{stats.totalBookings}</div>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex w-full items-center gap-3 @xl:w-auto">
          <TableSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search guests by name, email, or phone..."
            className="w-full @xl:w-80"
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

      <DataTable
        table={table}
        label="Guests"
        renderCard={(row) => (
          <GuestCard
            guest={row.original}
            onView={() => onViewGuest?.(row.original)}
            onEdit={() => onEditGuest?.(row.original)}
            onEmail={() => handleEmail(row.original)}
            onCall={() => handleCall(row.original)}
          />
        )}
        renderExpandedRow={(row) => <GuestBookingHistory guestId={row.original.guest_id} />}
        emptyState={
          <TableEmptyState
            title="No guests found"
            description={
              searchQuery ? "No guests match your search criteria." : "No guests in the system yet."
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

      {/* Delete Guest Confirmation Dialog */}
      <AlertDialog open={!!guestToDelete} onOpenChange={(open) => !open && setGuestToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Guest</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete guest &quot;{guestToDelete?.guest_name}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteGuest} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Export with error boundary
export const GuestsTable = withErrorBoundary(GuestsTableComponent, {
  level: "component",
});
