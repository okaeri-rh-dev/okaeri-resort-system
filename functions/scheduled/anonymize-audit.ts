/**
 * Audit retention (RA 10173): anonymizes audit rows older than 24 months.
 * The rules live in the anonymize_audit_logs SQL function; see
 * docs/plans/2026-10-18-audit-retention-design.md.
 *
 * Also logs the audit_logs size: archiving and export are deferred until it passes 50 MB.
 */

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import { createLogger } from "../lib/logger";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ENVIRONMENT?: string;
}

const SIZE_ALERT_BYTES = 50 * 1024 * 1024;

export async function anonymizeAuditLogs(
  env: Env
): Promise<{ anonymizedCount: number; auditLogsBytes: number }> {
  const logger = createLogger(env);
  const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.rpc("anonymize_audit_logs");
  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  const anonymizedCount = data?.[0]?.anonymized_count ?? 0;
  const auditLogsBytes = data?.[0]?.audit_logs_bytes ?? 0;
  const sizeMB = (auditLogsBytes / 1024 / 1024).toFixed(1);

  logger.info(`[CRON] Audit anonymization: ${anonymizedCount} rows, audit_logs is ${sizeMB} MB`);

  if (auditLogsBytes > SIZE_ALERT_BYTES) {
    logger.warn(
      `[ALERT] audit_logs is ${sizeMB} MB, past the 50 MB trigger. ` +
        `Revisit the deferred archiving/export decision in docs/plans/2026-10-18-audit-retention-design.md.`
    );
  }

  return { anonymizedCount, auditLogsBytes };
}
