import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import { logger } from "@/lib/logger";
import { invalidateGuests } from "@/lib/query-invalidation";
import { guestKeys } from "@/lib/query-keys";
import { db, handleSupabaseError, supabase } from "@/lib/supabase";
import type { Booking, Guest } from "@/types";

// ============================================
// ZUSTAND STORE
// ============================================
interface GuestStore {
  // Local state
  selectedGuest: Guest | null;
  searchQuery: string;
  sortBy: "name" | "bookings" | "spent" | "created";
  sortOrder: "asc" | "desc";

  // Actions
  setSelectedGuest: (guest: Guest | null) => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sortBy: "name" | "bookings" | "spent" | "created") => void;
  setSortOrder: (order: "asc" | "desc") => void;

  // Optimistic updates
  optimisticGuests: Map<string, Guest>;
  addOptimisticGuest: (guest: Guest) => void;
  updateOptimisticGuest: (guestId: string, updates: Partial<Guest>) => void;
  removeOptimisticGuest: (guestId: string) => void;
  clearOptimisticGuests: () => void;
}

export const useGuestStore = create<GuestStore>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        selectedGuest: null,
        searchQuery: "",
        sortBy: "name",
        sortOrder: "asc",
        optimisticGuests: new Map(),

        // Actions
        setSelectedGuest: (guest) => set({ selectedGuest: guest }),

        setSearchQuery: (query) => set({ searchQuery: query }),

        setSortBy: (sortBy) => set({ sortBy }),

        setSortOrder: (order) => set({ sortOrder: order }),

        addOptimisticGuest: (guest) =>
          set((state) => {
            const newMap = new Map(state.optimisticGuests);
            newMap.set(guest.guest_id, guest);
            return { optimisticGuests: newMap };
          }),

        updateOptimisticGuest: (guestId, updates) =>
          set((state) => {
            const newMap = new Map(state.optimisticGuests);
            const existing = newMap.get(guestId);
            if (existing) {
              newMap.set(guestId, { ...existing, ...updates });
            }
            return { optimisticGuests: newMap };
          }),

        removeOptimisticGuest: (guestId) =>
          set((state) => {
            const newMap = new Map(state.optimisticGuests);
            newMap.delete(guestId);
            return { optimisticGuests: newMap };
          }),

        clearOptimisticGuests: () => set({ optimisticGuests: new Map() }),
      }),
      {
        name: "guest-storage",
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
            sortBy: state.sortBy,
            sortOrder: state.sortOrder,
          }) as GuestStore,
      }
    ),
    {
      name: "GuestStore",
    }
  )
);

// ============================================
// TANSTACK QUERY HOOKS
// ============================================

// One guest with its bookings; the detail and edit routes and useEntityEdit share this cache entry
export const guestDetailQuery = (guestId: string) =>
  queryOptions({
    queryKey: guestKeys.detail(guestId),
    queryFn: async () => {
      const { data, error } = await db.guests.withBookings(guestId);
      if (error) throw new Error(`Failed to load guest: ${handleSupabaseError(error)}`);
      return data;
    },
    staleTime: 30000,
  });

// Fetch all guests with search and sorting
const guestListQuery = ({
  searchQuery,
  sortBy,
  sortOrder,
}: Pick<GuestStore, "searchQuery" | "sortBy" | "sortOrder">) =>
  queryOptions({
    queryKey: guestKeys.list({ searchQuery, sortBy, sortOrder }),
    queryFn: async () => {
      let query = supabase.from("guests").select("*");

      // Apply search
      if (searchQuery) {
        query = query.or(
          `guest_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone_number.ilike.%${searchQuery}%`
        );
      }

      // Apply sorting
      const sortColumn =
        sortBy === "name"
          ? "guest_name"
          : sortBy === "bookings"
            ? "total_bookings"
            : sortBy === "spent"
              ? "total_spent"
              : "created_at";

      query = query.order(sortColumn, { ascending: sortOrder === "asc" });

      const { data, error } = await query;

      if (error) throw new Error(handleSupabaseError(error));

      // Merge with optimistic updates
      const { optimisticGuests } = useGuestStore.getState();
      const mergedData =
        (data as Guest[])?.map((guest) => optimisticGuests.get(guest.guest_id) ?? guest) || [];

      return mergedData;
    },
    staleTime: 30000,
    refetchInterval: 120000, // Refresh every 2 minutes
  });

export const useGuests = () => {
  const { searchQuery, sortBy, sortOrder } = useGuestStore();

  return useQuery(guestListQuery({ searchQuery, sortBy, sortOrder }));
};

// Fetch single guest with booking history

// Get guest by email

// Get guest booking history
const guestBookingsQuery = (guestId: string) =>
  queryOptions({
    queryKey: guestKeys.bookings(guestId),
    queryFn: async () => {
      if (!guestId) throw new Error("Guest ID is required");

      const { data, error } = await supabase
        .from("bookings")
        .select(
          `
          *,
          booking_units(
            *,
            unit:units(*)
          )
        `
        )
        .eq("guest_id", guestId)
        .order("created_at", { ascending: false });

      if (error) throw new Error(handleSupabaseError(error));
      return data as Booking[];
    },
    staleTime: 30000,
  });

export const useGuestBookings = (guestId: string | undefined) => {
  return useQuery({
    ...guestBookingsQuery(guestId ?? ""),
    enabled: !!guestId,
  });
};

// Create guest mutation

// Update guest mutation
export const useUpdateGuest = () => {
  const queryClient = useQueryClient();
  const updateOptimistic = useGuestStore((state) => state.updateOptimisticGuest);

  return useMutation({
    mutationFn: async ({
      guestId,
      updates,
    }: {
      guestId: string;
      updates: Partial<Omit<Guest, "guest_id" | "created_at" | "updated_at">>;
    }) => {
      const { data, error } = await db.guests.update(guestId, updates);
      if (error) throw new Error(handleSupabaseError(error));
      return data;
    },
    onMutate: async ({ guestId, updates }) => {
      await queryClient.cancelQueries({ queryKey: guestKeys.all });

      const previousGuest = queryClient.getQueryData<Guest>(guestKeys.detail(guestId));

      updateOptimistic(guestId, {
        ...updates,
        updated_at: new Date().toISOString(),
      });

      return { previousGuest };
    },
    onError: (_, { guestId }, context) => {
      if (context?.previousGuest) {
        updateOptimistic(guestId, context.previousGuest);
      }
    },
    onSettled: () => {
      invalidateGuests();
    },
  });
};

// Delete guest mutation
export const useDeleteGuest = () => {
  const queryClient = useQueryClient();
  const removeOptimistic = useGuestStore((state) => state.removeOptimisticGuest);

  return useMutation({
    mutationFn: async (guestId: string) => {
      // Check for active bookings first
      const { data: bookings } = await supabase
        .from("bookings")
        .select("booking_id")
        .eq("guest_id", guestId)
        .in("booking_status", ["Confirmed", "CheckedIn"])
        .limit(1);

      if (bookings?.length) {
        throw new Error("Cannot delete guest with active bookings");
      }

      const { error } = await supabase.from("guests").delete().eq("guest_id", guestId);

      if (error) throw new Error(handleSupabaseError(error));
    },
    onMutate: async (guestId) => {
      await queryClient.cancelQueries({ queryKey: guestKeys.all });
      removeOptimistic(guestId);
      return { guestId };
    },
    onError: () => {
      // Re-fetch to restore state
      invalidateGuests();
    },
    onSuccess: () => {
      invalidateGuests();
    },
  });
};

// Real-time subscription for guest updates
// NOTE: Disabled for Phase 1 - Real-time features scheduled for Phase 2
// export const useGuestsSubscription = () => {
//   const queryClient = useQueryClient();

//   useQuery({
//     queryKey: ["guests-subscription"],
//     queryFn: async () => {
//       const channel = supabase
//         .channel("guests-changes")
//         .on(
//           "postgres_changes",
//           {
//             event: "*",
//             schema: "public",
//             table: "guests",
//           },
//           (payload) => {
//             queryClient.invalidateQueries({ queryKey: guestKeys.all });

//             if (payload.eventType === "UPDATE" && payload.new) {
//               queryClient.setQueryData(guestKeys.detail((payload.new as Guest).guest_id), payload.new);
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

// Export guest data to CSV with Philippine business compliance
export const useExportGuests = () => {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("guests")
        .select("*")
        .order("guest_name", { ascending: true });

      if (error) throw new Error(handleSupabaseError(error));

      // Import the secure export function
      const { exportToCSV } = await import("@/utils/reports");

      // Prepare data with all fields for Philippine compliance
      const exportData =
        data?.map((guest) => ({
          guest_name: guest.guest_name,
          email: guest.email || "",
          phone_number: guest.phone_number || "", // Will be formatted to +63 format
          total_bookings: guest.total_bookings ?? 0,
          total_spent: guest.total_spent ?? 0, // Will be formatted as PHP currency
          loyalty_status: "Regular", // Default since property doesn't exist in Guest type
          preferred_payment: "N/A", // Default since property doesn't exist in Guest type
          address: "N/A", // Default since property doesn't exist in Guest type
          city: "N/A", // Default since property doesn't exist in Guest type
          country: "Philippines", // Default since property doesn't exist in Guest type
          created_date: guest.created_at,
          last_booking: "N/A", // Default since property doesn't exist in Guest type
        })) || [];

      // Export with Philippine formatting and security
      await exportToCSV(
        exportData,
        "guests",
        [
          "Guest Name",
          "Email",
          "Phone Number",
          "Total Bookings",
          "Total Spent",
          "Loyalty Status",
          "Preferred Payment",
          "Address",
          "City",
          "Country",
          "Created Date",
          "Last Booking",
        ],
        {
          philippineFormat: true,
          includeTimestamp: true,
          onSuccess: (filename) => {
            logger.info(`Successfully exported ${data?.length || 0} guests to ${filename}`);
          },
          onError: (error) => {
            console.error("Guest export failed:", error);
            throw new Error(error);
          },
        }
      );

      return data;
    },
  });
};
