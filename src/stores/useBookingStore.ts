import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import { getAccessToken } from "@/hooks/useAuthToken";
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
import { BOOKING_CREATE_WRITES, requestBooking } from "@/lib/bookings/request";
import { adaptBookingFromDB } from "@/lib/database-adapters";
import { throwDetailLoadError } from "@/lib/detail-load-error";
import { formatCurrency } from "@/lib/formatters";
import { recordProofPayment } from "@/lib/payments";
import { bookingKeys } from "@/lib/query-keys";
import { db, handleSupabaseError, supabase } from "@/lib/supabase";
import type { Booking, TableState } from "@/types";

// import { useWorkflowStore } from "./useWorkflowStore"; // Phase 3-4

// ============================================
// TYPES & INTERFACES
// ============================================
interface OptimisticEntry {
  booking: Booking;
  timestamp: number;
}

// ============================================
// CONSTANTS
// ============================================
const OPTIMISTIC_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_OPTIMISTIC_ENTRIES = 100;
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute

// ============================================
// ZUSTAND STORE
// ============================================
interface BookingStore {
  // Local state
  selectedBooking: Booking | null;

  // Actions
  setSelectedBooking: (booking: Booking | null) => void;

  // Optimistic updates with TTL
  optimisticBookings: Map<string, OptimisticEntry>;
  addOptimisticBooking: (booking: Booking) => void;
  updateOptimisticBooking: (bookingId: string, updates: Partial<Booking>) => void;
  removeOptimisticBooking: (bookingId: string) => void;
  clearOptimisticBookings: () => void;

  // Memory management
  cleanupInterval: NodeJS.Timeout | null;
  startCleanupTimer: () => void;
  stopCleanupTimer: () => void;
  cleanupExpiredEntries: () => void;

  // Table state (for TanStack Table)
  tableState: Partial<TableState>;
  setTableState: (state: Partial<TableState>) => void;
}

export const useBookingStore = create<BookingStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        selectedBooking: null,
        optimisticBookings: new Map(),
        cleanupInterval: null,
        tableState: {
          pagination: { pageIndex: 0, pageSize: 10 },
        },

        // Actions
        setSelectedBooking: (booking) => set({ selectedBooking: booking }),

        addOptimisticBooking: (booking) =>
          set((state) => {
            const newMap = new Map(state.optimisticBookings);

            // Add with timestamp
            newMap.set(booking.booking_id, {
              booking,
              timestamp: Date.now(),
            });

            // Enforce size limit - remove oldest if exceeded
            if (newMap.size > MAX_OPTIMISTIC_ENTRIES) {
              const sortedEntries = Array.from(newMap.entries()).sort(
                (a, b) => a[1].timestamp - b[1].timestamp
              );

              // Remove oldest entries
              const entriesToRemove = sortedEntries.slice(0, newMap.size - MAX_OPTIMISTIC_ENTRIES);
              entriesToRemove.forEach(([id]) => newMap.delete(id));
            }

            return { optimisticBookings: newMap };
          }),

        updateOptimisticBooking: (bookingId, updates) =>
          set((state) => {
            const newMap = new Map(state.optimisticBookings);
            const existing = newMap.get(bookingId);
            if (existing) {
              newMap.set(bookingId, {
                booking: { ...existing.booking, ...updates },
                timestamp: Date.now(), // Update timestamp on modification
              });
            }
            return { optimisticBookings: newMap };
          }),

        removeOptimisticBooking: (bookingId) =>
          set((state) => {
            const newMap = new Map(state.optimisticBookings);
            newMap.delete(bookingId);
            return { optimisticBookings: newMap };
          }),

        clearOptimisticBookings: () => set({ optimisticBookings: new Map() }),

        // Memory management methods
        startCleanupTimer: () => {
          const interval = setInterval(() => {
            const state = get();
            state.cleanupExpiredEntries();
          }, CLEANUP_INTERVAL);

          set({ cleanupInterval: interval });
        },

        stopCleanupTimer: () => {
          const state = get();
          if (state.cleanupInterval) {
            clearInterval(state.cleanupInterval);
            set({ cleanupInterval: null });
          }
        },

        cleanupExpiredEntries: () => {
          set((state) => {
            const now = Date.now();
            const newMap = new Map<string, OptimisticEntry>();

            // Keep only entries within TTL
            state.optimisticBookings.forEach((entry, id) => {
              if (now - entry.timestamp < OPTIMISTIC_TTL) {
                newMap.set(id, entry);
              }
            });

            // Only update if entries were removed
            if (newMap.size !== state.optimisticBookings.size) {
              return { optimisticBookings: newMap };
            }

            return state;
          });
        },

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

// One booking with units and guest; the detail and edit routes, useBooking and useEntityEdit share this cache entry
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

// The admin API's booking view (assign-units, verify-payment); each page declares the fields it reads
export const adminBookingDetailQuery = <TBooking>(bookingId: string) =>
  queryOptions({
    queryKey: bookingKeys.adminDetail(bookingId),
    queryFn: async (): Promise<TBooking> => {
      const accessToken = await getAccessToken();
      const response = await fetch(`/api/admin/bookings/${bookingId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({ error: "Failed to fetch booking" }))) as { error?: string };
        throw new Error(errorData.error || "Failed to fetch booking details");
      }

      return response.json();
    },
    staleTime: 30000,
    retry: 1,
  });

// The cached detail row in the app shape the list and the optimistic map use, for rollback
const cachedBooking = (queryClient: QueryClient, bookingId: string): Booking | undefined => {
  const row = queryClient.getQueryData(bookingDetailQuery(bookingId).queryKey);
  return row ? adaptBookingFromDB(row) : undefined;
};

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

      // Convert database types to application types and merge with optimistic updates
      const { optimisticBookings } = useBookingStore.getState();
      const mergedData =
        data?.map((dbBooking) => {
          const optimisticEntry = optimisticBookings.get(dbBooking.booking_id);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const booking = adaptBookingFromDB(dbBooking as any); // Type cast needed for DB -> App conversion
          return optimisticEntry ? { ...booking, ...optimisticEntry.booking } : booking;
        }) || [];

      return mergedData;
    },
    staleTime: 300000, // 5 minutes - increased from 30s
    // Removed refetchInterval - manual refresh preferred for dashboard
  });

export const useAllBookings = () => useQuery(bookingListQuery());

// Fetch single booking

// Creates through the Worker route (src/lib/bookings/request.ts)
export const useCreateBooking = () =>
  useMutation({
    mutationFn: requestBooking,
    onSettled: () => afterWrite(...BOOKING_CREATE_WRITES),
  });

// Update booking status with optimistic update
export const useUpdateBookingStatus = () => {
  const queryClient = useQueryClient();
  const updateOptimistic = useBookingStore((state) => state.updateOptimisticBooking);

  const mutation = useMutation({
    mutationFn: ({ bookingId, status }: StatusChange) =>
      setBookingStatus(supabase, bookingId, status),
    onMutate: async ({ bookingId, status }) => {
      await queryClient.cancelQueries({ queryKey: bookingKeys.all });

      const previousBooking = cachedBooking(queryClient, bookingId);

      updateOptimistic(bookingId, {
        booking_status: status,
        updated_at: new Date().toISOString(),
      });

      return { previousBooking };
    },
    onError: (error, { bookingId }, context) => {
      if (context?.previousBooking) {
        updateOptimistic(bookingId, context.previousBooking);
      }
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

// Update payment status with optimistic update

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
