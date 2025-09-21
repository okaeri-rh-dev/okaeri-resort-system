import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, db, handleSupabaseError, storage } from "@/lib/supabase";
import type {
  Booking,
  BookingFilters,
  BookingStatus,
  PaymentStatus,
  BookingFormData,
  TableState,
} from "@/types";

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

  // Optimistic updates
  optimisticBookings: Map<string, Booking>;
  addOptimisticBooking: (booking: Booking) => void;
  updateOptimisticBooking: (bookingId: string, updates: Partial<Booking>) => void;
  removeOptimisticBooking: (bookingId: string) => void;
  clearOptimisticBookings: () => void;

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
        filters: {},
        sortBy: "date",
        sortOrder: "desc",
        searchQuery: "",
        optimisticBookings: new Map(),
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
            newMap.set(booking.booking_id, booking);
            return { optimisticBookings: newMap };
          }),

        updateOptimisticBooking: (bookingId, updates) =>
          set((state) => {
            const newMap = new Map(state.optimisticBookings);
            const existing = newMap.get(bookingId);
            if (existing) {
              newMap.set(bookingId, { ...existing, ...updates });
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

// Fetch all bookings with filters
export const useBookings = () => {
  const { filters, searchQuery, sortBy, sortOrder } = useBookingStore();
  const optimisticBookings = useBookingStore((state) => state.optimisticBookings);

  return useQuery({
    queryKey: ["bookings", filters, searchQuery, sortBy, sortOrder],
    queryFn: async () => {
      let query = supabase.from("bookings").select(`
        *,
        unit:units(*),
        guest:guests(*)
      `);

      // Apply filters
      if (filters.status) {
        query = query.eq("booking_status", filters.status);
      }
      if (filters.payment_status) {
        query = query.eq("payment_status", filters.payment_status);
      }
      if (filters.unit_id) {
        query = query.eq("unit_id", filters.unit_id);
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

      // Merge with optimistic updates
      const mergedData =
        data?.map((booking) =>
          optimisticBookings.has(booking.booking_id)
            ? { ...booking, ...optimisticBookings.get(booking.booking_id) }
            : booking
        ) || [];

      return mergedData;
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
};

// Fetch single booking
export const useBooking = (bookingId: string | undefined) => {
  return useQuery({
    queryKey: ["bookings", bookingId],
    queryFn: async () => {
      if (!bookingId) throw new Error("Booking ID is required");

      const { data, error } = await db.bookings.byId(bookingId);
      if (error) throw new Error(handleSupabaseError(error));
      return data;
    },
    enabled: !!bookingId,
    staleTime: 30000,
  });
};

// Create booking mutation with optimistic update
export const useCreateBooking = () => {
  const queryClient = useQueryClient();
  const addOptimistic = useBookingStore((state) => state.addOptimisticBooking);
  const removeOptimistic = useBookingStore((state) => state.removeOptimisticBooking);

  return useMutation({
    mutationFn: async (bookingData: BookingFormData & { total_amount: number }) => {
      // Check if guest exists or create new
      let guestId = null;
      const { data: existingGuest } = await db.guests.byEmail(bookingData.email);

      if (existingGuest) {
        guestId = existingGuest.guest_id;
      } else {
        const { data: newGuest, error: guestError } = await db.guests.create({
          guest_name: bookingData.guest_name,
          email: bookingData.email,
          phone_number: bookingData.contact_number,
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
        unit_id: bookingData.unit_id,
        guest_id: guestId,
        guest_name: bookingData.guest_name,
        contact_number: bookingData.contact_number,
        email: bookingData.email,
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
        payment_status: "Unpaid" as PaymentStatus,
        payment_method: bookingData.payment_method || null,
        special_requests: bookingData.special_requests || null,
      };

      const { data, error } = await supabase.from("bookings").insert(booking).select().single();
      if (error) throw new Error(handleSupabaseError(error));
      return data;
    },
    onMutate: async (newBooking) => {
      await queryClient.cancelQueries({ queryKey: ["bookings"] });

      // Create optimistic booking
      const optimisticBooking: Booking = {
        booking_id: `temp-${Date.now()}`,
        booking_reference: `BK-${Date.now()}`,
        unit_id: newBooking.unit_id,
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
        payment_status: "Unpaid",
        payment_method: newBooking.payment_method || null,
        payment_proof_url: null,
        special_requests: newBooking.special_requests || null,
        internal_notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["guests"] });
    },
  });
};

// Update booking status with optimistic update
export const useUpdateBookingStatus = () => {
  const queryClient = useQueryClient();
  const updateOptimistic = useBookingStore((state) => state.updateOptimisticBooking);

  return useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: string; status: BookingStatus }) => {
      const { data, error } = await db.bookings.update(bookingId, {
        booking_status: status,
      });
      if (error) throw new Error(handleSupabaseError(error));
      return data;
    },
    onMutate: async ({ bookingId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["bookings"] });

      const previousBooking = queryClient.getQueryData<Booking>(["bookings", bookingId]);

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
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
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
      const updates: any = { payment_status: paymentStatus };
      if (paymentMethod) updates.payment_method = paymentMethod;

      const { data, error } = await db.bookings.update(bookingId, updates);
      if (error) throw new Error(handleSupabaseError(error));
      return data;
    },
    onMutate: async ({ bookingId, paymentStatus, paymentMethod }) => {
      await queryClient.cancelQueries({ queryKey: ["bookings"] });

      const previousBooking = queryClient.getQueryData<Booking>(["bookings", bookingId]);

      const updates: Partial<Booking> = {
        payment_status: paymentStatus,
        updated_at: new Date().toISOString(),
      };
      if (paymentMethod) updates.payment_method = paymentMethod as any;

      updateOptimistic(bookingId, updates);

      return { previousBooking };
    },
    onError: (_, { bookingId }, context) => {
      if (context?.previousBooking) {
        updateOptimistic(bookingId, context.previousBooking);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
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

      // Update booking with proof URL
      const { data, error } = await db.bookings.update(bookingId, {
        payment_proof_url: url,
        payment_status: "Paid",
      });

      if (error) throw new Error(handleSupabaseError(error));
      return data;
    },
    onMutate: async ({ bookingId }) => {
      await queryClient.cancelQueries({ queryKey: ["bookings"] });

      updateOptimistic(bookingId, {
        payment_status: "Paid",
        updated_at: new Date().toISOString(),
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
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
      await queryClient.cancelQueries({ queryKey: ["bookings"] });

      updateOptimistic(bookingId, {
        booking_status: "Cancelled",
        updated_at: new Date().toISOString(),
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["units"] }); // Update unit availability
    },
  });
};

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
//             queryClient.invalidateQueries({ queryKey: ["bookings"] });

//             if (payload.eventType === "UPDATE" && payload.new) {
//               queryClient.setQueryData(
//                 ["bookings", (payload.new as Booking).booking_id],
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
      const today = new Date().toISOString().split("T")[0];
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("bookings")
        .select(
          `
          *,
          unit:units(*),
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
      const today = new Date().toISOString().split("T")[0];
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("bookings")
        .select(
          `
          *,
          unit:units(*),
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
