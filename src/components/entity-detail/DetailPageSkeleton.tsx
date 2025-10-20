// src/components/entity-detail/DetailPageSkeleton.tsx

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Consistent loading states that preserve layout structure
 *
 * Displays loading skeletons matching the detail page layout:
 * - Breadcrumb skeleton
 * - Header skeleton with title and actions
 * - Three section skeletons with fields
 *
 * Use as `pendingComponent` in route definitions.
 *
 * @example
 * ```typescript
 * export const Route = createFileRoute('/_authenticated/bookings/$bookingId')({
 *   pendingComponent: DetailPageSkeleton,
 *   component: BookingDetailPage,
 * })
 * ```
 */
export function DetailPageSkeleton() {
  return (
    <div className="container mx-auto max-w-[1400px] space-y-6 py-6">
      {/* Breadcrumbs skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Header skeleton */}
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>

      {/* Section skeletons */}
      {[1, 2, 3].map((i) => (
        <Card key={i} className="border-neutral-200">
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3].map((j) => (
              <div key={j} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
