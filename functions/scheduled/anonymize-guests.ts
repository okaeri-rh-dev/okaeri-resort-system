/**
 * Guest retention (RA 10173): anonymizes guests 24 months after their last check-out,
 * then deletes their payment-proof files. The rules live in the anonymize_expired_guests
 * SQL function; see docs/plans/2026-10-21-guest-retention-design.md.
 */

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import { createLogger } from "../lib/logger";
import { deletePaymentProofFiles } from "../lib/payment-proof-storage";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ENVIRONMENT?: string;
}

export async function anonymizeExpiredGuests(env: Env): Promise<{
  guestsCount: number;
  bookingsCount: number;
  failedCount: number;
  deletedFiles: string[];
  failedFiles: string[];
}> {
  const logger = createLogger(env);
  const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.rpc("anonymize_expired_guests");
  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  const row = data?.[0];
  const guestsCount = row?.guests_count ?? 0;
  const bookingsCount = row?.bookings_count ?? 0;
  const failedCount = row?.failed_count ?? 0;
  const { deleted, failed } = await deletePaymentProofFiles(
    supabase,
    row?.proof_paths ?? [],
    logger
  );

  logger.info(
    `[CRON] Guest anonymization: ${guestsCount} guests, ${bookingsCount} orphan bookings, ` +
      `${failedCount} failed, ${deleted.length} proof files deleted`
  );

  return { guestsCount, bookingsCount, failedCount, deletedFiles: deleted, failedFiles: failed };
}
