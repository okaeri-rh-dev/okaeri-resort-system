// ============================================
// CENTRAL EXPORT FOR ALL STORES
// ============================================

// Unit Store
export {
  useUnitStore,
  useUnits,
  useUnit,
  useCreateUnit,
  useUpdateUnit,
  useDeleteUnit,
  useCheckAvailability,
  calculateRate,
  // useUnitsSubscription, // Disabled for Phase 1 - Real-time features scheduled for Phase 2
  useBatchUpdateUnitsStatus,
} from "./useUnitStore";

// Booking Store
export {
  useBookingStore,
  useBookings,
  useBooking,
  useCreateBooking,
  useUpdateBookingStatus,
  useUpdatePaymentStatus,
  useUploadPaymentProof,
  useCancelBooking,
  // useBookingsSubscription, // Disabled for Phase 1 - Real-time features scheduled for Phase 2
  useUpcomingCheckIns,
  useUpcomingCheckOuts,
} from "./useBookingStore";

// Guest Store
export {
  useGuestStore,
  useGuests,
  useGuest,
  useGuestBookings,
  useCreateGuest,
  useUpdateGuest,
  useMergeGuests,
  useGuestStatistics,
  // useGuestsSubscription, // Disabled for Phase 1 - Real-time features scheduled for Phase 2
  useExportGuests,
} from "./useGuestStore";

// UI Store
export {
  useUIStore,
  useAsyncAction,
  useConfirm,
  useFormLoading,
  useKeyboardShortcuts,
  initializeTheme,
  type Toast,
  type ToastType,
  type ModalType,
  type ConfirmDialogState,
} from "./useUIStore";

// ============================================
// COMBINED HOOKS
// ============================================

import { useQuery } from "@tanstack/react-query";
import { supabase, handleSupabaseError } from "@/lib/supabase";
import type { DashboardStats } from "@/types";

// Dashboard statistics combining data from multiple stores
export const useDashboardStats = () => {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async (): Promise<DashboardStats> => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Fetch all required data in parallel
      const [
        unitsResult,
        bookingsResult,
        revenueResult,
        monthlyRevenueResult,
        upcomingCheckInsResult,
        upcomingCheckOutsResult,
      ] = await Promise.all([
        // Total and available units
        supabase.from("units").select("unit_status"),

        // Total and active bookings
        supabase
          .from("bookings")
          .select("booking_status")
          .in("booking_status", ["Confirmed", "CheckedIn"]),

        // Total revenue (all paid bookings)
        supabase.from("bookings").select("total_amount").eq("payment_status", "Completed"),

        // Monthly revenue
        supabase
          .from("bookings")
          .select("total_amount")
          .eq("payment_status", "Completed")
          .gte("created_at", startOfMonth.toISOString())
          .lte("created_at", endOfMonth.toISOString()),

        // Upcoming check-ins (next 7 days)
        supabase
          .from("bookings")
          .select("booking_id")
          .eq("booking_status", "Confirmed")
          .gte("check_in", now.toISOString())
          .lte("check_in", new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()),

        // Upcoming check-outs (next 7 days)
        supabase
          .from("bookings")
          .select("booking_id")
          .eq("booking_status", "CheckedIn")
          .gte("check_out", now.toISOString())
          .lte("check_out", new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      if (unitsResult.error) throw new Error(handleSupabaseError(unitsResult.error));
      if (bookingsResult.error) throw new Error(handleSupabaseError(bookingsResult.error));
      if (revenueResult.error) throw new Error(handleSupabaseError(revenueResult.error));
      if (monthlyRevenueResult.error)
        throw new Error(handleSupabaseError(monthlyRevenueResult.error));
      if (upcomingCheckInsResult.error)
        throw new Error(handleSupabaseError(upcomingCheckInsResult.error));
      if (upcomingCheckOutsResult.error)
        throw new Error(handleSupabaseError(upcomingCheckOutsResult.error));

      const totalUnits = unitsResult.data?.length || 0;
      const availableUnits =
        unitsResult.data?.filter((u) => u.unit_status === "Available").length || 0;
      const activeBookings = bookingsResult.data?.length || 0;

      // Calculate occupancy rate
      const occupiedUnits = totalUnits - availableUnits;
      const averageOccupancy = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

      return {
        totalUnits,
        availableUnits,
        totalBookings: activeBookings,
        activeBookings,
        totalRevenue: revenueResult.data?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0,
        monthlyRevenue:
          monthlyRevenueResult.data?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0,
        averageOccupancy,
        upcomingCheckIns: upcomingCheckInsResult.data?.length || 0,
        upcomingCheckOuts: upcomingCheckOutsResult.data?.length || 0,
      };
    },
    staleTime: 60000, // 1 minute
    refetchInterval: 300000, // 5 minutes
  });
};

// Search across all entities
export const useGlobalSearch = (query: string) => {
  return useQuery({
    queryKey: ["global-search", query],
    queryFn: async () => {
      if (!query || query.length < 2) {
        return { units: [], bookings: [], guests: [] };
      }

      const searchPattern = `%${query}%`;

      const [unitsResult, bookingsResult, guestsResult] = await Promise.all([
        // Search units
        supabase
          .from("units")
          .select("*")
          .or(`unit_name.ilike.${searchPattern},unit_code.ilike.${searchPattern}`),

        // Search bookings
        supabase
          .from("bookings")
          .select(
            `
            *,
            unit:units(*),
            guest:guests(*)
          `
          )
          .or(
            `booking_reference.ilike.${searchPattern},guest_name.ilike.${searchPattern},email.ilike.${searchPattern}`
          ),

        // Search guests
        supabase
          .from("guests")
          .select("*")
          .or(
            `guest_name.ilike.${searchPattern},email.ilike.${searchPattern},phone_number.ilike.${searchPattern}`
          ),
      ]);

      return {
        units: unitsResult.data || [],
        bookings: bookingsResult.data || [],
        guests: guestsResult.data || [],
      };
    },
    enabled: query.length >= 2,
    staleTime: 30000,
  });
};

// Recent activity feed
export const useRecentActivity = (limit = 10) => {
  return useQuery({
    queryKey: ["recent-activity", limit],
    queryFn: async () => {
      const { data: bookings, error } = await supabase
        .from("bookings")
        .select(
          `
          *,
          unit:units(unit_name, unit_code),
          guest:guests(guest_name)
        `
        )
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw new Error(handleSupabaseError(error));

      return (
        bookings?.map((booking) => ({
          id: booking.booking_id,
          type: "booking" as const,
          title: `New booking for ${booking.unit?.unit_name}`,
          description: `${booking.guest_name} - ${booking.booking_reference}`,
          timestamp: booking.created_at,
          status: booking.booking_status,
        })) || []
      );
    },
    staleTime: 60000,
    refetchInterval: 120000,
  });
};

// System health check
export const useSystemHealth = () => {
  return useQuery({
    queryKey: ["system-health"],
    queryFn: async () => {
      try {
        // Check Supabase connection
        const { error } = await supabase.from("units").select("unit_id").limit(1);

        if (error) {
          return {
            status: "error" as const,
            message: "Database connection failed",
            details: handleSupabaseError(error),
          };
        }

        return {
          status: "healthy" as const,
          message: "All systems operational",
          details: {
            database: "connected",
            timestamp: new Date().toISOString(),
          },
        };
      } catch (error) {
        return {
          status: "error" as const,
          message: "System check failed",
          details: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    staleTime: 300000, // 5 minutes
    refetchInterval: 600000, // 10 minutes
  });
};
