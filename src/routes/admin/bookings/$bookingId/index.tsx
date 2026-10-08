import { lazy, Suspense } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { DetailPageSkeleton } from "@/components/entity-detail/DetailPageSkeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { recentRecordAuditLogsQuery } from "@/lib/audit-hooks";
import { AuditRole, hasAuditRole } from "@/lib/audit-roles";
import { paymentKeys } from "@/lib/query-keys";
import { db } from "@/lib/supabase";
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

    // Prefetch payments for this booking
    const paymentsPromise = queryClient.ensureQueryData({
      queryKey: paymentKeys.byBooking(bookingId),
      queryFn: async () => {
        const { data, error } = await db.payments.byBooking(bookingId);

        if (error) {
          console.error("[Booking Detail] Failed to fetch payments:", error);
          return [];
        }

        return data || [];
      },
      staleTime: 30000, // 30 seconds
    });

    // Check if user has permission to view audit logs
    const canViewAudit = await hasAuditRole(AuditRole.MANAGER);

    // Prefetch audit logs only if user has permission
    const auditLogsPromise = canViewAudit
      ? queryClient.ensureQueryData(recentRecordAuditLogsQuery("bookings", bookingId))
      : Promise.resolve([]);

    // Wait for all data to be loaded
    const [, payments, auditLogs] = await Promise.all([
      bookingPromise,
      paymentsPromise,
      auditLogsPromise,
    ]);

    return {
      payments,
      auditLogs,
      canViewAudit,
    };
  },

  // Error component for failed data loading
  errorComponent: ({ error }) => (
    <ErrorBoundary level="page">
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-red-600">Failed to Load Booking</h1>
          <p className="mb-4 text-gray-600">
            {error instanceof Error ? error.message : "An unexpected error occurred"}
          </p>
          <button
            onClick={() => window.history.back()}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    </ErrorBoundary>
  ),

  // Not found component
  notFoundComponent: () => (
    <div className="container mx-auto py-8">
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-bold text-gray-800">Booking Not Found</h1>
        <p className="mb-4 text-gray-600">
          The booking you are looking for does not exist or has been removed.
        </p>
        <button
          onClick={() => window.history.back()}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Go Back to Bookings
        </button>
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
