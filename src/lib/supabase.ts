import { createClient } from "@supabase/supabase-js";
import type { Unit, Guest, Booking, Payment, Expense, MaintenanceLog } from "@/types";

// Environment variables validation
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables. Please check your .env.local file.");
}

// Database type definitions for Supabase
export interface Database {
  public: {
    Tables: {
      units: {
        Row: Unit;
        Insert: Omit<Unit, "unit_id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Unit, "unit_id" | "created_at" | "updated_at">>;
      };
      guests: {
        Row: Guest;
        Insert: Omit<
          Guest,
          "guest_id" | "created_at" | "updated_at" | "total_bookings" | "total_spent"
        >;
        Update: Partial<Omit<Guest, "guest_id" | "created_at" | "updated_at">>;
      };
      bookings: {
        Row: Booking;
        Insert: Omit<Booking, "booking_id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Booking, "booking_id" | "created_at" | "updated_at">>;
      };
      payments: {
        Row: Payment;
        Insert: Omit<Payment, "payment_id" | "created_at">;
        Update: Partial<Omit<Payment, "payment_id" | "created_at">>;
      };
      expenses: {
        Row: Expense;
        Insert: Omit<Expense, "expense_id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Expense, "expense_id" | "created_at" | "updated_at">>;
      };
      maintenance_logs: {
        Row: MaintenanceLog;
        Insert: Omit<MaintenanceLog, "log_id" | "created_at" | "updated_at">;
        Update: Partial<Omit<MaintenanceLog, "log_id" | "created_at" | "updated_at">>;
      };
    };
    Functions: {
      generate_booking_reference: {
        Args: Record<string, never>;
        Returns: string;
      };
      check_unit_availability: {
        Args: {
          p_unit_id: string;
          p_check_in: string;
          p_check_out: string;
        };
        Returns: boolean;
      };
    };
  };
}

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
