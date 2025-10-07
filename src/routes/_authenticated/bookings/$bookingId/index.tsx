import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DetailPageSkeleton } from "@/components/entity-detail/DetailPageSkeleton";
import { AuditRole, hasAuditRole } from "@/lib/audit-roles";
import { db, supabase } from "@/lib/supabase";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

// Lazy load the detail page component
const BookingDetailPage = lazy(() =>
  import("@/components/bookings/BookingDetail").then((m) => ({
    default: m.BookingDetailPage,
  }))
);

export const Route = createFileRoute("/_authenticated/bookings/$bookingId/")({
  // Loader function to prefetch all necessary data
  loader: async ({ params, context }) => {
    const { bookingId } = params;
    const { queryClient } = context;

    // Prefetch booking data with relations
    const bookingPromise = queryClient.ensureQueryData({
      queryKey: ["booking", bookingId],
      queryFn: async () => {
        const { data, error } = await db.bookings.byId(bookingId);

        if (error) {
          console.error("[Booking Detail] Failed to fetch booking:", error);
          throw new Error(`Failed to load booking: ${error.message}`);
        }

        if (!data) {
          throw notFound();
        }

        // Type assertion to handle Supabase Json type compatibility
        return data as any;
      },
      staleTime: 30000, // 30 seconds
    });

    // Prefetch payments for this booking
    const paymentsPromise = queryClient.ensureQueryData({
      queryKey: ["payments", "booking", bookingId],
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
      ? queryClient.ensureQueryData({
          queryKey: ["auditLogs", "booking", bookingId],
          queryFn: async () => {
            const { data, error } = await supabase
              .from("audit_logs")
              .select("*")
              .eq("table_name", "bookings")
              .eq("record_id", bookingId)
              .order("created_at", { ascending: false })
              .limit(50);

            if (error) {
              console.error("[Booking Detail] Failed to fetch audit logs:", error);
              return [];
            }

            return data || [];
          },
          staleTime: 60000, // 1 minute
        })
      : Promise.resolve([]);

    // Wait for all data to be loaded
    const [booking, payments, auditLogs] = await Promise.all([
      bookingPromise,
      paymentsPromise,
      auditLogsPromise,
    ]);

    return {
      booking,
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
          <h1 className="text-2xl font-bold text-red-600 mb-4">Failed to Load Booking</h1>
          <p className="text-gray-600 mb-4">
            {error instanceof Error ? error.message : "An unexpected error occurred"}
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Booking Not Found</h1>
        <p className="text-gray-600 mb-4">
          The booking you are looking for does not exist or has been removed.
        </p>
        <button
          onClick={() => window.history.back()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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
  const { booking } = Route.useLoaderData();

  return (
    <ErrorBoundary level="page">
      <Suspense fallback={<DetailPageSkeleton />}>
        <BookingDetailPage booking={booking} bookingId={bookingId} />
      </Suspense>
    </ErrorBoundary>
  );
}
