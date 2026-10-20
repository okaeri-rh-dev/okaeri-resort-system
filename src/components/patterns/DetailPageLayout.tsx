import { Fragment, type ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { ChevronRight, Edit } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RoutePath } from "@/types/route-path";

import { PageHeader } from "./PageHeader";

export type Breadcrumb = {
  label: string;
  /** Renders the crumb as a link. The last crumb is the current page and has no `to`. */
  to?: RoutePath;
  params?: Record<string, string>;
};

export interface DetailPageLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  breadcrumbs: Breadcrumb[];
  /** Sits beside the title, such as a `StatusBadge`. */
  status?: ReactNode;
  actions?: ReactNode;
  /** Adds an Edit link to the actions. */
  editRoute?: { to: RoutePath; params: Record<string, string> };
  /** Placement only. */
  className?: string;
  testId?: string;
}

/**
 * The frame for an entity detail page: breadcrumbs, a `PageHeader` with status and actions,
 * then the page's `DetailSection`s.
 *
 * @example
 * ```tsx
 * <DetailPageLayout
 *   title={`Booking ${booking.booking_reference}`}
 *   breadcrumbs={[{ label: "Bookings", to: "/admin/bookings" }, { label: booking.booking_reference }]}
 *   status={<StatusBadge {...statusBadgeProps(booking.booking_status, "Pending")} />}
 *   editRoute={{ to: "/admin/bookings/$bookingId/edit", params: { bookingId: booking.id } }}
 * >
 *   <DetailSection title="Stay">…</DetailSection>
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
  const headerActions =
    actions || editRoute ? (
      <>
        {actions}
        {editRoute && (
          <Button size="sm" asChild>
            <Link to={editRoute.to} params={editRoute.params}>
              <Edit className="size-4" aria-hidden="true" />
              Edit
            </Link>
          </Button>
        )}
      </>
    ) : undefined;

  return (
    <div className={cn("space-y-6", className)} data-testid={testId}>
      <nav aria-label="Breadcrumb">
        <ol className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
          {breadcrumbs.map((crumb, index) => (
            <Fragment key={index}>
              {index > 0 && (
                <li aria-hidden="true">
                  <ChevronRight className="size-4" />
                </li>
              )}
              <li>
                {crumb.to ? (
                  <Link
                    to={crumb.to}
                    params={crumb.params}
                    className="hover:text-foreground transition-colors duration-150"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-foreground font-medium" aria-current="page">
                    {crumb.label}
                  </span>
                )}
              </li>
            </Fragment>
          ))}
        </ol>
      </nav>

      <PageHeader title={title} description={subtitle} status={status} actions={headerActions} />

      <div className="space-y-6">{children}</div>
    </div>
  );
}
