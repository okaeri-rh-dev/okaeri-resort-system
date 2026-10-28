import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import type { Logger } from "./logger";
import { deletePaymentProofFiles } from "./payment-proof-storage";

const GUEST_UPLOAD_PREFIX = "TEMP-";
const MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const LIST_PAGE_SIZE = 100;
const DELETE_BATCH_SIZE = 100;
// Keeps one run well inside the Worker time limit; the rest wait for next week.
const MAX_DELETES_PER_RUN = 500;

/**
 * Deletes guest payment screenshots that no booking or payment links to.
 * The guest form uploads before the booking exists, so removed, replaced and abandoned
 * uploads stay in the bucket under their TEMP- name (issue 93).
 */
export async function sweepOrphanedPaymentProofs(
  supabase: SupabaseClient<Database>,
  logger: Pick<Logger, "info" | "warn">,
  now: Date
): Promise<{ deleted: string[]; failed: string[]; stoppedAtCap: boolean }> {
  const { data: referenced, error } = await supabase.rpc("referenced_payment_proof_paths");
  if (error) throw new Error(`Database error: ${error.message}`);
  const referencedPaths = new Set((referenced ?? []).map((row) => row.file_path));

  const files = await listGuestUploads(supabase);

  const cutoff = now.getTime() - MIN_AGE_MS;
  const orphans = files
    .filter((file) => file.name.startsWith(GUEST_UPLOAD_PREFIX))
    .filter((file) => file.created_at !== null && Date.parse(file.created_at) < cutoff)
    .map((file) => file.name)
    .filter((name) => !referencedPaths.has(name));

  const stoppedAtCap = orphans.length > MAX_DELETES_PER_RUN;
  if (stoppedAtCap) {
    logger.warn(
      `[WARN] ${orphans.length} orphaned payment proofs found; stopped at the cap of ${MAX_DELETES_PER_RUN} this run`
    );
  }
  const toDelete = orphans.slice(0, MAX_DELETES_PER_RUN);

  const deleted: string[] = [];
  const failed: string[] = [];
  for (let start = 0; start < toDelete.length; start += DELETE_BATCH_SIZE) {
    const batch = toDelete.slice(start, start + DELETE_BATCH_SIZE);
    const result = await deletePaymentProofFiles(supabase, batch, logger);
    deleted.push(...result.deleted);
    failed.push(...result.failed);
  }
  return { deleted, failed, stoppedAtCap };
}

// Collects every page before anything is deleted, so deletes cannot shift the offsets.
async function listGuestUploads(supabase: SupabaseClient<Database>) {
  const files = [];
  for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
    const { data, error } = await supabase.storage.from("payment-proofs").list("", {
      limit: LIST_PAGE_SIZE,
      offset,
      search: GUEST_UPLOAD_PREFIX,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`Storage list error: ${error.message}`);
    files.push(...data);
    if (data.length < LIST_PAGE_SIZE) return files;
  }
}
