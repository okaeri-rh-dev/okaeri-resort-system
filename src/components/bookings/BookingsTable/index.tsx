import { flexRender } from "@tanstack/react-table";

import { withErrorBoundary } from "@/components/ErrorBoundary";
import { BookingsTableSkeleton } from "@/components/skeletons";
import { ResponsiveTable, TableEmptyState, TablePagination } from "@/components/tables/utils";
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
    isLoading,
    error,
    isMobile,
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
    return <BookingsTableSkeleton />;
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-600">
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
        onExport={handleExport}
        resultCount={filteredCount}
        totalCount={totalCount}
      />

      {/* Mobile view */}
      {isMobile ? (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <BookingCard
              key={booking.booking_id}
              booking={booking}
              onUploadPayment={() => handleUploadPayment(booking)}
              onCancel={() => cancelBooking.mutate(booking.booking_id)}
              updateBookingStatus={updateBookingStatus}
            />
          ))}
          {bookings.length === 0 && (
            <TableEmptyState
              variant={totalCount === 0 ? "no-data" : "no-results"}
              title={totalCount === 0 ? "No bookings yet" : "No bookings found"}
              description={
                totalCount === 0
                  ? "Get started by creating your first booking."
                  : "No bookings match your current filters. Try adjusting your search."
              }
              action={
                totalCount === 0
                  ? undefined
                  : {
                      label: "Clear Filters",
                      onClick: resetFilters,
                    }
              }
            />
          )}
        </div>
      ) : (
        /* Desktop view */
        <>
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
                      "h-14 border-b border-neutral-100 py-2 hover:bg-neutral-50",
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
                  variant={totalCount === 0 ? "no-data" : "no-results"}
                  title={totalCount === 0 ? "No bookings yet" : "No bookings found"}
                  description={
                    totalCount === 0
                      ? "Get started by creating your first booking."
                      : "No bookings match your current filters. Try adjusting your search."
                  }
                  action={
                    totalCount === 0
                      ? undefined
                      : {
                          label: "Clear Filters",
                          onClick: resetFilters,
                        }
                  }
                />
              </div>
            )}
          </ResponsiveTable>

          {/* Pagination */}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <TablePagination table={table as any} totalItems={bookings.length} />
        </>
      )}
    </div>
  );
}

// Export with error boundary
export const BookingsTable = withErrorBoundary(BookingsTableComponent, {
  level: "component",
});

// Re-export types
export type { BookingsTableProps } from "./types";
