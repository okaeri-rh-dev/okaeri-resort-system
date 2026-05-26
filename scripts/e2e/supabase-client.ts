import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// Load .env.local first (developer-specific), then .env as fallback.
dotenv.config({ path: path.join(repoRoot, ".env.local") });
dotenv.config({ path: path.join(repoRoot, ".env") });

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? process.env.TEST_SUPABASE_URL;

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;

export const SUPABASE_LOCAL_URL = SUPABASE_URL ?? "http://127.0.0.1:54321";

export function getServiceRoleClient(): SupabaseClient {
  if (!SUPABASE_URL) {
    console.error(
      "✗ Missing Supabase URL.\n  Set VITE_SUPABASE_URL (or SUPABASE_URL) in .env.local."
    );
    process.exit(1);
  }
  if (!SERVICE_ROLE_KEY) {
    console.error("✗ Missing service role key.\n  Set SUPABASE_SERVICE_ROLE_KEY in .env.local.");
    process.exit(1);
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
