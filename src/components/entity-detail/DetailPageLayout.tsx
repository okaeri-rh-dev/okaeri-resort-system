// src/components/entity-detail/DetailPageLayout.tsx

import React from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ChevronRight, Edit } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Breadcrumb type definition
 */
export type Breadcrumb = {
  label: string;
  to?: string; // If provided, renders as Link
};

/**
 * Props for DetailPageLayout component
 */
export interface DetailPageLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  breadcrumbs: Breadcrumb[];
  status?: React.ReactNode; // Status badge
  actions?: React.ReactNode; // Header actions
  editRoute?: { to: string; params: Record<string, string> };
  className?: string;
}

/**
 * Base layout wrapper for all entity detail pages
 *
 * Provides consistent structure with:
 * - Breadcrumb navigation
 * - Page title with optional status badge
 * - Subtitle for metadata
 * - Optional edit button
 * - Custom action buttons
 * - Content area for sections
 *
 * @example
 * ```typescript
 * <DetailPageLayout
 *   title={`Booking #${booking.booking_reference}`}
 *   subtitle={`Created ${formatDateTime(booking.created_at)}`}
 *   breadcrumbs={[
 *     { label: 'Bookings', to: '/bookings' },
 *     { label: booking.booking_reference },
 *   ]}
 *   status={<StatusBadge status={booking.booking_status} />}
 *   editRoute={{
 *     to: '/bookings/$bookingId/edit',
 *     params: { bookingId: booking.booking_id },
 *   }}
 * >
 *   <DetailSection title="Information">...</DetailSection>
 * </DetailPageLayout>
 * ```
 */
export function DetailPageLayout({
  children,
  title,
  subtitle,
  breadcrumbs,
  status,
  actions,
  editRoute,
  className,
}: DetailPageLayoutProps) {
  return (
    <div className={cn("container mx-auto py-6 space-y-6 max-w-[1400px]", className)}>
      {/* Breadcrumbs */}
      <nav className="flex items-center space-x-2 text-sm text-neutral-600" aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={index}>
            {index > 0 && <ChevronRight className="h-4 w-4" />}
            {crumb.to ? (
              <Link to={crumb.to} className="hover:text-neutral-900 transition-colors">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-neutral-900 font-medium">{crumb.label}</span>
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">{title}</h1>
            {status}
          </div>
          {subtitle && <p className="text-sm text-neutral-500 mt-1">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2">
          {actions}
          {editRoute && (
            <Link to={editRoute.to} params={editRoute.params}>
              <Button size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">{children}</div>
    </div>
  );
}
