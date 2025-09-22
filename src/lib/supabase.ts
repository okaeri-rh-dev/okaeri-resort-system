import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../database.types";

// Environment variables validation
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables. Please check your .env.local file.");
}

// Re-export Database type for backwards compatibility
export type { Database } from "../../database.types";

// Create Supabase client with proper typing
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Helper function to handle Supabase errors
export const handleSupabaseError = (error: any): string => {
  if (error?.message) {
    // Handle specific Supabase error codes
    if (error.code === "23505") {
      return "This record already exists. Please check for duplicates.";
    }
    if (error.code === "23503") {
      return "Cannot perform this operation due to related records.";
    }
    if (error.code === "23514") {
      return "Invalid data provided. Please check your input.";
    }
    return error.message;
  }
  return "An unexpected error occurred. Please try again.";
};

// Export typed helper functions for common operations
export const db = {
  units: {
    all: () => supabase.from("units").select("*"),
    byId: (id: string) => supabase.from("units").select("*").eq("unit_id", id).single(),
    create: (data: Database["public"]["Tables"]["units"]["Insert"]) =>
      supabase.from("units").insert(data).select().single(),
    update: (id: string, data: Database["public"]["Tables"]["units"]["Update"]) =>
      supabase.from("units").update(data).eq("unit_id", id).select().single(),
    delete: (id: string) => supabase.from("units").delete().eq("unit_id", id),
    available: () => supabase.from("units").select("*").eq("unit_status", "Available"),
  },

  bookings: {
    all: () =>
      supabase.from("bookings").select(`
      *,
      unit:units(*),
      guest:guests(*)
    `),
    byId: (id: string) =>
      supabase
        .from("bookings")
        .select(
          `
      *,
      unit:units(*),
      guest:guests(*)
    `
        )
        .eq("booking_id", id)
        .single(),
    byUnit: (unitId: string) => supabase.from("bookings").select("*").eq("unit_id", unitId),
    byGuest: (guestId: string) => supabase.from("bookings").select("*").eq("guest_id", guestId),
    create: async (
      data: Omit<Database["public"]["Tables"]["bookings"]["Insert"], "booking_reference">
    ) => {
      // Generate booking reference
      const { data: reference } = await supabase.rpc("generate_booking_reference");
      return supabase
        .from("bookings")
        .insert({
          ...data,
          booking_reference: reference || `BK-${Date.now()}`,
        })
        .select()
        .single();
    },
    update: (id: string, data: Database["public"]["Tables"]["bookings"]["Update"]) =>
      supabase.from("bookings").update(data).eq("booking_id", id).select().single(),
    cancel: (id: string) =>
      supabase.from("bookings").update({ booking_status: "Cancelled" }).eq("booking_id", id),
    checkAvailability: (unitId: string, checkIn: string, checkOut: string) =>
      supabase
        .from("bookings")
        .select("booking_id")
        .eq("unit_id", unitId)
        .not("booking_status", "eq", "Cancelled")
        .or(`check_in.lte.${checkOut},check_out.gte.${checkIn}`),

    // Enhanced availability methods using optimized functions
    checkAvailabilityFast: (
      unitId: string,
      checkIn: string,
      checkOut: string,
      excludeBookingId?: string
    ) =>
      supabase.rpc("check_unit_availability_fast", {
        p_unit_id: unitId,
        p_check_in: checkIn,
        p_check_out: checkOut,
        p_exclude_booking_id: excludeBookingId ?? undefined,
      }),

    checkMultiUnitAvailability: (
      checkIn: string,
      checkOut: string,
      options: {
        unitTypes?: string[];
        minOccupancy?: number;
        maxRate?: number;
        limit?: number;
      } = {}
    ) =>
      supabase.rpc("check_multi_unit_availability", {
        p_check_in: checkIn,
        p_check_out: checkOut,
        p_unit_types: options.unitTypes ?? undefined,
        p_min_occupancy: options.minOccupancy ?? undefined,
        p_max_rate: options.maxRate ?? undefined,
        p_limit: options.limit || 50,
      }),

    getAvailabilityCalendar: (unitId: string, startDate: string, endDate: string) =>
      supabase.rpc("get_unit_availability_calendar", {
        p_unit_id: unitId,
        p_start_date: startDate,
        p_end_date: endDate,
      }),
  },

  guests: {
    all: () => supabase.from("guests").select("*"),
    byId: (id: string) => supabase.from("guests").select("*").eq("guest_id", id).single(),
    byEmail: (email: string) => supabase.from("guests").select("*").eq("email", email).single(),
    create: (data: Database["public"]["Tables"]["guests"]["Insert"]) =>
      supabase
        .from("guests")
        .insert({ ...data, total_bookings: 0, total_spent: 0 })
        .select()
        .single(),
    update: (id: string, data: Database["public"]["Tables"]["guests"]["Update"]) =>
      supabase.from("guests").update(data).eq("guest_id", id).select().single(),
    withBookings: (id: string) =>
      supabase
        .from("guests")
        .select(
          `
      *,
      bookings(*)
    `
        )
        .eq("guest_id", id)
        .single(),
  },

  payments: {
    all: () => supabase.from("payments").select("*"),
    byBooking: (bookingId: string) =>
      supabase.from("payments").select("*").eq("booking_id", bookingId),
    create: (data: Database["public"]["Tables"]["payments"]["Insert"]) =>
      supabase.from("payments").insert(data).select().single(),
  },

  // Blackout period management
  blackouts: {
    all: () => supabase.from("availability_blackouts").select("*"),
    byUnit: (unitId: string) =>
      supabase.from("availability_blackouts").select("*").eq("unit_id", unitId),
    create: (data: Database["public"]["Tables"]["availability_blackouts"]["Insert"]) =>
      supabase.from("availability_blackouts").insert(data).select().single(),
    update: (id: string, data: Database["public"]["Tables"]["availability_blackouts"]["Update"]) =>
      supabase.from("availability_blackouts").update(data).eq("blackout_id", id).select().single(),
    delete: (id: string) => supabase.from("availability_blackouts").delete().eq("blackout_id", id),
    inDateRange: (startDate: string, endDate: string) =>
      supabase
        .from("availability_blackouts")
        .select("*")
        .gte("end_date", startDate)
        .lte("start_date", endDate),
  },

  // Cache management
  cache: {
    refresh: (unitId?: string, daysAhead?: number) =>
      supabase.rpc("refresh_availability_cache", {
        p_unit_id: unitId ?? undefined,
        p_days_ahead: daysAhead || 90,
      }),
    metrics: async () => {
      // Calculate metrics from existing availability_cache table
      const { data, error } = await supabase.from("availability_cache").select("*");
      if (error) throw error;

      const totalEntries = data?.length || 0;
      const validEntries =
        data?.filter((entry) => new Date(entry.cache_expires_at) > new Date()).length || 0;
      const hitRatio = totalEntries > 0 ? (validEntries / totalEntries) * 100 : 0;

      return {
        data: {
          total_cache_entries: totalEntries,
          valid_cache_entries: validEntries,
          cache_hit_ratio_percent: Math.round(hitRatio * 100) / 100,
        },
        error: null,
      };
    },
    clear: (unitId?: string) =>
      unitId
        ? supabase.from("availability_cache").delete().eq("unit_id", unitId)
        : supabase
            .from("availability_cache")
            .delete()
            .lt("cache_expires_at", new Date().toISOString()),
  },
};

// Storage helper for file uploads
export const storage = {
  upload: async (bucket: string, path: string, file: File) => {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (error) throw error;

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);

    return { path: data.path, url: publicUrl };
  },

  delete: (bucket: string, path: string) => supabase.storage.from(bucket).remove([path]),

  getUrl: (bucket: string, path: string) =>
    supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl,
};
