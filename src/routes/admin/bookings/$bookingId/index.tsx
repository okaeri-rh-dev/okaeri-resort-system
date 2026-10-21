import { lazy, Suspense } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { DetailPageSkeleton } from "@/components/entity-detail/DetailPageSkeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/patterns";
import { recentRecordAuditLogsQuery } from "@/lib/audit-hooks";
import { AuditRole, hasAuditRole } from "@/lib/audit-roles";
import { bookingDetailQuery } from "@/stores/useBookingStore";

// Lazy load the detail page component
const BookingDetailPage = lazy(() =>
  import("@/components/bookings/BookingDetail").then((m) => ({
    default: m.BookingDetailPage,
  }))
);

export const Route = createFileRoute("/admin/bookings/$bookingId/")({
  // Loader function to prefetch all necessary data
  loader: async ({ params, context }) => {
    const { bookingId } = params;
    const { queryClient } = context;

    const bookingPromise = queryClient.ensureQueryData(bookingDetailQuery(bookingId));

    // Check if user has permission to view audit logs
    const canViewAudit = await hasAuditRole(AuditRole.MANAGER);

    // Prefetch audit logs only if user has permission
    const auditLogsPromise = canViewAudit
      ? queryClient.ensureQueryData(recentRecordAuditLogsQuery("bookings", bookingId))
      : Promise.resolve([]);

    // Wait for all data to be loaded
    const [, auditLogs] = await Promise.all([bookingPromise, auditLogsPromise]);

    return {
      auditLogs,
      canViewAudit,
    };
  },

  // Error component for failed data loading
  errorComponent: ({ error }) => (
    <ErrorBoundary level="page">
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-destructive mb-4 text-2xl font-bold">Failed to Load Booking</h1>
          <p className="text-muted-foreground mb-4">
            {error instanceof Error ? error.message : "An unexpected error occurred"}
          </p>
          <Button onClick={() => window.history.back()}>Go Back</Button>
        </div>
      </div>
    </ErrorBoundary>
  ),

  // Not found component
  notFoundComponent: () => (
    <div className="container mx-auto py-8">
      <div className="text-center">
        <h1 className="text-foreground mb-4 text-2xl font-bold">Booking Not Found</h1>
        <p className="text-muted-foreground mb-4">
          The booking you are looking for does not exist or has been removed.
        </p>
        <Button onClick={() => window.history.back()}>Go Back to Bookings</Button>
      </div>
    </div>
  ),

  // Pending component while data is loading
  pendingComponent: () => <DetailPageSkeleton />,

  // Main component
  component: BookingDetailComponent,
});

function BookingDetailComponent() {
  const { bookingId } = Route.useParams();
  const { data: booking } = useSuspenseQuery(bookingDetailQuery(bookingId));

  return (
    <ErrorBoundary level="page">
      <Suspense fallback={<DetailPageSkeleton />}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <BookingDetailPage booking={booking as any} bookingId={bookingId} />
      </Suspense>
    </ErrorBoundary>
  );
}
