import { useCallback, useMemo, useState } from "react";

import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";

import { filterDay, manilaDayOf } from "@/lib/bookings";
import {
  useBookings,
  useBookingStore,
  useCancelBooking,
  useUpdateBookingStatus,
  useUploadPaymentProof,
} from "@/stores/useBookingStore";
import type { Booking } from "@/types";

import { useBookingColumns } from "../components/BookingColumns";
import { exportBookings } from "../utils/export";

export const useBookingsTable = () => {
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

  // Mutations
  const updateBookingStatus = useUpdateBookingStatus();
  const uploadPaymentProof = useUploadPaymentProof();
  const cancelBooking = useCancelBooking();

  // Data
  const { data: bookings = [], isLoading, error } = useBookings();

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

  // Export handler
  const handleExport = useCallback(async () => {
    await exportBookings(bookings);
  }, [bookings]);

  // Apply filters
  const filteredBookings = useMemo(() => {
    let filtered = [...bookings];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (booking) =>
          booking.guest_name?.toLowerCase().includes(query) ||
          booking.email?.toLowerCase().includes(query) ||
          booking.booking_reference?.toLowerCase().includes(query) ||
          booking.contact_number?.includes(query)
      );
    }

    // Apply status filter
    if (filters.status) {
      filtered = filtered.filter((b) => b.booking_status === filters.status);
    }

    // Apply payment status filter
    if (filters.payment_status) {
      filtered = filtered.filter((b) => b.payment_status === filters.payment_status);
    }

    // Apply walk-in filter
    if (filters.is_walk_in !== undefined) {
      filtered = filtered.filter((b) => (b.is_walk_in ?? false) === filters.is_walk_in);
    }

    // Apply date range filter
    if (filters.date_from || filters.date_to) {
      const from = filters.date_from ? filterDay(filters.date_from) : null;
      const to = filters.date_to ? filterDay(filters.date_to) : null;
      filtered = filtered.filter((booking) => {
        const checkInDay = manilaDayOf(booking.check_in);
        return (!from || checkInDay >= from) && (!to || checkInDay <= to);
      });
    }

    return filtered;
  }, [bookings, searchQuery, filters]);

  // Create table instance
  const table = useReactTable({
    data: filteredBookings,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      pagination: tableState.pagination || { pageIndex: 0, pageSize: 10 },
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
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
  });

  return {
    table,
    bookings: filteredBookings,
    totalCount: bookings.length,
    filteredCount: filteredBookings.length,
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
  };
};
