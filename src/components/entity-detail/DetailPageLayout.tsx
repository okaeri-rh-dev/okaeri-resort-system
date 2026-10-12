// src/components/entity-detail/DetailPageLayout.tsx

import React from "react";

import { Link } from "@tanstack/react-router";
import { ChevronRight, Edit } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FileRoutesByTo } from "@/routeTree.gen";

/** A route path from the generated route tree, so a path that does not exist fails tsc. */
export type RoutePath = keyof FileRoutesByTo;

export type Breadcrumb = {
  label: string;
  to?: RoutePath; // If provided, renders as Link
  params?: Record<string, string>;
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
  editRoute?: { to: RoutePath; params: Record<string, string> };
  className?: string;
  testId?: string;
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
  testId,
}: DetailPageLayoutProps) {
  return (
    <div
      className={cn("container mx-auto max-w-[1400px] space-y-6 py-6", className)}
      data-testid={testId}
    >
      {/* Breadcrumbs */}
      <nav className="flex items-center space-x-2 text-sm text-neutral-600" aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={index}>
            {index > 0 && <ChevronRight className="h-4 w-4" />}
            {crumb.to ? (
              <Link
                to={crumb.to}
                params={crumb.params}
                className="transition-colors hover:text-neutral-900"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="font-medium text-neutral-900">{crumb.label}</span>
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{title}</h1>
            {status}
          </div>
          {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2">
          {actions}
          {editRoute && (
            <Link to={editRoute.to} params={editRoute.params}>
              <Button size="sm">
                <Edit className="mr-2 h-4 w-4" />
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
