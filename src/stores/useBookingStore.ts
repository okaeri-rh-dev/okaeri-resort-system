import {
  keepPreviousData,
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
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { requestBooking } from "@/lib/bookings/request";
import { adaptBookingFromDB } from "@/lib/database-adapters";
import { recordProofPayment } from "@/lib/payments";
import {
  afterBookingCancel,
  afterBookingCreate,
  afterBookingDelete,
  afterBookingPaymentChange,
  afterBookingStatusChange,
  afterBookingUpdate,
  invalidateBookings,
} from "@/lib/query-invalidation";
import { bookingKeys } from "@/lib/query-keys";
import { db, handleSupabaseError, supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/validations";
import type { Booking, BookingFilters, BookingStatus, TableState } from "@/types";
import type { TablesInsert } from "@/types/database.types";

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
  filters: BookingFilters;
  sortBy: "date" | "status" | "amount" | "guest";
  sortOrder: "asc" | "desc";
  searchQuery: string;

  // Actions
  setSelectedBooking: (booking: Booking | null) => void;
  setFilters: (filters: BookingFilters) => void;
  resetFilters: () => void;
  setSortBy: (sortBy: "date" | "status" | "amount" | "guest") => void;
  setSortOrder: (order: "asc" | "desc") => void;
  setSearchQuery: (query: string) => void;

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
        filters: {},
        sortBy: "date",
        sortOrder: "desc",
        searchQuery: "",
        optimisticBookings: new Map(),
        cleanupInterval: null,
        tableState: {
          pagination: { pageIndex: 0, pageSize: 10 },
        },

        // Actions
        setSelectedBooking: (booking) => set({ selectedBooking: booking }),

        setFilters: (filters) => set({ filters }),

        resetFilters: () => set({ filters: {}, searchQuery: "" }),

        setSortBy: (sortBy) => set({ sortBy }),

        setSortOrder: (order) => set({ sortOrder: order }),

        setSearchQuery: (query) => set({ searchQuery: query }),

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
            filters: state.filters,
            sortBy: state.sortBy,
            sortOrder: state.sortOrder,
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
      if (error) throw new Error(`Failed to load booking: ${handleSupabaseError(error)}`);
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

// Fetch all bookings with filters
const BOOKING_SEARCH_COLUMNS = ["guest_name", "booking_reference", "email", "contact_number"];

export const bookingSearchFilter = (searchQuery: string) =>
  BOOKING_SEARCH_COLUMNS.map((column) => `${column}.ilike.%${searchQuery}%`).join(",");

const bookingListQuery = ({
  filters,
  searchQuery,
  sortBy,
  sortOrder,
}: Pick<BookingStore, "filters" | "searchQuery" | "sortBy" | "sortOrder">) =>
  queryOptions({
    queryKey: bookingKeys.list({ filters, searchQuery, sortBy, sortOrder }),
    queryFn: async () => {
      // Handle unit_id filter via junction table
      let bookingIdsForUnit: string[] | null = null;
      if (filters.unit_id) {
        const { data: bookingUnits, error: unitError } = await supabase
          .from("booking_units")
          .select("booking_id")
          .eq("unit_id", filters.unit_id);

        if (unitError) throw new Error(handleSupabaseError(unitError));

        bookingIdsForUnit = bookingUnits?.map((bu) => bu.booking_id) || [];

        // Early return if no bookings found for this unit
        if (bookingIdsForUnit.length === 0) {
          return [];
        }
      }

      let query = supabase.from("bookings").select(`
        *,
        booking_units(
          *,
          unit:units(*)
        ),
        guest:guests(*)
      `);

      // Apply filters
      if (filters.status) {
        query = query.eq("booking_status", filters.status);
      }
      if (filters.payment_status) {
        query = query.eq("payment_status", filters.payment_status);
      }
      if (bookingIdsForUnit) {
        query = query.in("booking_id", bookingIdsForUnit);
      }
      if (filters.guest_id) {
        query = query.eq("guest_id", filters.guest_id);
      }
      if (filters.date_from) {
        query = query.gte("check_in", filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte("check_out", filters.date_to);
      }
      if (searchQuery) {
        query = query.or(bookingSearchFilter(searchQuery));
      }

      // Apply sorting
      const sortColumn =
        sortBy === "date"
          ? "created_at"
          : sortBy === "status"
            ? "booking_status"
            : sortBy === "amount"
              ? "total_amount"
              : "guest_name";

      query = query.order(sortColumn, { ascending: sortOrder === "asc" });

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

const SEARCH_DEBOUNCE_MS = 300;

export const useBookings = () => {
  const { filters, searchQuery, sortBy, sortOrder } = useBookingStore();
  const debouncedSearchQuery = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);

  return useQuery({
    ...bookingListQuery({ filters, searchQuery: debouncedSearchQuery, sortBy, sortOrder }),
    placeholderData: keepPreviousData,
  });
};

// Fetch single booking

// Creates through the Worker route (src/lib/bookings/request.ts)
export const useCreateBooking = () =>
  useMutation({
    mutationFn: requestBooking,
    onSettled: () => {
      afterBookingCreate();
    },
  });

// Update booking status with optimistic update
// Phase 2: Simple status transition validation
const VALID_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["CheckedIn", "Cancelled"],
  CheckedIn: ["CheckedOut"],
  CheckedOut: [],
  Cancelled: [],
};

export const canTransitionStatus = (
  currentStatus: BookingStatus,
  newStatus: BookingStatus
): boolean => {
  return VALID_STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) || false;
};

export const useUpdateBookingStatus = () => {
  const queryClient = useQueryClient();
  const updateOptimistic = useBookingStore((state) => state.updateOptimisticBooking);

  return useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: string; status: BookingStatus }) => {
      // Phase 2: Simple validation before updating
      const { data: currentBooking } = await db.bookings.byId(bookingId);
      if (
        currentBooking &&
        !canTransitionStatus(currentBooking.booking_status as BookingStatus, status)
      ) {
        throw new Error(`Cannot transition from ${currentBooking.booking_status} to ${status}`);
      }

      const { data, error } = await db.bookings.update(bookingId, {
        booking_status: status,
      });
      if (error) throw new Error(handleSupabaseError(error));
      return data;
    },
    onMutate: async ({ bookingId, status }) => {
      await queryClient.cancelQueries({ queryKey: bookingKeys.all });

      const previousBooking = cachedBooking(queryClient, bookingId);

      updateOptimistic(bookingId, {
        booking_status: status,
        updated_at: new Date().toISOString(),
      });

      return { previousBooking };
    },
    onError: (_, { bookingId }, context) => {
      if (context?.previousBooking) {
        updateOptimistic(bookingId, context.previousBooking);
      }
    },
    onSettled: () => {
      afterBookingStatusChange();
    },
  });
};

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
    onSettled: () => {
      afterBookingPaymentChange();
    },
  });

// Cancel booking
export const useCancelBooking = () => {
  const queryClient = useQueryClient();
  const updateOptimistic = useBookingStore((state) => state.updateOptimisticBooking);

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { data, error } = await db.bookings.cancel(bookingId);
      if (error) throw new Error(handleSupabaseError(error));
      return data;
    },
    onMutate: async (bookingId) => {
      await queryClient.cancelQueries({ queryKey: bookingKeys.all });

      updateOptimistic(bookingId, {
        booking_status: "Cancelled",
        updated_at: new Date().toISOString(),
      });
    },
    onSettled: () => {
      afterBookingCancel();
    },
  });
};

// General booking update (for editing all fields)
export const useUpdateBooking = () => {
  const queryClient = useQueryClient();
  const updateOptimistic = useBookingStore((state) => state.updateOptimisticBooking);

  return useMutation({
    mutationFn: async ({
      bookingId,
      updates,
    }: {
      bookingId: string;
      updates: Partial<Omit<Booking, "booking_id" | "created_at" | "updated_at">>;
    }) => {
      // Update guest information if email changed
      if (updates.email) {
        const { data: existingGuest } = await supabase
          .from("guests")
          .select("guest_id")
          .eq("email", updates.email)
          .single();

        if (!existingGuest && updates.guest_name) {
          const { data: newGuest } = await supabase
            .from("guests")
            .insert({
              guest_name: updates.guest_name,
              email: updates.email,
              phone_number: updates.contact_number || "",
            } satisfies TablesInsert<"guests">)
            .select()
            .single();

          if (newGuest) {
            updates.guest_id = newGuest.guest_id;
          }
        } else if (existingGuest) {
          updates.guest_id = existingGuest.guest_id;
        }
      }

      const { data, error } = await db.bookings.update(bookingId, updates);
      if (error) throw new Error(handleSupabaseError(error));
      return data;
    },
    onMutate: async ({ bookingId, updates }) => {
      await queryClient.cancelQueries({ queryKey: bookingKeys.all });

      const previousBooking = cachedBooking(queryClient, bookingId);

      updateOptimistic(bookingId, {
        ...updates,
        updated_at: new Date().toISOString(),
      });

      return { previousBooking };
    },
    onError: (_, { bookingId }, context) => {
      if (context?.previousBooking) {
        updateOptimistic(bookingId, context.previousBooking);
      }
    },
    onSettled: () => {
      afterBookingUpdate();
    },
  });
};

// Hard delete booking (different from cancel)
export const useDeleteBooking = () => {
  const queryClient = useQueryClient();
  const removeOptimistic = useBookingStore((state) => state.removeOptimisticBooking);

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase.from("bookings").delete().eq("booking_id", bookingId);
      if (error) throw new Error(handleSupabaseError(error));
    },
    onMutate: async (bookingId) => {
      await queryClient.cancelQueries({ queryKey: bookingKeys.all });
      removeOptimistic(bookingId);
      return { bookingId };
    },
    onError: () => {
      // Re-fetch to restore state
      invalidateBookings();
    },
    onSuccess: () => {
      afterBookingDelete();
    },
  });
};
