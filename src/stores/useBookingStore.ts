import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import { getAccessToken } from "@/hooks/useAuthToken";
import { adaptBookingFromDB } from "@/lib/database-adapters";
import {
  afterBookingCancel,
  afterBookingCreate,
  afterBookingDelete,
  afterBookingPaymentChange,
  afterBookingStatusChange,
  afterBookingUpdate,
  invalidateBookings,
} from "@/lib/query-invalidation";
import { bookingKeys, unitKeys } from "@/lib/query-keys";
import { db, handleSupabaseError, storage, supabase } from "@/lib/supabase";
import { toManilaDateString } from "@/lib/timezone";
import type {
  Booking,
  BookingFilters,
  BookingFormData,
  BookingStatus,
  PaymentStatus,
  TableState,
} from "@/types";
import type { TablesInsert } from "@/types/database.types";
import type {
  // CalendarDayResponse, // ❌ DISABLED: Used by commented-out useAvailabilityCalendar
  BlackoutResponse,
  UnitAvailabilityResponse,
} from "@/types/supabase";

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
export const useBookings = () => {
  const { filters, searchQuery, sortBy, sortOrder } = useBookingStore();
  const optimisticBookings = useBookingStore((state) => state.optimisticBookings);

  return useQuery({
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
        query = query.or(
          `guest_name.ilike.%${searchQuery}%,booking_reference.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`
        );
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
};

// Fetch single booking
export const useBooking = (bookingId: string | undefined) => {
  return useQuery({ ...bookingDetailQuery(bookingId ?? ""), enabled: !!bookingId });
};

// Create booking mutation with optimistic update
export const useCreateBooking = () => {
  const queryClient = useQueryClient();
  const addOptimistic = useBookingStore((state) => state.addOptimisticBooking);
  const removeOptimistic = useBookingStore((state) => state.removeOptimisticBooking);

  return useMutation({
    mutationFn: async (bookingData: BookingFormData & { total_amount: number }) => {
      // Normalize empty strings to null for optional contact fields
      const normalizedEmail = bookingData.email?.trim() || null;
      const normalizedPhone = bookingData.contact_number?.trim() || null;

      // Check if guest exists or create new
      let guestId = null;

      if (normalizedEmail) {
        const { data: existingGuest } = await db.guests.byEmail(normalizedEmail);

        if (existingGuest) {
          guestId = existingGuest.guest_id;
        }
      }

      if (!guestId) {
        const { data: newGuest, error: guestError } = await db.guests.create({
          guest_name: bookingData.guest_name,
          email: normalizedEmail,
          phone_number: normalizedPhone,
          total_bookings: 0,
          total_spent: 0,
        });

        if (guestError) throw new Error(handleSupabaseError(guestError));
        guestId = newGuest?.guest_id || null;
      }

      // Create booking with generated reference
      const { data: reference } = await supabase.rpc("generate_booking_reference");

      const booking = {
        booking_reference: reference || `BK-${Date.now()}`,
        // unit_id removed - handled via booking_units junction table
        guest_id: guestId,
        guest_name: bookingData.guest_name,
        contact_number: normalizedPhone,
        email: normalizedEmail,
        num_guests: bookingData.num_guests,
        check_in:
          typeof bookingData.check_in === "string"
            ? bookingData.check_in
            : bookingData.check_in.toISOString(),
        check_out:
          typeof bookingData.check_out === "string"
            ? bookingData.check_out
            : bookingData.check_out.toISOString(),
        total_amount: bookingData.total_amount,
        booking_status: "Pending" as BookingStatus,
        payment_status: "Pending" as PaymentStatus,
        payment_method: bookingData.payment_method || null,
        special_requests: bookingData.special_requests || null,
        is_walk_in: bookingData.is_walk_in ?? false,
      };

      const { data, error } = await supabase.from("bookings").insert(booking).select().single();
      if (error) throw new Error(handleSupabaseError(error));

      // Create booking_units entry
      if (data && bookingData.unit_id) {
        const { error: unitError } = await supabase.from("booking_units").insert({
          booking_id: data.booking_id,
          unit_id: bookingData.unit_id,
          assigned_guests: bookingData.num_guests,
          unit_price: bookingData.total_amount,
          subtotal: bookingData.total_amount,
          weekend_surcharge: 0,
          extra_person_charge: 0,
        } satisfies TablesInsert<"booking_units">);

        if (unitError) {
          // Rollback: delete the booking if junction table insert fails
          await supabase.from("bookings").delete().eq("booking_id", data.booking_id);
          throw new Error(handleSupabaseError(unitError));
        }
      }

      return data;
    },
    onMutate: async (newBooking) => {
      await queryClient.cancelQueries({ queryKey: bookingKeys.all });

      // Create optimistic booking
      const optimisticBooking: Booking = {
        booking_id: `temp-${Date.now()}`,
        booking_reference: `BK-${Date.now()}`,
        guest_id: null,
        guest_name: newBooking.guest_name,
        contact_number: newBooking.contact_number,
        email: newBooking.email,
        num_guests: newBooking.num_guests,
        check_in:
          typeof newBooking.check_in === "string"
            ? newBooking.check_in
            : newBooking.check_in.toISOString(),
        check_out:
          typeof newBooking.check_out === "string"
            ? newBooking.check_out
            : newBooking.check_out.toISOString(),
        total_amount: newBooking.total_amount,
        booking_status: "Pending",
        payment_status: "Pending",
        payment_method: newBooking.payment_method || null,
        payment_proof_url: null,
        special_requests: newBooking.special_requests || null,
        internal_notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        booking_units: [], // Initialize empty array for optimistic update
      };

      addOptimistic(optimisticBooking);

      return { optimisticBooking };
    },
    onError: (_err, _newBooking, context) => {
      if (context?.optimisticBooking) {
        removeOptimistic(context.optimisticBooking.booking_id);
      }
    },
    onSuccess: (_data, _variables, context) => {
      if (context?.optimisticBooking) {
        removeOptimistic(context.optimisticBooking.booking_id);
      }
    },
    onSettled: () => {
      afterBookingCreate();
    },
  });
};

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
export const useUpdatePaymentStatus = () => {
  const queryClient = useQueryClient();
  const updateOptimistic = useBookingStore((state) => state.updateOptimisticBooking);

  return useMutation({
    mutationFn: async ({
      bookingId,
      paymentStatus,
      paymentMethod,
    }: {
      bookingId: string;
      paymentStatus: PaymentStatus;
      paymentMethod?: string;
    }) => {
      const updates: Partial<Booking> = { payment_status: paymentStatus };
      if (paymentMethod) {
        updates.payment_method = paymentMethod;
      }

      const { data, error } = await db.bookings.update(bookingId, updates);
      if (error) throw new Error(handleSupabaseError(error));
      return data;
    },
    onMutate: async ({ bookingId, paymentStatus, paymentMethod }) => {
      await queryClient.cancelQueries({ queryKey: bookingKeys.all });

      const previousBooking = cachedBooking(queryClient, bookingId);

      const updates: Partial<Booking> = {
        payment_status: paymentStatus,
        updated_at: new Date().toISOString(),
      };
      if (paymentMethod) {
        updates.payment_method = paymentMethod;
      }

      updateOptimistic(bookingId, updates);

      return { previousBooking };
    },
    onError: (_, { bookingId }, context) => {
      if (context?.previousBooking) {
        updateOptimistic(bookingId, context.previousBooking);
      }
    },
    onSettled: () => {
      afterBookingPaymentChange();
    },
  });
};

// Upload payment proof
export const useUploadPaymentProof = () => {
  const queryClient = useQueryClient();
  const updateOptimistic = useBookingStore((state) => state.updateOptimisticBooking);

  return useMutation({
    mutationFn: async ({ bookingId, file }: { bookingId: string; file: File }) => {
      // Upload file to storage
      const fileName = `payment-proofs/${bookingId}/${Date.now()}-${file.name}`;
      const { url } = await storage.upload("payment-proofs", fileName, file);

      // Get booking details for payment creation
      const { data: booking } = await supabase
        .from("bookings")
        .select("total_amount")
        .eq("booking_id", bookingId)
        .single();

      // Create payment record with proof
      const { error: paymentError } = await supabase.from("payments").insert({
        booking_id: bookingId,
        amount: booking?.total_amount ?? 0,
        payment_method: "Other", // Default since we don't have method info
        // Real payments columns are status/proof_url/payment_date — the previous
        // payment_status/receipt_url/transaction_date do not exist and 400'd.
        status: "Active",
        proof_url: url,
        payment_date: new Date().toISOString(),
      } satisfies TablesInsert<"payments">);

      if (paymentError) throw new Error(handleSupabaseError(paymentError));

      // Update booking payment status
      const { data, error } = await db.bookings.update(bookingId, {
        payment_status: "Completed",
      });

      if (error) throw new Error(handleSupabaseError(error));
      return data;
    },
    onMutate: async ({ bookingId }) => {
      await queryClient.cancelQueries({ queryKey: bookingKeys.all });

      updateOptimistic(bookingId, {
        payment_status: "Completed",
        updated_at: new Date().toISOString(),
      });
    },
    onSettled: () => {
      afterBookingPaymentChange();
    },
  });
};

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

// ============================================
// OPTIMIZED AVAILABILITY CHECKING HOOKS
// ============================================

/**
 * Fast unit availability check using check_multi_unit_availability RPC
 * Updated to use existing RPC function with single-unit array
 */
export const useUnitAvailabilityFast = (
  unitId: string,
  checkIn: string,
  checkOut: string,
  excludeBookingId?: string,
  options: { enabled?: boolean } = {}
) => {
  const { enabled = true } = options;

  return useQuery({
    queryKey: ["unit-availability-fast", unitId, checkIn, checkOut, excludeBookingId],
    queryFn: async () => {
      if (!unitId || !checkIn || !checkOut) return null;

      // Use checkMultiUnitAvailability with single unit array
      const { data, error } = await db.bookings.checkMultiUnitAvailability(checkIn, checkOut, {
        unitIds: [unitId],
      });

      if (error) throw new Error(handleSupabaseError(error));

      // Extract first result from array
      const result = (data as unknown as UnitAvailabilityResponse[])?.[0];
      return {
        isAvailable: result?.is_available || false,
        conflictingBookings: 0, // check_multi_unit_availability doesn't return conflicting bookings count
        blackoutPeriods: 0, // check_multi_unit_availability doesn't return blackout count
        unitStatus: result?.is_available ? "Available" : "Unavailable",
      };
    },
    enabled: enabled && !!unitId && !!checkIn && !!checkOut,
    staleTime: 300000, // 5 minutes - availability doesn't change frequently
    // Removed 30s refetch - users can manually check when needed
    retry: 2,
  });
};

/**
 * Multi-unit availability search with advanced filtering
 */
export const useMultiUnitAvailability = (
  checkIn: string,
  checkOut: string,
  filters: {
    unitIds?: string[];
  } = {},
  options: { enabled?: boolean } = {}
) => {
  const { enabled = true } = options;

  return useQuery({
    queryKey: ["multi-unit-availability", checkIn, checkOut, filters],
    queryFn: async () => {
      if (!checkIn || !checkOut) return [];

      const { data, error } = await db.bookings.checkMultiUnitAvailability(
        checkIn,
        checkOut,
        filters
      );

      if (error) throw new Error(handleSupabaseError(error));

      // RPC result type: find_available_units returns UnitAvailabilityResponse[]
      return ((data as unknown as UnitAvailabilityResponse[]) || []).map((unit) => ({
        unit_id: unit.unit_id,
        unit_name: unit.unit_name,
        unit_code: unit.unit_code,
        unit_type: unit.unit_type,
        max_occupancy: unit.max_occupancy,
        base_rate: unit.base_rate,
        weekend_rate: unit.weekend_rate,
        unit_status: "Available",
        created_at: "",
        updated_at: "",
        isAvailable: unit.is_available,
        nextAvailableDate: unit.next_available_date,
      }));
    },
    enabled: enabled && !!checkIn && !!checkOut,
    staleTime: 60000, // 1 minute
    retry: 2,
  });
};

/**
 * Unit availability calendar for calendar UI components
 * ❌ TEMPORARILY DISABLED: Requires get_unit_availability_calendar() RPC function
 * TODO: Deploy availability calendar migration or remove if not needed
 */
/*
export const useAvailabilityCalendar = (
  unitId: string,
  startDate: string,
  endDate: string,
  options: { enabled?: boolean } = {}
) => {
  const { enabled = true } = options;

  return useQuery({
    queryKey: ["availability-calendar", unitId, startDate, endDate],
    queryFn: async () => {
      if (!unitId || !startDate || !endDate) return [];

      const { data, error } = await db.bookings.getAvailabilityCalendar(unitId, startDate, endDate);

      if (error) throw new Error(handleSupabaseError(error));

      // RPC result type: get_availability_calendar returns CalendarDayResponse[]
      return ((data as unknown as CalendarDayResponse[]) || []).map((day) => ({
        date: day.calendar_date,
        status: day.status,
        bookingId: day.booking_id,
        guestName: day.guest_name,
        bookingReference: day.booking_reference,
      }));
    },
    enabled: enabled && !!unitId && !!startDate && !!endDate,
    staleTime: 300000, // 5 minutes
    retry: 1,
  });
};
*/

/**
 * Blackout period management
 */
export const useUnitBlackouts = (
  unitId: string,
  startDate?: string,
  endDate?: string,
  options: { enabled?: boolean } = {}
) => {
  const { enabled = true } = options;

  return useQuery({
    queryKey: ["unit-blackouts", unitId, startDate, endDate],
    queryFn: async () => {
      if (!unitId) return [];

      const query = db.blackouts.byUnit(unitId);

      if (startDate && endDate) {
        const { data, error } = await db.blackouts.inDateRange(startDate, endDate);
        if (error) throw new Error(handleSupabaseError(error));
        return ((data as unknown as BlackoutResponse[]) || []).filter(
          (blackout) => blackout.unit_id === unitId
        );
      }

      const { data, error } = await query;
      if (error) throw new Error(handleSupabaseError(error));
      return data || [];
    },
    enabled: enabled && !!unitId,
    staleTime: 300000, // 5 minutes
    retry: 1,
  });
};

/**
 * Create blackout period with cache invalidation
 */
export const useCreateBlackout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      unitId,
      blackoutType,
      startDate,
      endDate,
      reason,
      createdBy,
    }: {
      unitId: string;
      blackoutType: "Maintenance" | "Renovation" | "Seasonal" | "Manual";
      startDate: string;
      endDate: string;
      reason?: string;
      createdBy?: string;
    }) => {
      const { data, error } = await db.blackouts.create({
        unit_id: unitId,
        blackout_type: blackoutType,
        start_date: startDate,
        end_date: endDate,
        reason,
        created_by: createdBy,
      });

      if (error) throw new Error(handleSupabaseError(error));
      return data;
    },
    onSuccess: (data) => {
      // Invalidate all availability-related queries for the unit
      const blackout = data as unknown as BlackoutResponse;
      queryClient.invalidateQueries({ queryKey: ["unit-blackouts", blackout.unit_id] });
      queryClient.invalidateQueries({ queryKey: ["unit-availability-fast", blackout.unit_id] });
      queryClient.invalidateQueries({ queryKey: ["multi-unit-availability"] });
      queryClient.invalidateQueries({ queryKey: ["availability-calendar", blackout.unit_id] });
      queryClient.invalidateQueries({ queryKey: unitKeys.all });
    },
    onError: (error) => {
      console.error("Failed to create blackout period:", error);
    },
  });
};

/**
 * Cache management and performance optimization
 * ❌ TEMPORARILY DISABLED: Requires availability_cache table and refresh_availability_cache() RPC
 * TODO: Deploy availability cache migration or remove if not needed
 */
/*
export const useAvailabilityCache = () => {
  const queryClient = useQueryClient();

  const refreshCache = useMutation({
    mutationFn: async ({
      unitId,
      daysAhead = 90,
    }: {
      unitId?: string;
      daysAhead?: number;
    } = {}) => {
      const { data, error } = await db.cache.refresh(unitId, daysAhead);
      if (error) throw new Error(handleSupabaseError(error));
      return data;
    },
    onSuccess: (_cacheCount, variables) => {
      // Invalidate queries based on cache refresh scope
      if (variables.unitId) {
        queryClient.invalidateQueries({ queryKey: ["unit-availability-fast", variables.unitId] });
        queryClient.invalidateQueries({ queryKey: ["availability-calendar", variables.unitId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["unit-availability-fast"] });
        queryClient.invalidateQueries({ queryKey: ["multi-unit-availability"] });
        queryClient.invalidateQueries({ queryKey: ["availability-calendar"] });
      }
    },
  });

  const getCacheMetrics = useQuery({
    queryKey: ["cache-metrics"],
    queryFn: async () => {
      const { data, error } = await db.cache.metrics();
      if (error) throw new Error(handleSupabaseError(error));
      return data;
    },
    staleTime: 300000, // 5 minutes
    // Removed auto-refetch to improve performance
    retry: 1,
  });

  return {
    refreshCache,
    getCacheMetrics,
  };
};
*/

// Real-time subscription for booking updates
// NOTE: Disabled for Phase 1 - Real-time features scheduled for Phase 2
// export const useBookingsSubscription = () => {
//   const queryClient = useQueryClient();

//   useQuery({
//     queryKey: ["bookings-subscription"],
//     queryFn: async () => {
//       const channel = supabase
//         .channel("bookings-changes")
//         .on(
//           "postgres_changes",
//           {
//             event: "*",
//             schema: "public",
//             table: "bookings",
//           },
//           (payload) => {
//             queryClient.invalidateQueries({ queryKey: bookingKeys.all });

//             if (payload.eventType === "UPDATE" && payload.new) {
//               queryClient.setQueryData(
//                 bookingKeys.detail((payload.new as Booking).booking_id),
//                 payload.new
//               );
//             }
//           }
//         )
//         .subscribe();

//       return () => {
//         channel.unsubscribe();
//       };
//     },
//     staleTime: Infinity,
//   });
// };

// Get upcoming check-ins
export const useUpcomingCheckIns = (days = 7) => {
  return useQuery({
    queryKey: ["upcoming-checkins", days],
    queryFn: async () => {
      const today = toManilaDateString(new Date());
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      const futureDateStr = toManilaDateString(futureDate);

      const { data, error } = await supabase
        .from("bookings")
        .select(
          `
          *,
          booking_units(
            *,
            unit:units(*)
          ),
          guest:guests(*)
        `
        )
        .gte("check_in", today)
        .lte("check_in", futureDateStr)
        .eq("booking_status", "Confirmed")
        .order("check_in", { ascending: true });

      if (error) throw new Error(handleSupabaseError(error));
      return data;
    },
    staleTime: 60000, // Refresh every minute
  });
};

// Get upcoming check-outs
export const useUpcomingCheckOuts = (days = 7) => {
  return useQuery({
    queryKey: ["upcoming-checkouts", days],
    queryFn: async () => {
      const today = toManilaDateString(new Date());
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      const futureDateStr = toManilaDateString(futureDate);

      const { data, error } = await supabase
        .from("bookings")
        .select(
          `
          *,
          booking_units(
            *,
            unit:units(*)
          ),
          guest:guests(*)
        `
        )
        .gte("check_out", today)
        .lte("check_out", futureDateStr)
        .eq("booking_status", "CheckedIn")
        .order("check_out", { ascending: true });

      if (error) throw new Error(handleSupabaseError(error));
      return data;
    },
    staleTime: 60000,
  });
};

// ============================================
// PHASE 3-4: WORKFLOW-ENHANCED BOOKING OPERATIONS
// Commented out for Phase 2 - simple status updates only
// ============================================

/* TODO: Phase 3-4 - Re-enable workflow integration

export const useUpdateBookingStatusWithWorkflow = () => {
  const queryClient = useQueryClient();
  const updateOptimistic = useBookingStore((state) => state.updateOptimisticBooking);

  return useMutation({
    mutationFn: async ({
      bookingId,
      status,
      resortId = 'resort-okaeri',
      triggeredBy = 'user',
      metadata = {}
    }: {
      bookingId: string;
      status: BookingStatus;
      resortId?: string;
      triggeredBy?: 'user' | 'system' | 'automation';
      metadata?: Record<string, unknown>;
    }) => {
      // Get current booking to determine fromStatus
      const { data: currentBooking } = await db.bookings.byId(bookingId);
      if (!currentBooking) {
        throw new Error('Booking not found');
      }

      // Execute workflow transition via API
      const response = await fetch('/api/workflows/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          fromStatus: currentBooking.booking_status,
          toStatus: status,
          resortId,
          triggeredBy,
          metadata,
        }),
      });

      if (!response.ok) {
        throw new Error(`Workflow execution failed: ${response.statusText}`);
      }

      const workflowResult = await response.json();

      if (!workflowResult.success) {
        throw new Error(
          workflowResult.workflowResult.errors
            .map((e: { message: string }) => e.message)
            .join(', ')
        );
      }

      return workflowResult.workflowResult.updatedBooking;
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
      queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      queryClient.invalidateQueries({ queryKey: ["workflow-status"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-summary"] });
    },
  });
};

/**
 * Get booking with workflow state
 */
export const useBookingWithWorkflow = (
  bookingId: string | undefined,
  resortId = "resort-okaeri"
) => {
  const bookingQuery = useBooking(bookingId);

  const workflowQuery = useQuery({
    queryKey: ["workflow-status", bookingId, resortId],
    queryFn: async () => {
      if (!bookingId) return null;

      const response = await fetch(
        `/api/workflows/status?bookingId=${bookingId}&resortId=${resortId}&includePredictions=true&includeCostEstimate=true`
      );

      if (!response.ok) {
        if (response.status === 404) {
          return null; // Booking not found in workflow system
        }
        throw new Error(`Failed to fetch workflow state: ${response.statusText}`);
      }

      const data = (await response.json()) as unknown as { workflowState: unknown };
      return data.workflowState;
    },
    enabled: !!bookingId && !!bookingQuery.data,
    staleTime: 30000,
  });

  return {
    booking: bookingQuery.data,
    workflowState: workflowQuery.data,
    isLoading: bookingQuery.isLoading || workflowQuery.isLoading,
    error: bookingQuery.error || workflowQuery.error,
    refetch: () => {
      void bookingQuery.refetch();
      void workflowQuery.refetch();
    },
  };
};

/**
 * Automated check-in for eligible bookings
 */
export const useAutomatedCheckIn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const response = await fetch("/api/workflows/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          fromStatus: "Confirmed",
          toStatus: "CheckedIn",
          resortId: "resort-okaeri",
          triggeredBy: "automation",
          metadata: {
            automatedCheckIn: true,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Automated check-in failed: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      queryClient.invalidateQueries({ queryKey: ["upcoming-checkins"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-summary"] });
    },
  });
};

/**
 * Automated check-out for eligible bookings
 */
export const useAutomatedCheckOut = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const response = await fetch("/api/workflows/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          fromStatus: "CheckedIn",
          toStatus: "CheckedOut",
          resortId: "resort-okaeri",
          triggeredBy: "automation",
          metadata: {
            automatedCheckOut: true,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Automated check-out failed: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      queryClient.invalidateQueries({ queryKey: ["upcoming-checkouts"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-summary"] });
    },
  });
};

/**
 * Get bookings that need attention (workflow alerts)
 */
export const useBookingsNeedingAttention = (resortId = "resort-okaeri") => {
  return useQuery({
    queryKey: ["bookings-needing-attention", resortId],
    queryFn: async () => {
      // Get all active bookings
      const { data: bookings, error } = await supabase
        .from("bookings")
        .select(
          `
          *,
          booking_units(
            *,
            unit:units(*)
          ),
          guest:guests(*)
        `
        )
        .in("booking_status", ["Pending", "Confirmed", "CheckedIn"])
        .order("check_in", { ascending: true });

      if (error) throw new Error(handleSupabaseError(error));

      // Filter bookings that need attention based on workflow rules
      const now = new Date();
      const needingAttention =
        bookings?.filter((booking) => {
          const checkInDate = new Date(booking.check_in);
          const checkOutDate = new Date(booking.check_out);

          // Payment overdue for confirmed bookings
          if (
            booking.booking_status === "Confirmed" &&
            booking.payment_status === "Pending" &&
            checkInDate <= now
          ) {
            return true;
          }

          // Overdue check-ins
          if (
            booking.booking_status === "Confirmed" &&
            checkInDate < now &&
            booking.payment_status === "Completed"
          ) {
            return true;
          }

          // Overdue check-outs
          if (booking.booking_status === "CheckedIn" && checkOutDate < now) {
            return true;
          }

          // Pending bookings close to check-in date
          if (
            booking.booking_status === "Pending" &&
            checkInDate <= new Date(Date.now() + 24 * 60 * 60 * 1000)
          ) {
            return true;
          }

          return false;
        }) || [];

      return needingAttention;
    },
    staleTime: 300000, // 5 minutes
    // Removed auto-refetch for better performance
  });
};

/**
 * Get workflow metrics for dashboard
 */
export const useBookingWorkflowMetrics = (resortId = "resort-okaeri") => {
  return useQuery({
    queryKey: ["booking-workflow-metrics", resortId],
    queryFn: async () => {
      const response = await fetch(
        `/api/workflows/status?resortId=${resortId}&includeCostEstimate=true`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch workflow metrics: ${response.statusText}`);
      }

      const data = (await response.json()) as unknown as {
        summary?: {
          totalBookings?: number;
          activeAutomatedTriggers?: number;
          pendingActions?: number;
          estimatedMonthlyCost?: number;
        };
      };

      return {
        totalBookings: data.summary?.totalBookings || 0,
        activeAutomatedTriggers: data.summary?.activeAutomatedTriggers || 0,
        pendingActions: data.summary?.pendingActions || 0,
        estimatedMonthlyCost: data.summary?.estimatedMonthlyCost || 0,
      };
    },
    staleTime: 300000, // 5 minutes
    // Removed refetch - summary data is relatively static
  });
};

/**
 * Process workflow actions in batch
 */
export const useProcessWorkflowBatch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      resortId = "resort-okaeri",
      triggerTypes = ["date", "payment"],
      batchSize = 10,
      dryRun = false,
    }: {
      resortId?: string;
      triggerTypes?: string[];
      batchSize?: number;
      dryRun?: boolean;
    }) => {
      const response = await fetch("/api/workflows/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resortId,
          triggerTypes,
          batchSize,
          dryRun,
        }),
      });

      if (!response.ok) {
        throw new Error(`Batch processing failed: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      queryClient.invalidateQueries({ queryKey: ["workflow-summary"] });
      queryClient.invalidateQueries({ queryKey: ["bookings-needing-attention"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-checkins"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-checkouts"] });
    },
  });
};
