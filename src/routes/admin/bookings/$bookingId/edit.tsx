import { lazy, Suspense } from "react";

import { createFileRoute, notFound } from "@tanstack/react-router";

import { DetailPageSkeleton } from "@/components/entity-detail/DetailPageSkeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuditRole, hasAuditRole } from "@/lib/audit-roles";
import { db } from "@/lib/supabase";
import { allUnitsQuery } from "@/stores/useUnitStore";

// Lazy load the edit page component
const BookingEditPage = lazy(() =>
  import("@/components/bookings/BookingEdit").then((m) => ({
    default: m.BookingEditPage,
  }))
);

export const Route = createFileRoute("/admin/bookings/$bookingId/edit")({
  // Before load - check permissions
  beforeLoad: async () => {
    // Check if user has permission to edit bookings (Manager or higher)
    const canEdit = await hasAuditRole(AuditRole.MANAGER);

    if (!canEdit) {
      throw new Error("You do not have permission to edit bookings. Manager role required.");
    }
  },

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
          console.error("[Booking Edit] Failed to fetch booking:", error);
          throw new Error(`Failed to load booking: ${error.message}`);
        }

        if (!data) {
          throw notFound();
        }

        return data;
      },
      staleTime: 30000, // 30 seconds
    });

    // Prefetch all available units for the unit selector
    const unitsPromise = queryClient.ensureQueryData(allUnitsQuery());

    // Prefetch payments for this booking
    const paymentsPromise = queryClient.ensureQueryData({
      queryKey: ["payments", "booking", bookingId],
      queryFn: async () => {
        const { data, error } = await db.payments.byBooking(bookingId);

        if (error) {
          console.error("[Booking Edit] Failed to fetch payments:", error);
          return [];
        }

        return data || [];
      },
      staleTime: 30000, // 30 seconds
    });

    // Wait for all data to be loaded
    const [booking, units, payments] = await Promise.all([
      bookingPromise,
      unitsPromise,
      paymentsPromise,
    ]);

    return {
      booking,
      units,
      payments,
    };
  },

  // Error component for failed data loading
  errorComponent: ({ error }) => (
    <ErrorBoundary level="page">
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-red-600">Failed to Load Booking Editor</h1>
          <p className="mb-4 text-gray-600">
            {error instanceof Error ? error.message : "An unexpected error occurred"}
          </p>
          {error instanceof Error && error.message.includes("permission") ? (
            <p className="mb-4 text-sm text-gray-500">
              Please contact your administrator if you need access to edit bookings.
            </p>
          ) : null}
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
          The booking you are trying to edit does not exist or has been removed.
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
  component: BookingEditComponent,
});

function BookingEditComponent() {
  return (
    <ErrorBoundary level="page">
      <Suspense fallback={<DetailPageSkeleton />}>
        <BookingEditPage />
      </Suspense>
    </ErrorBoundary>
  );
}
