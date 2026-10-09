/**
 * Supabase Admin Helper for Cloudflare Workers
 *
 * Creates Supabase client with service role permissions for backend operations.
 * Uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from environment.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

/**
 * Create Supabase admin client with service role permissions
 */
export function createSupabaseAdmin(env: Env): SupabaseClient<Database> {
  if (!env.SUPABASE_URL) {
    throw new Error("SUPABASE_URL is required");
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  }

  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
