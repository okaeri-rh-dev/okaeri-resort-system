// src/components/entity-detail/DetailAuditSection.tsx

import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";

import { ActionBadge } from "@/components/audit/ActionBadge";
import { SafeAuditText } from "@/components/audit/SafeAuditText";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { recentRecordAuditLogsQuery } from "@/lib/audit-hooks";
import { formatPhilippineDate } from "@/lib/timezone";
import type { EntityType } from "@/types/entity-detail.types";

import { DetailSection } from "./DetailSection";

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
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { data: logs, isPending } = useQuery(
    recentRecordAuditLogsQuery(`${entityType}s`, entityId)
  );

  return (
    <DetailSection
      title={title}
      icon={<History className="h-5 w-5" />}
      collapsible
      defaultCollapsed={defaultCollapsed ?? isMobile}
      className={className}
    >
      {isPending ? (
        <p className="text-sm text-neutral-500">Loading history…</p>
      ) : !logs?.length ? (
        <p className="text-sm text-neutral-500">No history for this record yet</p>
      ) : (
        <ul className="divide-y divide-neutral-200">
          {logs.slice(0, limit).map((log) => (
            <li key={log.audit_id} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <ActionBadge log={log} />
                  {log.description && (
                    <SafeAuditText text={log.description} className="text-sm text-neutral-900" />
                  )}
                </div>
                <div className="text-xs text-neutral-500">{log.user_email || "System"}</div>
              </div>
              {log.created_at && (
                <time
                  dateTime={log.created_at}
                  className="shrink-0 font-mono text-xs text-neutral-500"
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
