// src/components/entity-detail/DetailAuditSection.tsx

import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";

import { ActionBadge } from "@/components/audit/ActionBadge";
import { SafeAuditText } from "@/components/audit/SafeAuditText";
import { DetailSection } from "@/components/patterns";
import { auditActorLabel } from "@/lib/audit-display";
import { recentRecordAuditLogsQuery } from "@/lib/audit-hooks";
import { formatPhilippineDate } from "@/lib/timezone";
import type { EntityType } from "@/types/entity-detail.types";

/**
 * Props for DetailAuditSection component
 */
export interface DetailAuditSectionProps {
  entityType: EntityType;
  entityId: string;
  title?: string;
  defaultCollapsed?: boolean;
  limit?: number; // Number of entries to show
  className?: string; // Optional className for styling
}

/**
 * The record's own audit history on a detail page, newest first.
 * Reads the same query the detail loaders prefetch, so it renders from cache.
 *
 * @example
 * ```typescript
 * <DetailAuditSection entityType="booking" entityId={booking.booking_id} />
 * ```
 */
export function DetailAuditSection({
  entityType,
  entityId,
  title = "Audit Trail",
  defaultCollapsed,
  limit = 10,
  className,
}: DetailAuditSectionProps) {
  const { data: logs, isPending } = useQuery(
    recentRecordAuditLogsQuery(`${entityType}s`, entityId)
  );

  return (
    <DetailSection
      title={title}
      icon={<History className="h-5 w-5" />}
      collapsible
      defaultCollapsed={defaultCollapsed}
      className={className}
    >
      {isPending ? (
        <p className="text-muted-foreground text-sm">Loading history…</p>
      ) : !logs?.length ? (
        <p className="text-muted-foreground text-sm">No history for this record yet</p>
      ) : (
        <ul className="divide-border divide-y">
          {logs.slice(0, limit).map((log) => (
            <li key={log.audit_id} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <ActionBadge log={log} />
                  {log.description && (
                    <SafeAuditText text={log.description} className="text-foreground text-sm" />
                  )}
                </div>
                <div className="text-muted-foreground text-xs">{auditActorLabel(log)}</div>
              </div>
              {log.created_at && (
                <time
                  dateTime={log.created_at}
                  className="text-muted-foreground shrink-0 text-xs tabular-nums"
                >
                  {formatPhilippineDate(new Date(log.created_at), "MMM d, yyyy h:mm a")}
                </time>
              )}
            </li>
          ))}
        </ul>
      )}
    </DetailSection>
  );
}
