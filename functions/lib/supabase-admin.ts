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
 * Generate signed upload URL for file storage
 */
export async function generateSignedUploadUrl(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  expiresIn: number = 3600
) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path, expiresIn);

  if (error) {
    throw error;
  }

  return {
    path,
    token: data.token,
    bucket,
    url: data.signedUrl,
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
}

/**
 * Find or create guest record
 */
export async function findOrCreateGuest(
  supabase: SupabaseClient,
  guestData: {
    guest_name: string;
    email: string;
    phone_number: string;
  }
): Promise<string> {
  // Try to find existing guest by email
  const { data: existingGuest, error: findError } = await supabase
    .from("guests")
    .select("guest_id")
    .eq("email", guestData.email)
    .single();

  if (existingGuest && !findError) {
    return existingGuest.guest_id;
  }

  // Create new guest if not found
  const { data: newGuest, error: createError } = await supabase
    .from("guests")
    .insert({
      guest_name: guestData.guest_name,
      email: guestData.email,
      phone_number: guestData.phone_number,
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
