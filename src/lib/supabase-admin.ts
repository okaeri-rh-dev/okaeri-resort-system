import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Creates Supabase admin client for backend operations
 * Can accept env object (for Cloudflare Functions) or use process.env
 */
export function createSupabaseAdmin(env?: Record<string, string>) {
  const supabaseUrl = env?.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
  const serviceRoleKey =
    env?.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing VITE_SUPABASE_URL");
  }
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "x-application-name": "okaeri-resort-backend",
      },
    },
  });
}

/**
 * Generate a token-based signed upload URL for guest bookings
 * Returns structured credentials for use with uploadToSignedUrl() on client
 */
export async function generateSignedUploadUrl(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  bucket: string,
  path: string,
  expiresIn: number = 3600 // 1 hour default (note: actual expiry is controlled by Supabase, typically 2 hours)
): Promise<{ path: string; token: string; bucket: string; expires_at: string }> {
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(path);

  if (error) {
    console.error("Failed to generate signed URL:", error);
    throw new Error("Failed to generate upload URL");
  }

  return {
    path: data.path,
    token: data.token,
    bucket,
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
}

/**
 * Generate a signed download URL for receipts
 */
export async function generateSignedDownloadUrl(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  bucket: string,
  path: string,
  expiresIn: number = 86400 // 24 hours default
): Promise<string> {
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, expiresIn);

  if (error) {
    console.error("Failed to generate download URL:", error);
    throw new Error("Failed to generate download URL");
  }

  return data.signedUrl;
}

/**
 * Check unit availability atomically
 * This should be replaced with an RPC function for better performance
 */
export async function checkUnitAvailability(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  unitId: string,
  checkIn: string,
  checkOut: string
): Promise<boolean> {
  // Check for overlapping bookings
  const { data: conflicts, error } = await supabaseAdmin
    .from("bookings")
    .select("booking_id")
    .eq("unit_id", unitId)
    .neq("booking_status", "Cancelled")
    .or(`check_in.lt.${checkOut},check_out.gt.${checkIn}`)
    .limit(1);

  if (error) {
    console.error("Failed to check availability:", error);
    throw new Error("Availability check failed");
  }

  return !conflicts || conflicts.length === 0;
}

/**
 * Find or create a guest record
 */
export async function findOrCreateGuest(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  guestData: {
    guest_name: string;
    email: string;
    phone_number: string;
  }
): Promise<string> {
  // First, try to find existing guest
  const { data: existingGuest, error: findError } = await supabaseAdmin
    .from("guests")
    .select("guest_id")
    .eq("email", guestData.email.toLowerCase())
    .single();

  if (existingGuest) {
    return existingGuest.guest_id;
  }

  // If not found (PGRST116 error), create new guest
  if (findError && findError.code !== "PGRST116") {
    console.error("Error finding guest:", findError);
    throw new Error("Failed to process guest information");
  }

  // Create new guest
  const { data: newGuest, error: createError } = await supabaseAdmin
    .from("guests")
    .insert({
      guest_name: guestData.guest_name,
      email: guestData.email.toLowerCase(),
      phone_number: guestData.phone_number,
    })
    .select("guest_id")
    .single();

  if (createError || !newGuest) {
    console.error("Failed to create guest:", createError);
    throw new Error("Failed to create guest record");
  }

  return newGuest.guest_id;
}
