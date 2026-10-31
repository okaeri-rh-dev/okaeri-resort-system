import { createClient } from "@supabase/supabase-js";

const LOCAL_HOSTS = ["127.0.0.1", "localhost", "[::1]"];

/**
 * Service-role client for seeding and cleanup. The fallback is the well-known local service
 * key, so specs run without one; a non-local URL needs an explicit key from the env.
 */
export function serviceClient() {
  const url = process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
  if (!key && !LOCAL_HOSTS.includes(new URL(url).hostname)) {
    throw new Error(`Refusing the local service key for non-local Supabase URL ${url}`);
  }
  return createClient(url, key || "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz", {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
