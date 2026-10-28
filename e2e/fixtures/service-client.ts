import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for seeding and cleanup. Local-only: every env file points at
 * 127.0.0.1, and the fallback is the well-known local service key, so specs run without one.
 */
export function serviceClient() {
  return createClient(
    process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321",
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ||
      "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
