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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  buttonVariants,
  Card,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DataTable,
  ListCard,
  SortableHeader,
  StatusBadge,
  TableEmptyState,
  TablePagination,
  TableSearch,
  TableSkeleton,
} from "@/components/patterns";
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
          <div key={i} className="bg-muted h-4 animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className={cn("text-muted-foreground p-4 text-center", className)}>
        No booking history available
      </div>
    );
  }

  return (
    <div className={cn("space-y-3 p-4", className)}>
      <div className="text-foreground text-sm font-medium">
        Booking History ({bookings.length} bookings)
      </div>
      <div className="space-y-2">
        {bookings.slice(0, 5).map((booking) => (
          <div
            key={booking.booking_id}
            className="border-border bg-muted flex items-center justify-between rounded-md border p-3"
          >
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <div className="text-foreground text-xs font-medium tabular-nums">
                  {booking.booking_reference}
                </div>
                <StatusBadge {...statusBadgeProps(booking.booking_status, "Pending")} />
              </div>
              <div className="text-muted-foreground text-sm">
                {booking.booking_units?.[0]?.unit?.unit_name} • {formatTableDate(booking.check_in)}{" "}
                - {formatTableDate(booking.check_out)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold tabular-nums">
                {formatCurrency(booking.total_amount)}
              </div>
              <div className="text-muted-foreground text-xs">{booking.num_guests} guests</div>
            </div>
          </div>
        ))}
        {bookings.length > 5 && (
          <div className="text-muted-foreground text-center text-xs">
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
          <div className="text-foreground font-medium">{guest.guest_name}</div>
          <div className="text-muted-foreground text-sm">{guest.email || "\u2014"}</div>
          <div className="text-muted-foreground text-sm">
            {guest.phone_number ? formatPhoneNumber(guest.phone_number) : "\u2014"}
          </div>
        </div>
        <div className="space-y-1 text-right">
          <div className="text-foreground font-semibold tabular-nums">
            {formatCurrency(guest.total_spent ?? 0)}
          </div>
          <div className="text-muted-foreground text-xs">{guest.total_bookings ?? 0} bookings</div>
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
            <span className="text-muted-foreground text-xs">Booking History</span>
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
              className="text-primary font-medium transition-colors hover:underline"
              preload="intent"
            >
              {getValue()}
            </Link>
            <div className="text-muted-foreground text-xs">
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
            <div className="text-foreground text-sm break-all">{getValue() || "\u2014"}</div>
            <div className="text-muted-foreground text-sm">
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
            <div className="text-foreground text-lg font-semibold tabular-nums">{getValue()}</div>
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
              <div className="text-foreground font-semibold tabular-nums">
                {formatCurrency(getValue() ?? 0)}
              </div>
              <div className="text-muted-foreground text-xs">
                {formatCurrency(avgPerBooking)} avg
              </div>
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
              {isVIP && <StatusBadge tone="info">VIP</StatusBadge>}
              {isRepeat && <StatusBadge tone="success">Repeat</StatusBadge>}
              {!isVIP && !isRepeat && <StatusBadge tone="neutral">New</StatusBadge>}
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
              variant: "destructive" as const,
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
      <Card>
        <div className="text-destructive text-center">Error loading guests: {error.message}</div>
      </Card>
    );
  }

  return (
    <div className={cn("@container space-y-4", className)}>
      <div className="grid grid-cols-1 gap-4 @md:grid-cols-2 @3xl:grid-cols-3 @6xl:grid-cols-5">
        <Card padding="sm">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="bg-muted-foreground size-2 rounded-full" aria-hidden="true" />
              <div className="text-muted-foreground text-xs font-medium">Total Guests</div>
            </div>
            <div className="font-display text-3xl font-semibold tabular-nums">
              {stats.totalGuests}
            </div>
          </div>
        </Card>

        <Card padding="sm">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <DollarSign className="text-muted-foreground size-4" aria-hidden="true" />
              <div className="text-muted-foreground text-xs font-medium">Total Revenue</div>
            </div>
            <div className="font-display text-3xl font-semibold tabular-nums">
              {formatCurrency(stats.totalRevenue)}
            </div>
          </div>
        </Card>

        <Card padding="sm" className="@max-3xl:hidden">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Calendar className="text-muted-foreground size-4" aria-hidden="true" />
              <div className="text-muted-foreground text-xs font-medium">Avg per Guest</div>
            </div>
            <div className="font-display text-3xl font-semibold tabular-nums">
              {formatCurrency(stats.avgRevenuePerGuest)}
            </div>
          </div>
        </Card>

        <Card padding="sm" className="@max-3xl:hidden">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="bg-muted-foreground size-2 rounded-full" aria-hidden="true" />
              <div className="text-muted-foreground text-xs font-medium">Repeat Rate</div>
            </div>
            <div className="font-display text-3xl font-semibold tabular-nums">
              {stats.repeatRate.toFixed(1)}%
            </div>
          </div>
        </Card>

        <Card padding="sm" className="@max-3xl:hidden">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="bg-muted-foreground size-2 rounded-full" aria-hidden="true" />
              <div className="text-muted-foreground text-xs font-medium">Total Bookings</div>
            </div>
            <div className="font-display text-3xl font-semibold tabular-nums">
              {stats.totalBookings}
            </div>
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
            <AlertDialogAction
              onClick={confirmDeleteGuest}
              className={buttonVariants({ variant: "destructive" })}
            >
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
