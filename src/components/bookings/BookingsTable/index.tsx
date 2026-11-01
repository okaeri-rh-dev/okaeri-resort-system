import { withErrorBoundary } from "@/components/ErrorBoundary";
import { DataTable, TableEmptyState, TablePagination, TableSkeleton } from "@/components/patterns";
import { cn } from "@/lib/utils";

import { BookingCard } from "./components/BookingCard";
import { BookingFilters } from "./components/BookingFilters";
import { useBookingsTable } from "./hooks/useBookingsTable";
import type { BookingsTableProps } from "./types";

function BookingsTableComponent({ className }: BookingsTableProps) {
  const {
    table,
    bookings,
    totalCount,
    filteredCount,
    hasActiveFilters,
    isLoading,
    error,
    filters,
    setFilters,
    searchQuery,
    setSearchQuery,
    resetFilters,
    handleExport,
    handleUploadPayment,
    cancelBooking,
    updateBookingStatus,
  } = useBookingsTable();

  if (isLoading) {
    return <TableSkeleton rows={8} columns={9} toolbar pagination label="Loading bookings" />;
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
      {/* Filters */}
      <BookingFilters
        filters={filters}
        setFilters={setFilters}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        resetFilters={resetFilters}
        hasActiveFilters={hasActiveFilters}
        onExport={handleExport}
        resultCount={filteredCount}
        totalCount={totalCount}
      />

      <DataTable
        table={table}
        label="Bookings"
        renderCard={(row) => (
          <BookingCard
            booking={row.original}
            onUploadPayment={() => handleUploadPayment(row.original)}
            onCancel={() => cancelBooking.mutate(row.original.booking_id)}
            updateBookingStatus={updateBookingStatus}
          />
        )}
        emptyState={
          hasActiveFilters ? (
            <TableEmptyState
              variant="no-results"
              title="No bookings found"
              description="No bookings match your current filters. Try adjusting your search."
              action={{ label: "Clear Filters", onClick: resetFilters }}
            />
          ) : (
            <TableEmptyState
              variant="no-data"
              title="No bookings yet"
              description="Get started by creating your first booking."
            />
          )
        }
      />

      <TablePagination table={table} totalItems={bookings.length} />
    </div>
  );
}

// Export with error boundary
export const BookingsTable = withErrorBoundary(BookingsTableComponent, {
  level: "component",
});

// Re-export types
export type { BookingsTableProps } from "./types";
