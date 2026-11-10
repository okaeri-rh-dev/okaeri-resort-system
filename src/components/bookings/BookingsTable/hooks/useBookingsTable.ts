import { useCallback, useState } from "react";

import {
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnFiltersState,
  type VisibilityState,
} from "@tanstack/react-table";

import {
  useCancelBooking,
  useUpdateBookingStatus,
  useUploadPaymentProof,
} from "@/hooks/useBookings";
import { hasBookingFilters, parseBookingsSearch } from "@/lib/bookings";
import type { Booking } from "@/types";

import { useBookingColumns } from "../components/BookingColumns";
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

  // Mutations
  const updateBookingStatus = useUpdateBookingStatus();
  const uploadPaymentProof = useUploadPaymentProof();
  const cancelBooking = useCancelBooking();

  // Payment upload handler
  const handleUploadPayment = useCallback(
    (booking: Booking) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg";
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
