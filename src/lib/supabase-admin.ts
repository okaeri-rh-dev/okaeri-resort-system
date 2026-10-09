import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import { requireEnv } from "./env";

/**
 * Creates Supabase admin client for backend operations
 *
 * Works in multiple contexts:
 * - Browser/Vite: Uses import.meta.env via compatibility layer
 * - Cloudflare Workers: Uses env object passed as parameter
 * - Node.js: Uses process.env via compatibility layer
 *
 * @param env - Optional environment object (for Cloudflare Workers)
 * @returns Supabase admin client with service role key
 */
export function createSupabaseAdmin(env?: {
  SUPABASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}) {
  // Workers receive SUPABASE_URL; VITE_SUPABASE_URL and the compatibility layer cover Vite/Node
  const supabaseUrl =
    env?.SUPABASE_URL || env?.VITE_SUPABASE_URL || requireEnv("VITE_SUPABASE_URL");
  const serviceRoleKey = env?.SUPABASE_SERVICE_ROLE_KEY || requireEnv("SUPABASE_SERVICE_ROLE_KEY");

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
