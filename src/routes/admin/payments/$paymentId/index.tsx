import { lazy, Suspense } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { DetailPageSkeleton } from "@/components/entity-detail/DetailPageSkeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { recentRecordAuditLogsQuery } from "@/lib/audit-hooks";
import { AuditRole, hasAuditRole } from "@/lib/audit-roles";
import { paymentDetailQuery } from "@/stores/usePaymentStore";

// Lazy load the detail page component
const PaymentDetailPage = lazy(() =>
  import("@/components/payments/PaymentDetail").then((m) => ({
    default: m.PaymentDetailPage,
  }))
);

export const Route = createFileRoute("/admin/payments/$paymentId/")({
  // Loader function to prefetch all necessary data
  loader: async ({ params, context }) => {
    const { paymentId } = params;
    const { queryClient } = context;

    const paymentPromise = queryClient.ensureQueryData(paymentDetailQuery(paymentId));

    // Check if user has permission to view audit logs
    const canViewAudit = await hasAuditRole(AuditRole.MANAGER);

    // Prefetch audit logs only if user has permission
    const auditLogsPromise = canViewAudit
      ? queryClient.ensureQueryData(recentRecordAuditLogsQuery("payments", paymentId))
      : Promise.resolve([]);

    const [, auditLogs] = await Promise.all([paymentPromise, auditLogsPromise]);

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
          <h1 className="mb-4 text-2xl font-bold text-red-600">Failed to Load Payment</h1>
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
        <h1 className="mb-4 text-2xl font-bold text-gray-800">Payment Not Found</h1>
        <p className="mb-4 text-gray-600">
          The payment you are looking for does not exist or has been removed.
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
  component: PaymentDetailComponent,
});

function PaymentDetailComponent() {
  const { paymentId } = Route.useParams();
  const { data: payment } = useSuspenseQuery(paymentDetailQuery(paymentId));

  return (
    <ErrorBoundary level="page">
      <Suspense fallback={<DetailPageSkeleton />}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <PaymentDetailPage payment={payment as any} paymentId={paymentId} />
      </Suspense>
    </ErrorBoundary>
  );
}
