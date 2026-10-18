import type { AuditLog } from "@/types/audit.types";

/** Rows anonymized by the retention job (anonymize_audit_logs) carry metadata.anonymized_at. */
export function isAnonymized(log: Pick<AuditLog, "metadata">): boolean {
  const { metadata } = log;
  return (
    metadata !== null &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    "anonymized_at" in metadata
  );
}

export function auditActorLabel(
  log: Pick<AuditLog, "user_email" | "user_id" | "metadata">
): string {
  if (log.user_email) return log.user_email;
  if (log.user_id && isAnonymized(log)) return "Staff (details removed)";
  return "System";
}
