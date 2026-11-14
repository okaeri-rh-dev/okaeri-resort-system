import { useState } from "react";

import {
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnFiltersState,
  type VisibilityState,
} from "@tanstack/react-table";

import { hasBookingFilters, parseBookingsSearch } from "@/lib/bookings";

import { useBookingColumns } from "../components/BookingColumns";
import { useBookingActions } from "./useBookingActions";
import { useSelectedBookings } from "./useSelectedBookings";

export const useBookingsTable = () => {
  const {
    bookings,
    needsActionCount,
    search,
    setSearch,
    totalCount,
    isLoading,
    isPlaceholderData,
    error,
  } = useSelectedBookings();

  // Local state
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const { updateBookingStatus, cancelBooking, handleUploadPayment } = useBookingActions();

  // Get columns
  const columns = useBookingColumns({
    handleUploadPayment,
    updateBookingStatus,
    cancelBooking,
  });

  const hasActiveFilters = hasBookingFilters(search);

  const resetFilters = () =>
    setSearch(parseBookingsSearch({ view: search.view, booking: search.booking }));

  // Create table instance
  const table = useReactTable({
    data: bookings,
    columns,
    state: {
      columnFilters,
      columnVisibility,
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
  });

  return {
    table,
    bookings,
    needsActionCount,
    totalCount,
    filteredCount: bookings.length,
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
  };
};
