import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import type { Logger } from "./logger";

/**
 * Deletes payment-proof files after their database references were cleared.
 * A failure is logged with the paths: nothing else points to those files any more.
 */
export async function deletePaymentProofFiles(
  supabase: SupabaseClient<Database>,
  paths: string[],
  logger: Pick<Logger, "info" | "warn">
): Promise<{ deleted: string[]; failed: string[] }> {
  if (paths.length === 0) return { deleted: [], failed: [] };

  const { error } = await supabase.storage.from("payment-proofs").remove(paths);
  if (error) {
    logger.warn(
      `[WARN] Storage deletion failed: ${error.message}. Orphaned files: ${paths.join(", ")}`
    );
    return { deleted: [], failed: paths };
  }

  logger.info(`[STORAGE] Deleted ${paths.length} payment-proof files`);
  return { deleted: paths, failed: [] };
}
