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

const DERIVED_BOOKING_FIELDS = new Set([
  "total_amount",
  "base_amount",
  "total_surcharges",
  "unit_count",
  "is_multi_unit",
  "num_guests",
  // refresh_payment_status_on_total_change follows the total as it dips mid-swap
  "payment_status",
  "updated_at",
]);
const CABIN_PRICE_FIELDS = new Set([
  "unit_price",
  "subtotal",
  "weekend_surcharge",
  "extra_person_charge",
  "updated_at",
]);

const changesOnly = (log: AuditLog, fields: Set<string>) =>
  log.action === "UPDATE" &&
  !!log.changed_fields?.length &&
  log.changed_fields.every((field) => fields.has(field));

const totalIn = (data: AuditLog["old_data"]) =>
  data && typeof data === "object" && !Array.isArray(data) ? Number(data.total_amount) : NaN;

/** Total updates chain a→b→c, so the net change is zero when the old and new totals match as multisets; rows of one moment have no order. */
function transactionChangesTotal(bookingUpdates: AuditLog[]): boolean {
  const totalsKey = (totals: number[]) => totals.sort((a, b) => a - b).join();
  return (
    totalsKey(bookingUpdates.map((log) => totalIn(log.old_data))) !==
    totalsKey(bookingUpdates.map((log) => totalIn(log.new_data)))
  );
}

/** Hides the rows a cabin change derives. One transaction's rows share created_at, as the audit trigger stamps NOW(). */
export function hideDerivedHistoryRows(logs: AuditLog[]): AuditLog[] {
  const byTransaction = new Map<string | null, AuditLog[]>();
  for (const log of logs) {
    const transactionRows = byTransaction.get(log.created_at) ?? [];
    transactionRows.push(log);
    byTransaction.set(log.created_at, transactionRows);
  }
  const hidden = new Set<AuditLog>();

  for (const transactionRows of byTransaction.values()) {
    const bookingUpdates = transactionRows.filter(
      (log) => log.table_name === "bookings" && log.action === "UPDATE"
    );
    // set_booking_total and a recompute move the total, so all their rows show
    if (transactionChangesTotal(bookingUpdates)) continue;

    const hasCabinRow = transactionRows.some((log) => log.table_name === "booking_units");
    for (const log of transactionRows) {
      const derived =
        log.table_name === "bookings"
          ? hasCabinRow && changesOnly(log, DERIVED_BOOKING_FIELDS)
          : log.table_name === "booking_units" && changesOnly(log, CABIN_PRICE_FIELDS);
      if (derived) hidden.add(log);
    }
  }

  return logs.filter((log) => !hidden.has(log));
}
