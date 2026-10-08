import { lazy, Suspense } from "react";

import { createFileRoute } from "@tanstack/react-router";

import { DetailPageSkeleton } from "@/components/entity-detail/DetailPageSkeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuditRole, hasAuditRole } from "@/lib/audit-roles";
import { db } from "@/lib/supabase";
import { paymentDetailQuery } from "@/stores/usePaymentStore";

// Lazy load the edit page component
const PaymentEditPage = lazy(() =>
  import("@/components/payments/PaymentEdit").then((m) => ({
    default: m.PaymentEditPage,
  }))
);

export const Route = createFileRoute("/admin/payments/$paymentId/edit")({
  // Before load - check permissions
  beforeLoad: async () => {
    // Check if user has permission to edit payments (Manager or higher)
    const canEdit = await hasAuditRole(AuditRole.MANAGER);

    if (!canEdit) {
      throw new Error("You do not have permission to edit payments. Manager role required.");
    }

    return { canEdit };
  },

  // Loader function to prefetch all necessary data
  loader: async ({ params, context }) => {
    const { paymentId } = params;
    const { queryClient } = context;

    const paymentPromise = queryClient.ensureQueryData(paymentDetailQuery(paymentId));

    // Prefetch associated booking if payment has booking_id
    const payment = await paymentPromise;
    const bookingId = payment.booking_id;
    const bookingPromise = bookingId
      ? queryClient.ensureQueryData({
          queryKey: ["booking", bookingId],
          queryFn: async () => {
            const { data, error } = await db.bookings.byId(bookingId);

            if (error) {
              console.error("[Payment Edit] Failed to fetch booking:", error);
              return null;
            }

            return data;
          },
          staleTime: 30000, // 30 seconds
        })
      : Promise.resolve(null);

    // Wait for all data to be loaded
    const [, booking] = await Promise.all([paymentPromise, bookingPromise]);

    return {
      payment,
      booking,
    };
  },

  // Error component for failed data loading
  errorComponent: ({ error }) => (
    <ErrorBoundary level="page">
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-red-600">Failed to Load Payment Editor</h1>
          <p className="mb-4 text-gray-600">
            {error instanceof Error ? error.message : "An unexpected error occurred"}
          </p>
          {error instanceof Error && error.message.includes("permission") ? (
            <p className="mb-4 text-sm text-gray-500">
              Please contact your administrator if you need access to edit payments.
            </p>
          ) : null}
          {error instanceof Error && error.message.includes("verified") ? (
            <p className="mb-4 text-sm text-gray-500">
              Verified payments can only be edited by administrators.
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
        <h1 className="mb-4 text-2xl font-bold text-gray-800">Payment Not Found</h1>
        <p className="mb-4 text-gray-600">
          The payment you are trying to edit does not exist or has been removed.
        </p>
        <button
          onClick={() => window.history.back()}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Go Back to Payments
        </button>
      </div>
    </div>
  ),

  // Pending component while data is loading
  pendingComponent: () => <DetailPageSkeleton />,

  // Main component
  component: PaymentEditComponent,
});

function PaymentEditComponent() {
  return (
    <ErrorBoundary level="page">
      <Suspense fallback={<DetailPageSkeleton />}>
        <PaymentEditPage />
      </Suspense>
    </ErrorBoundary>
  );
}
