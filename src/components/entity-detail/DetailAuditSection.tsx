// src/components/entity-detail/DetailAuditSection.tsx

import { History } from "lucide-react";

import { AuditLogViewer } from "@/components/audit/AuditLogViewer";
import { useMediaQuery } from "@/hooks/useMediaQuery";
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
 * Integrate audit trail display on detail pages with entity filtering
 *
 * Wraps AuditLogViewer in a collapsible section:
 * - Automatically filters by entity type and ID
 * - Mobile-responsive (collapsed by default on mobile)
 * - Configurable entry limit
 * - Consistent styling with other sections
 *
 * @example
 * ```typescript
 * <DetailAuditSection
 *   entityType="booking"
 *   entityId={booking.booking_id}
 *   title="Booking History"
 *   defaultCollapsed={false}
 * />
 * ```
 */
export function DetailAuditSection({
  entityType: _entityType,
  entityId: _entityId,
  title = "Audit Trail",
  defaultCollapsed,
  limit: _limit = 10,
  className,
}: DetailAuditSectionProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");

  return (
    <DetailSection
      title={title}
      icon={<History className="h-5 w-5" />}
      collapsible
      defaultCollapsed={defaultCollapsed ?? isMobile}
      className={className}
    >
      <AuditLogViewer />
    </DetailSection>
  );
}
