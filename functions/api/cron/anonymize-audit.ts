/**
 * HTTP endpoint for audit anonymization.
 * Triggered weekly by .github/workflows/scheduled-cleanup.yml (Bearer CRON_SECRET).
 */

import { verifyCronAuth } from "../../lib/cron-auth";
import { anonymizeAuditLogs } from "../../scheduled/anonymize-audit";

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
    console.warn("[CRON] Unauthorized anonymization attempt:", auth.error);
    return Response.json({ error: "Unauthorized", message: auth.error }, { status: 401 });
  }

  try {
    const { anonymizedCount, auditLogsBytes } = await anonymizeAuditLogs(env);

    return Response.json({
      success: true,
      anonymized_count: anonymizedCount,
      audit_logs_bytes: auditLogsBytes,
      duration_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[CRON] Audit anonymization failed:", error);

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
