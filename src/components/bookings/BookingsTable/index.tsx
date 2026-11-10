import { useNavigate } from "@tanstack/react-router";

import { withErrorBoundary } from "@/components/ErrorBoundary";
import {
  DataTable,
  TableEmptyState,
  TableSkeleton,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/patterns";
import { BOOKING_VIEWS, isBookingView, type BookingView } from "@/lib/bookings";
import { cn } from "@/lib/utils";

import { BookingCard } from "./components/BookingCard";
import { BookingFilters } from "./components/BookingFilters";
import { BookingSheet } from "./components/BookingSheet";
import { useBookingsTable } from "./hooks/useBookingsTable";
import type { BookingsTableProps } from "./types";

const VIEW_LABELS: Record<BookingView | "all", string> = {
  all: "All",
  upcoming: "Upcoming",
  "in-house": "In-house",
  "needs-action": "Needs action",
  past: "Past",
  cancelled: "Cancelled",
};

function BookingsTableComponent({ className }: BookingsTableProps) {
  const {
    table,
    needsActionCount,
    totalCount,
    filteredCount,
    hasActiveFilters,
    isLoading,
    isPlaceholderData,
    error,
    search,
    setSearch,
    resetFilters,
    handleUploadPayment,
    cancelBooking,
    updateBookingStatus,
  } = useBookingsTable();
  const navigate = useNavigate({ from: "/admin/bookings" });

  if (isLoading) {
    return <TableSkeleton rows={8} columns={8} toolbar label="Loading bookings" />;
  }

  if (error) {
    return (
      <div className="text-destructive p-8 text-center">
        <p>Failed to load bookings</p>
        <p className="mt-2 text-sm">{error.message}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <Tabs
        value={search.view ?? "all"}
        onValueChange={(view) => setSearch({ view: isBookingView(view) ? view : undefined })}
      >
        {/* Wraps into chips on a phone instead of scrolling sideways */}
        <TabsList aria-label="Booking views" className="h-auto flex-wrap justify-start">
          {(["all", ...BOOKING_VIEWS] as const).map((view) => (
            <TabsTrigger key={view} value={view}>
              {view === "needs-action" && needsActionCount > 0
                ? `${VIEW_LABELS[view]} · ${needsActionCount}`
                : VIEW_LABELS[view]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <BookingFilters
        search={search}
        setSearch={setSearch}
        hasActiveFilters={hasActiveFilters}
        resultCount={filteredCount}
        totalCount={totalCount}
      />

      <DataTable
        table={table}
        label="Bookings"
        virtualize
        onRowClick={(row) =>
          void navigate({ search: (prev) => ({ ...prev, booking: row.original.booking_id }) })
        }
        isStale={isPlaceholderData}
        renderCard={(row) => (
          <BookingCard
            booking={row.original}
            onUploadPayment={() => handleUploadPayment(row.original)}
            onCancel={() => cancelBooking.mutate(row.original.booking_id)}
            updateBookingStatus={updateBookingStatus}
          />
        )}
        emptyState={
          totalCount === 0 ? (
            <TableEmptyState
              variant="no-data"
              title="No bookings yet"
              description="Get started by creating your first booking."
            />
          ) : (
            <TableEmptyState
              variant="no-results"
              title={hasActiveFilters ? "No bookings match" : "No bookings found"}
              description={
                hasActiveFilters
                  ? "Try another search or fewer filters."
                  : "No bookings in this view."
              }
              action={
                hasActiveFilters ? { label: "Clear filters", onClick: resetFilters } : undefined
              }
            />
          )
        }
      />

      <BookingSheet />
    </div>
  );
}

// Export with error boundary
export const BookingsTable = withErrorBoundary(BookingsTableComponent, {
  level: "component",
});

// Re-export types
export type { BookingsTableProps } from "./types";
