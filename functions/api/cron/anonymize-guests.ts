/**
 * HTTP endpoint for guest anonymization.
 * Triggered weekly by .github/workflows/scheduled-cleanup.yml (Bearer CRON_SECRET).
 * Returns 500 when any guest failed, so the workflow run fails and GitHub emails.
 */

import { verifyCronAuth } from "../../lib/cron-auth";
import { anonymizeExpiredGuests } from "../../scheduled/anonymize-guests";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CRON_SECRET: string;
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const startTime = Date.now();

  const auth = verifyCronAuth(request, env.CRON_SECRET);
  if (!auth.valid) {
    console.warn("[CRON] Unauthorized guest anonymization attempt:", auth.error);
    return Response.json({ error: "Unauthorized", message: auth.error }, { status: 401 });
  }

  try {
    const result = await anonymizeExpiredGuests(env);
    const success = result.failedCount === 0;

    return Response.json(
      {
        success,
        guests_count: result.guestsCount,
        bookings_count: result.bookingsCount,
        failed_count: result.failedCount,
        deleted_files: result.deletedFiles.length,
        failed_files: result.failedFiles,
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
      { status: success ? 200 : 500 }
    );
  } catch (error) {
    console.error("[CRON] Guest anonymization failed:", error);

    return Response.json(
      {
        success: false,
        error: "Anonymization failed",
        message: error instanceof Error ? error.message : "Unknown error",
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
