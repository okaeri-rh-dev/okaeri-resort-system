import { lazy, Suspense } from "react";

import { createFileRoute } from "@tanstack/react-router";

import { DetailPageSkeleton } from "@/components/entity-detail/DetailPageSkeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/patterns";
import { AuditRole, hasAuditRole } from "@/lib/audit-roles";
import { bookingDetailQuery } from "@/stores/useBookingStore";
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

    const bookingPromise = queryClient.ensureQueryData(bookingDetailQuery(bookingId));

    // Prefetch all available units for the unit selector
    const unitsPromise = queryClient.ensureQueryData(allUnitsQuery());

    // Wait for all data to be loaded
    const [booking, units] = await Promise.all([bookingPromise, unitsPromise]);

    return {
      booking,
      units,
    };
  },

  // Error component for failed data loading
  errorComponent: ({ error }) => (
    <ErrorBoundary level="page">
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-destructive mb-4 text-2xl font-bold">
            Failed to Load Booking Editor
          </h1>
          <p className="text-muted-foreground mb-4">
            {error instanceof Error ? error.message : "An unexpected error occurred"}
          </p>
          {error instanceof Error && error.message.includes("permission") ? (
            <p className="text-muted-foreground mb-4 text-sm">
              Please contact your administrator if you need access to edit bookings.
            </p>
          ) : null}
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
          The booking you are trying to edit does not exist or has been removed.
        </p>
        <Button onClick={() => window.history.back()}>Go Back to Bookings</Button>
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
