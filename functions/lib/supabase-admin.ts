/**
 * Supabase Admin Helper for Cloudflare Workers
 *
 * Creates Supabase client with service role permissions for backend operations.
 * Uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from environment.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

/**
 * Create Supabase admin client with service role permissions
 */
export function createSupabaseAdmin(env: Env): SupabaseClient {
  if (!env.SUPABASE_URL) {
    throw new Error("SUPABASE_URL is required");
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Find or create guest record
 */
export async function findOrCreateGuest(
  supabase: SupabaseClient,
  guestData: {
    guest_name: string;
    email?: string | null;
    phone_number?: string | null;
  }
): Promise<string> {
  // Normalize empty strings to null
  const normalizedEmail = guestData.email?.trim() || null;
  const normalizedPhone = guestData.phone_number?.trim() || null;

  // Try to find existing guest by email (only if email is provided)
  if (normalizedEmail) {
    const { data: existingGuest, error: findError } = await supabase
      .from("guests")
      .select("guest_id")
      .eq("email", normalizedEmail)
      .single();

    if (existingGuest && !findError) {
      return existingGuest.guest_id;
    }
  }

  // Create new guest if not found
  const { data: newGuest, error: createError } = await supabase
    .from("guests")
    .insert({
      guest_name: guestData.guest_name,
      email: normalizedEmail?.toLowerCase() ?? null,
      phone_number: normalizedPhone,
    })
    .select("guest_id")
    .single();

  if (createError) {
    throw createError;
  }

  return newGuest.guest_id;
}

/**
 * Check unit availability for date range
 */
export async function checkUnitAvailability(
  supabase: SupabaseClient,
  unitId: string,
  checkIn: string,
  checkOut: string
): Promise<boolean> {
  // Call the database function to check availability
  const { data, error } = await supabase.rpc("check_unit_availability", {
    p_unit_id: unitId,
    p_check_in: checkIn,
    p_check_out: checkOut,
  });

  if (error) {
    throw error;
  }

  return data === true;
}
