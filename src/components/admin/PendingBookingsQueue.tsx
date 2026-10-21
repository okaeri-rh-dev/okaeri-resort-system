/**
 * Pending Bookings Queue Component
 *
 * Displays all pending guest bookings sorted by urgency
 * Features:
 * - Real-time updates (30s refresh)
 * - Color-coded urgency badges
 * - Filter controls (date, urgency, search)
 * - Mobile responsive design
 *
 * Source: vault note [[04-admin-interface]]
 */

import { useMemo, useState } from "react";

import { queryOptions, useQuery } from "@tanstack/react-query";
import { getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { Search, SlidersHorizontal } from "lucide-react";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataTable,
  Input,
  ListCard,
  ListCardRow,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
  TableEmptyState,
  type StatusTone,
} from "@/components/patterns";
import { isPaymentReceived } from "@/lib/bookings";
import { multiUnitBookingKeys } from "@/lib/query-keys";
import { statusBadgeProps } from "@/lib/status-tone";
import { supabaseAuth } from "@/lib/supabase";
import { formatUrgencyLevel, type UrgencyLevel } from "@/lib/urgency-scoring";
import { formatCurrency, formatDate, formatRelativeTime } from "@/lib/utils";
import type { PaymentStatus } from "@/types";

// ============================================
// Types
// ============================================

interface PendingBooking {
  booking_id: string;
  booking_reference: string;
  guest_name: string;
  guest_contact: string;
  check_in_date: string;
  check_out_date: string;
  requested_unit_count: number;
  total_amount: number;
  payment_status: PaymentStatus;
  urgency_score: number;
  urgency_level: UrgencyLevel;
  created_at: string;
}

interface QueueFilters {
  searchQuery: string;
  urgencyLevel: UrgencyLevel | "all";
  dateRange: "all" | "today" | "week" | "month";
}

// ============================================
// Rows
// ============================================

const toneByUrgency: Record<UrgencyLevel, StatusTone> = {
  critical: "danger",
  high: "warning",
  medium: "info",
  low: "neutral",
};

function UrgencyBadge({ booking }: { booking: PendingBooking }) {
  return (
    <div className="flex items-center gap-2">
      <StatusBadge tone={toneByUrgency[booking.urgency_level]}>
        {formatUrgencyLevel(booking.urgency_level)}
      </StatusBadge>
      <span className="text-muted-foreground text-sm tabular-nums">{booking.urgency_score}</span>
    </div>
  );
}

function GuestName({ booking }: { booking: PendingBooking }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="font-medium break-words">{booking.guest_name}</span>
      <span className="text-muted-foreground text-xs break-words">{booking.guest_contact}</span>
    </div>
  );
}

function QueueAction({ booking }: { booking: PendingBooking }) {
  const paymentReceived = isPaymentReceived(booking.payment_status);

  return (
    <Button
      size="sm"
      title={
        paymentReceived
          ? "Proceed to assign specific units for this booking"
          : "Review payment proof and verify or reject payment"
      }
      onClick={() => {
        window.location.href = paymentReceived
          ? `/admin/bookings/${booking.booking_id}/assign-units`
          : `/admin/verify-payment/${booking.booking_id}`;
      }}
    >
      {paymentReceived ? "Assign Cabins" : "Review Payment"}
    </Button>
  );
}

const columns: ColumnDef<PendingBooking>[] = [
  { id: "urgency", header: "Urgency", cell: ({ row }) => <UrgencyBadge booking={row.original} /> },
  {
    accessorKey: "booking_reference",
    header: "Reference",
    cell: ({ row }) => <span className="whitespace-nowrap">{row.original.booking_reference}</span>,
  },
  { id: "guest", header: "Guest", cell: ({ row }) => <GuestName booking={row.original} /> },
  {
    accessorKey: "check_in_date",
    header: "Check-in",
    cell: ({ row }) => (
      <span className="whitespace-nowrap">{formatDate(new Date(row.original.check_in_date))}</span>
    ),
  },
  { accessorKey: "requested_unit_count", header: "Cabins", meta: { align: "center" } },
  {
    accessorKey: "total_amount",
    header: "Amount",
    cell: ({ row }) => (
      <span className="whitespace-nowrap">{formatCurrency(row.original.total_amount)}</span>
    ),
    meta: { align: "right" },
  },
  {
    accessorKey: "payment_status",
    header: "Payment",
    cell: ({ row }) => (
      <StatusBadge {...statusBadgeProps(row.original.payment_status, "Pending")} />
    ),
  },
  {
    accessorKey: "created_at",
    header: "Pending",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{formatRelativeTime(row.original.created_at)}</span>
    ),
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <QueueAction booking={row.original} />,
    meta: { align: "right", pinned: true },
  },
];

function QueueCard({ booking }: { booking: PendingBooking }) {
  return (
    <ListCard>
      <div className="flex items-start justify-between gap-2">
        <GuestName booking={booking} />
        <UrgencyBadge booking={booking} />
      </div>
      <ListCardRow label="Reference" value={booking.booking_reference} />
      <ListCardRow label="Check-in" value={formatDate(new Date(booking.check_in_date))} />
      <ListCardRow label="Cabins" value={booking.requested_unit_count} />
      <ListCardRow label="Amount" value={formatCurrency(booking.total_amount)} />
      <ListCardRow
        label="Payment"
        value={<StatusBadge {...statusBadgeProps(booking.payment_status, "Pending")} />}
      />
      <ListCardRow label="Pending" value={formatRelativeTime(booking.created_at)} />
      <QueueAction booking={booking} />
    </ListCard>
  );
}

// ============================================
// Component
// ============================================

const pendingBookingsQuery = queryOptions({
  queryKey: multiUnitBookingKeys.pending,
  queryFn: async () => {
    // Get current session token for authentication
    const {
      data: { session },
    } = await supabaseAuth.getSession();

    const response = await fetch("/api/admin/pending-bookings", {
      headers: {
        ...(session?.access_token && {
          Authorization: `Bearer ${session.access_token}`,
        }),
      },
    });

    if (!response.ok) {
      // Parse the error response for more details
      const errorData = (await response.json().catch(() => ({}))) as {
        error?: string;
        hint?: string;
      };
      const errorMessage = errorData.error || "Failed to fetch pending bookings";
      const hint = errorData.hint || "";
      throw new Error(hint ? `${errorMessage}. ${hint}` : errorMessage);
    }

    const data = (await response.json()) as { bookings: PendingBooking[] };
    return data.bookings;
  },
  refetchInterval: 30000, // Refresh every 30s
  staleTime: 25000, // Consider stale after 25s
});

export function PendingBookingsQueue() {
  const [filters, setFilters] = useState<QueueFilters>({
    searchQuery: "",
    urgencyLevel: "all",
    dateRange: "all",
  });

  // Fetch pending bookings with urgency scoring
  const { data: bookings, isLoading, error } = useQuery(pendingBookingsQuery);

  // ============================================
  // Filtering Logic
  // ============================================

  // TanStack needs a stable `data` array: a new one each render loops through its page-index reset.
  const filteredBookings = useMemo(
    () =>
      (bookings ?? []).filter((booking) => {
        // Search filter (booking reference or guest name)
        if (filters.searchQuery) {
          const query = filters.searchQuery.toLowerCase();
          const matchesSearch =
            booking.booking_reference.toLowerCase().includes(query) ||
            booking.guest_name.toLowerCase().includes(query);
          if (!matchesSearch) return false;
        }

        // Urgency level filter
        if (filters.urgencyLevel !== "all" && booking.urgency_level !== filters.urgencyLevel) {
          return false;
        }

        // Date range filter (check-in date)
        if (filters.dateRange !== "all") {
          const checkIn = new Date(booking.check_in_date);
          const now = new Date();

          if (filters.dateRange === "today") {
            const isToday = checkIn.toDateString() === now.toDateString();
            if (!isToday) return false;
          } else if (filters.dateRange === "week") {
            const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            if (checkIn > weekFromNow) return false;
          } else if (filters.dateRange === "month") {
            const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            if (checkIn > monthFromNow) return false;
          }
        }

        return true;
      }),
    [bookings, filters]
  );

  const table = useReactTable({
    data: filteredBookings,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (booking) => booking.booking_id,
  });

  // ============================================
  // Loading & Error States
  // ============================================

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Bookings Queue</CardTitle>
          <CardDescription>Loading pending guest bookings...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    const isMigrationError = error.message.includes("not yet configured");
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Bookings Queue</CardTitle>
          <CardDescription
            className={isMigrationError ? "text-muted-foreground" : "text-destructive"}
          >
            {isMigrationError
              ? "Multi-unit booking feature is not yet available."
              : `Error loading bookings: ${error.message}`}
          </CardDescription>
        </CardHeader>
        {isMigrationError && (
          <CardContent>
            <p className="text-muted-foreground text-sm">
              This feature requires a database migration. Contact the system administrator if you
              believe this should be enabled.
            </p>
          </CardContent>
        )}
      </Card>
    );
  }

  // ============================================
  // Main Render
  // ============================================

  return (
    <Card data-testid="pending-bookings-queue">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Pending Bookings Queue</CardTitle>
            <CardDescription>
              {filteredBookings.length} pending guest bookings
              {filters.urgencyLevel !== "all" &&
                ` (${formatUrgencyLevel(filters.urgencyLevel)} priority)`}
            </CardDescription>
          </div>
          <StatusBadge tone="neutral">Auto-refresh: 30s</StatusBadge>
        </div>
      </CardHeader>

      <CardContent className="@container space-y-4">
        {/* Filter Controls */}
        <div className="flex flex-col gap-4 @xl:flex-row">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search by reference or guest name..."
              value={filters.searchQuery}
              onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
              className="pl-10"
            />
          </div>

          {/* Urgency Filter */}
          <Select
            value={filters.urgencyLevel}
            onValueChange={(value) =>
              setFilters({ ...filters, urgencyLevel: value as QueueFilters["urgencyLevel"] })
            }
          >
            <SelectTrigger className="w-full @xl:w-44">
              <SlidersHorizontal className="mr-2 h-4 w-4" aria-hidden="true" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Urgency</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          {/* Date Range Filter */}
          <Select
            value={filters.dateRange}
            onValueChange={(value) =>
              setFilters({ ...filters, dateRange: value as QueueFilters["dateRange"] })
            }
          >
            <SelectTrigger className="w-full @xl:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dates</SelectItem>
              <SelectItem value="today">Check-in Today</SelectItem>
              <SelectItem value="week">Next 7 Days</SelectItem>
              <SelectItem value="month">Next 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DataTable
          table={table}
          label="Pending bookings"
          renderCard={(row) => <QueueCard booking={row.original} />}
          emptyState={<TableEmptyState title="No pending bookings found" />}
        />
      </CardContent>
    </Card>
  );
}
