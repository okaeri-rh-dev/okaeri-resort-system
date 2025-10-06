import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, db, handleSupabaseError } from "@/lib/supabase";
import type { Guest, Unit, Booking } from "@/types";

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

// Fetch all guests with search and sorting
export const useGuests = () => {
  const { searchQuery, sortBy, sortOrder } = useGuestStore();
  const optimisticGuests = useGuestStore((state) => state.optimisticGuests);

  return useQuery({
    queryKey: ["guests", searchQuery, sortBy, sortOrder],
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
      const mergedData =
        (data as Guest[])?.map((guest) =>
          optimisticGuests.has(guest.guest_id) ? optimisticGuests.get(guest.guest_id)! : guest
        ) || [];

      return mergedData;
    },
    staleTime: 30000,
    refetchInterval: 120000, // Refresh every 2 minutes
  });
};

// Fetch single guest with booking history
export const useGuest = (guestId: string | undefined) => {
  return useQuery({
    queryKey: ["guests", guestId],
    queryFn: async () => {
      if (!guestId) throw new Error("Guest ID is required");

      const { data, error } = await db.guests.withBookings(guestId);
      if (error) throw new Error(handleSupabaseError(error));
      return data;
    },
    enabled: !!guestId,
    staleTime: 30000,
  });
};

// Get guest by email
export const useGuestByEmail = (email: string | undefined) => {
  return useQuery({
    queryKey: ["guest-by-email", email],
    queryFn: async () => {
      if (!email) throw new Error("Email is required");

      const { data, error } = await db.guests.byEmail(email);
      if (error) throw new Error(handleSupabaseError(error));
      return data;
    },
    enabled: !!email && email.includes("@"),
    staleTime: 30000,
  });
};

// Get guest booking history
export const useGuestBookings = (guestId: string | undefined) => {
  return useQuery({
    queryKey: ["guest-bookings", guestId],
    queryFn: async () => {
      if (!guestId) throw new Error("Guest ID is required");

      const { data, error } = await supabase
        .from("bookings")
        .select(
          `
          *,
          unit:units(*)
        `
        )
        .eq("guest_id", guestId)
        .order("created_at", { ascending: false });

      if (error) throw new Error(handleSupabaseError(error));
      return data as Array<Booking & { unit: Unit }>;
    },
    enabled: !!guestId,
    staleTime: 30000,
  });
};

// Create guest mutation
export const useCreateGuest = () => {
  const queryClient = useQueryClient();
  const addOptimistic = useGuestStore((state) => state.addOptimisticGuest);
  const removeOptimistic = useGuestStore((state) => state.removeOptimisticGuest);

  return useMutation({
    mutationFn: async (
      guestData: Omit<
        Guest,
        "guest_id" | "created_at" | "updated_at" | "total_bookings" | "total_spent"
      >
    ) => {
      const { data, error } = await db.guests.create(guestData);
      if (error) throw new Error(handleSupabaseError(error));
      return data;
    },
    onMutate: async (newGuest) => {
      await queryClient.cancelQueries({ queryKey: ["guests"] });

      // Create optimistic guest
      const optimisticGuest: Guest = {
        ...newGuest,
        guest_id: `temp-${Date.now()}`,
        total_bookings: 0,
        total_spent: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      addOptimistic(optimisticGuest);

      return { optimisticGuest };
    },
    onError: (_err, _newGuest, context) => {
      if (context?.optimisticGuest) {
        removeOptimistic(context.optimisticGuest.guest_id);
      }
    },
    onSuccess: (_data, _variables, context) => {
      if (context?.optimisticGuest) {
        removeOptimistic(context.optimisticGuest.guest_id);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["guests"] });
    },
  });
};

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
      await queryClient.cancelQueries({ queryKey: ["guests"] });

      const previousGuest = queryClient.getQueryData<Guest>(["guests", guestId]);

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
      queryClient.invalidateQueries({ queryKey: ["guests"] });
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
      await queryClient.cancelQueries({ queryKey: ["guests"] });
      removeOptimistic(guestId);
      return { guestId };
    },
    onError: () => {
      // Re-fetch to restore state
      queryClient.invalidateQueries({ queryKey: ["guests"] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guests"] });
    },
  });
};

// Merge duplicate guests
export const useMergeGuests = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      primaryGuestId,
      duplicateGuestId,
    }: {
      primaryGuestId: string;
      duplicateGuestId: string;
    }) => {
      // Update all bookings to point to primary guest
      const { error: bookingError } = await supabase
        .from("bookings")
        .update({ guest_id: primaryGuestId })
        .eq("guest_id", duplicateGuestId);

      if (bookingError) throw new Error(handleSupabaseError(bookingError));

      // Calculate new totals
      const { data: primaryGuest } = await db.guests.byId(primaryGuestId);
      const { data: duplicateGuest } = await db.guests.byId(duplicateGuestId);

      if (primaryGuest && duplicateGuest) {
        // Update primary guest with combined totals
        const { error: updateError } = await db.guests.update(primaryGuestId, {
          total_bookings: (primaryGuest.total_bookings ?? 0) + (duplicateGuest.total_bookings ?? 0),
          total_spent: (primaryGuest.total_spent ?? 0) + (duplicateGuest.total_spent ?? 0),
        });

        if (updateError) throw new Error(handleSupabaseError(updateError));
      }

      // Delete duplicate guest
      const { error: deleteError } = await supabase
        .from("guests")
        .delete()
        .eq("guest_id", duplicateGuestId);

      if (deleteError) throw new Error(handleSupabaseError(deleteError));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guests"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
};

// Guest statistics
interface GuestStatistics {
  totalGuests: number;
  newGuestsThisMonth: number;
  repeatGuests: number;
  averageBookingsPerGuest: number;
  topGuests: Array<{
    guest: Guest;
    totalSpent: number;
    totalBookings: number;
  }>;
}

export const useGuestStatistics = () => {
  return useQuery({
    queryKey: ["guest-statistics"],
    queryFn: async (): Promise<GuestStatistics> => {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get all guests
      const { data: allGuests, error: guestsError } = await supabase
        .from("guests")
        .select("*")
        .order("total_spent", { ascending: false });

      if (guestsError) throw new Error(handleSupabaseError(guestsError));

      // Get new guests this month
      const { data: newGuests, error: newGuestsError } = await supabase
        .from("guests")
        .select("guest_id")
        .gte("created_at", firstDayOfMonth.toISOString());

      if (newGuestsError) throw new Error(handleSupabaseError(newGuestsError));

      // Calculate statistics
      const totalGuests = allGuests?.length || 0;
      const newGuestsThisMonth = newGuests?.length || 0;
      const repeatGuests = allGuests?.filter((g) => (g.total_bookings ?? 0) > 1).length || 0;

      const totalBookings = allGuests?.reduce((sum, g) => sum + (g.total_bookings ?? 0), 0) || 0;
      const averageBookingsPerGuest = totalGuests > 0 ? totalBookings / totalGuests : 0;

      const topGuests = (allGuests || []).slice(0, 10).map((guest) => ({
        guest: {
          ...guest,
          created_at: guest.created_at || new Date().toISOString(),
          updated_at: guest.updated_at || new Date().toISOString(),
        },
        totalSpent: guest.total_spent ?? 0,
        totalBookings: guest.total_bookings ?? 0,
      }));

      return {
        totalGuests,
        newGuestsThisMonth,
        repeatGuests,
        averageBookingsPerGuest,
        topGuests,
      };
    },
    staleTime: 300000, // 5 minutes
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
//             queryClient.invalidateQueries({ queryKey: ["guests"] });

//             if (payload.eventType === "UPDATE" && payload.new) {
//               queryClient.setQueryData(["guests", (payload.new as Guest).guest_id], payload.new);
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
          email: guest.email,
          phone_number: guest.phone_number, // Will be formatted to +63 format
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
            console.log(`Successfully exported ${data?.length || 0} guests to ${filename}`);
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
