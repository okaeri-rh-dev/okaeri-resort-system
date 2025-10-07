import { createFileRoute, notFound } from "@tanstack/react-router";
import { db } from "@/lib/supabase";
import { hasAuditRole, AuditRole } from "@/lib/audit-roles";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DetailPageSkeleton } from "@/components/entity-detail/DetailPageSkeleton";
import { lazy, Suspense } from "react";

// Lazy load the edit page component
const PaymentEditPage = lazy(() =>
  import("@/components/payments/PaymentEdit").then((m) => ({
    default: m.PaymentEditPage,
  }))
);

export const Route = createFileRoute("/_authenticated/payments/$paymentId/edit")({
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

    // Prefetch payment data
    const paymentPromise = queryClient.ensureQueryData({
      queryKey: ["payment", paymentId],
      queryFn: async () => {
        const { data, error } = await db.payments.byId(paymentId);

        if (error) {
          console.error("[Payment Edit] Failed to fetch payment:", error);
          throw new Error(`Failed to load payment: ${error.message}`);
        }

        if (!data) {
          throw notFound();
        }

        return data;
      },
      staleTime: 30000, // 30 seconds
    });

    // Prefetch associated booking if payment has booking_id
    const payment = await paymentPromise;
    const bookingPromise = payment.booking_id
      ? queryClient.ensureQueryData({
          queryKey: ["booking", payment.booking_id],
          queryFn: async () => {
            const { data, error } = await db.bookings.byId(payment.booking_id!);

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
          <h1 className="text-2xl font-bold text-red-600 mb-4">Failed to Load Payment Editor</h1>
          <p className="text-gray-600 mb-4">
            {error instanceof Error ? error.message : "An unexpected error occurred"}
          </p>
          {error instanceof Error && error.message.includes("permission") ? (
            <p className="text-sm text-gray-500 mb-4">
              Please contact your administrator if you need access to edit payments.
            </p>
          ) : null}
          {error instanceof Error && error.message.includes("verified") ? (
            <p className="text-sm text-gray-500 mb-4">
              Verified payments can only be edited by administrators.
            </p>
          ) : null}
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
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Payment Not Found</h1>
        <p className="text-gray-600 mb-4">
          The payment you are trying to edit does not exist or has been removed.
        </p>
        <button
          onClick={() => window.history.back()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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
