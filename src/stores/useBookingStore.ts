import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import { afterWrite } from "@/lib/after-write";
import {
  cancelBooking,
  setBookingStatus,
  UNDO_STATUS,
  UPDATE_BOOKING_WRITES,
  updateBooking,
  type BookingChanges,
  type StatusChange,
} from "@/lib/bookings";
import { adaptBookingFromDB } from "@/lib/database-adapters";
import { throwDetailLoadError } from "@/lib/detail-load-error";
import { formatCurrency } from "@/lib/formatters";
import { recordProofPayment } from "@/lib/payments";
import { bookingKeys } from "@/lib/query-keys";
import { db, handleSupabaseError, supabase } from "@/lib/supabase";
import type { Booking, TableState } from "@/types";

// import { useWorkflowStore } from "./useWorkflowStore"; // Phase 3-4

// ============================================
// ZUSTAND STORE
// ============================================
interface BookingStore {
  // Local state
  selectedBooking: Booking | null;

  // Actions
  setSelectedBooking: (booking: Booking | null) => void;

  // Table state (for TanStack Table)
  tableState: Partial<TableState>;
  setTableState: (state: Partial<TableState>) => void;
}

export const useBookingStore = create<BookingStore>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        selectedBooking: null,
        tableState: {
          pagination: { pageIndex: 0, pageSize: 10 },
        },

        // Actions
        setSelectedBooking: (booking) => set({ selectedBooking: booking }),

        setTableState: (state) =>
          set((prevState) => ({
            tableState: { ...prevState.tableState, ...state },
          })),
      }),
      {
        name: "booking-storage",
        storage: {
          getItem: (name) => {
            const value = sessionStorage.getItem(name);
            return value ? JSON.parse(value) : null;
          },
          setItem: (name, value) => {
            sessionStorage.setItem(name, JSON.stringify(value));
          },
          removeItem: (name) => {
            sessionStorage.removeItem(name);
          },
        },
        partialize: (state) =>
          ({
            tableState: state.tableState,
          }) as BookingStore,
      }
    ),
    {
      name: "BookingStore",
    }
  )
);

// ============================================
// TANSTACK QUERY HOOKS
// ============================================

// One booking with units and guest; the detail and edit routes share this cache entry
export const bookingDetailQuery = (bookingId: string) =>
  queryOptions({
    queryKey: bookingKeys.detail(bookingId),
    queryFn: async () => {
      const { data, error } = await db.bookings.byId(bookingId);
      if (error) throwDetailLoadError(error, "booking");
      return data;
    },
    staleTime: 30000,
  });

// Every booking; the bookings list selects from it in the browser (src/lib/bookings/list.ts)
const bookingListQuery = () =>
  queryOptions({
    queryKey: bookingKeys.lists(),
    queryFn: async () => {
      const query = supabase
        .from("bookings")
        .select(
          `
        *,
        booking_units(
          *,
          unit:units(*)
        ),
        guest:guests(*),
        payments(amount, status)
      `
        )
        .order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) throw new Error(handleSupabaseError(error));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return data?.map((dbBooking) => adaptBookingFromDB(dbBooking as any)) || []; // Type cast needed for DB -> App conversion
    },
    staleTime: 5 * 60_000,
    // New online bookings show without a reload
    refetchInterval: 30 * 60_000,
    refetchOnWindowFocus: true,
  });

export const useAllBookings = () => useQuery(bookingListQuery());

export const useUpdateBookingStatus = () => {
  const mutation = useMutation({
    mutationFn: ({ bookingId, status }: StatusChange) =>
      setBookingStatus(supabase, bookingId, status),
    onError: (error) => {
      toast.error("Failed to change the booking status", { description: error.message });
    },
    onSuccess: (booking, { bookingId, undo }) => {
      if (!undo) return;
      toast.success(`${booking.booking_reference} is ${UNDONE_LABEL[undo]}`, {
        duration: 10_000,
        action: {
          label: "Undo",
          onClick: () => {
            mutation.mutate({ bookingId, status: UNDO_STATUS[undo] });
          },
        },
      });
    },
    onSettled: () => afterWrite("bookings"),
  });
  return mutation;
};

const UNDONE_LABEL = { "Undo check-in": "checked in", "Undo check-out": "checked out" } as const;

// Proof that the guest paid the rest: records the outstanding balance as a payment
export const useUploadPaymentProof = () =>
  useMutation({
    mutationFn: ({ bookingId, file }: { bookingId: string; file: File }) =>
      recordProofPayment(supabase, bookingId, file),
    onSuccess: (payment) => {
      toast.success(`Recorded ${formatCurrency(payment.amount)} with proof`);
    },
    onError: (error) => {
      toast.error("Failed to record the payment proof", { description: error.message });
    },
    onSettled: () => afterWrite("payments"),
  });

// Cancel booking
export const useCancelBooking = () =>
  useMutation({
    mutationFn: (bookingId: string) => cancelBooking(supabase, bookingId),
    onSuccess: (booking) => {
      toast.success(`Booking ${booking.booking_reference} cancelled`);
    },
    onError: (error) => {
      toast.error("Failed to cancel the booking", { description: error.message });
    },
    onSettled: () => afterWrite("bookings"),
  });

export const useUpdateBooking = () =>
  useMutation({
    mutationFn: ({ bookingId, changes }: { bookingId: string; changes: BookingChanges }) =>
      updateBooking(supabase, bookingId, changes),
    onSuccess: () => {
      toast.success("Booking updated");
    },
    onError: (error) => {
      toast.error("Failed to update the booking", { description: error.message });
    },
    onSettled: () => afterWrite(...UPDATE_BOOKING_WRITES),
  });
