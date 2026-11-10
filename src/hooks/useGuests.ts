import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getAccessToken } from "@/hooks/useAuthToken";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "@/hooks/useDebouncedValue";
import { afterWrite, type TableName } from "@/lib/after-write";
import { throwDetailLoadError } from "@/lib/detail-load-error";
import { logger } from "@/lib/logger";
import { patchCachedLists } from "@/lib/optimistic-list-patch";
import { guestKeys } from "@/lib/query-keys";
import { ilikeAnyFilter } from "@/lib/search-filter";
import { db, handleSupabaseError, supabase } from "@/lib/supabase";
import { useGuestStore, type GuestStore } from "@/stores/useGuestStore";
import type { Booking, Guest } from "@/types";

// One guest with its bookings; the detail and edit routes and useEntityEdit share this cache entry
export const guestDetailQuery = (guestId: string) =>
  queryOptions({
    queryKey: guestKeys.detail(guestId),
    queryFn: async () => {
      const { data, error } = await db.guests.withBookings(guestId);
      if (error) throwDetailLoadError(error, "guest");
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
        query = query.or(ilikeAnyFilter(["guest_name", "email", "phone_number"], searchQuery));
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

      return (data as Guest[]) || [];
    },
    staleTime: 30000,
    refetchInterval: 120000, // Refresh every 2 minutes
  });

export const useGuests = () => {
  const { searchQuery, sortBy, sortOrder } = useGuestStore();
  const debouncedSearchQuery = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);

  return useQuery(guestListQuery({ searchQuery: debouncedSearchQuery, sortBy, sortOrder }));
};

/** Up to 5 guests whose name or phone matches, for picking a guest on a new booking. */
export const useGuestPick = (query: string) => {
  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  return useQuery(
    queryOptions({
      queryKey: guestKeys.pick(debouncedQuery),
      queryFn: async () => {
        const { data, error } = await supabase
          .from("guests")
          .select("guest_id, guest_name, phone_number, email, total_bookings")
          .is("anonymized_at", null)
          .or(ilikeAnyFilter(["guest_name", "phone_number"], debouncedQuery))
          .order("guest_name")
          .limit(5);
        if (error) throw new Error(handleSupabaseError(error));
        return data;
      },
      enabled: debouncedQuery.length >= 2,
    })
  );
};

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

// Update guest mutation
export const useUpdateGuest = () => {
  const queryClient = useQueryClient();
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
    onMutate: ({ guestId, updates }) =>
      patchCachedLists<Guest>(queryClient, guestKeys.lists(), (guest) =>
        guest.guest_id === guestId ? { ...guest, ...updates } : guest
      ),
    onError: (_error, _variables, restore) => restore?.(),
    onSettled: () => afterWrite("guests"),
  });
};

const RETENTION_ERROR_BY_STATUS: Record<number, string> = {
  404: "This guest no longer exists. Refresh the page.",
  409: "This guest has a current or upcoming booking. Cancel or finish it first.",
};

// anonymize_guest and delete_guest write these (20261021000000_guest_retention.sql)
const GUEST_RETENTION_WRITES = [
  "guests",
  "guest_assignments",
  "bookings",
  "booking_units",
  "payments",
  "audit_logs_archive",
] as const satisfies readonly TableName[];

async function callGuestRetention(path: string, method: "POST" | "DELETE") {
  const response = await fetch(path, {
    method,
    headers: { Authorization: `Bearer ${await getAccessToken()}` },
  });
  const body = (await response.json().catch(() => ({}))) as {
    deleted_files?: number;
    message?: string;
  };
  if (!response.ok) {
    throw new Error(
      RETENTION_ERROR_BY_STATUS[response.status] ??
        body.message ??
        `Request failed (${response.status})`
    );
  }
  return { deleted_files: body.deleted_files ?? 0 };
}

// Erasure request (owner/admin): personal data is cleared, money and dates stay
export const useAnonymizeGuest = () =>
  useMutation({
    mutationFn: (guestId: string) =>
      callGuestRetention(`/api/admin/guests/${guestId}/anonymize`, "POST"),
    onSettled: () => afterWrite(...GUEST_RETENTION_WRITES),
  });

// Delete guest mutation: delete_guest refuses Confirmed/CheckedIn or current/future bookings (409)
export const useDeleteGuest = () => {
  return useMutation({
    mutationFn: (guestId: string) => callGuestRetention(`/api/admin/guests/${guestId}`, "DELETE"),
    onSettled: () => afterWrite(...GUEST_RETENTION_WRITES),
  });
};

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
