import { lazy, Suspense } from "react";

import { createFileRoute, notFound } from "@tanstack/react-router";

import { DetailPageSkeleton } from "@/components/entity-detail/DetailPageSkeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuditRole, hasAuditRole } from "@/lib/audit-roles";
import { supabase } from "@/lib/supabase";

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

    // Prefetch payment data with booking relation
    const paymentPromise = queryClient.ensureQueryData({
      queryKey: ["payment", paymentId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("payments")
          .select(
            `
            *,
            booking:bookings(
              booking_id,
              booking_reference,
              check_in,
              check_out,
              total_amount,
              guest:guests(guest_name, email, contact_number)
            )
          `
          )
          .eq("payment_id", paymentId)
          .single();

        if (error) {
          console.error("[Payment Detail] Failed to fetch payment:", error);
          throw new Error(`Failed to load payment: ${error.message}`);
        }

        if (!data) {
          throw notFound();
        }

        return data;
      },
      staleTime: 30000, // 30 seconds
    });

    // Check if user has permission to view audit logs
    const canViewAudit = await hasAuditRole(AuditRole.MANAGER);

    // Prefetch audit logs only if user has permission
    const auditLogsPromise = canViewAudit
      ? queryClient.ensureQueryData({
          queryKey: ["auditLogs", "payment", paymentId],
          queryFn: async () => {
            const { data, error } = await supabase
              .from("audit_logs")
              .select("*")
              .eq("table_name", "payments")
              .eq("record_id", paymentId)
              .order("created_at", { ascending: false })
              .limit(50);

            if (error) {
              console.error("[Payment Detail] Failed to fetch audit logs:", error);
              return [];
            }

            return data || [];
          },
          staleTime: 60000, // 1 minute
        })
      : Promise.resolve([]);

    // Wait for all data to be loaded
    const [paymentData, auditLogs] = await Promise.all([paymentPromise, auditLogsPromise]);

    // Extend payment with optional fields for type compatibility
    // Note: payment_status field not yet in database schema (Phase 3)
    const payment = {
      ...paymentData,
      payment_status: undefined as string | undefined,
    } as typeof paymentData & { payment_status?: string };

    return {
      payment,
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
  const { payment } = Route.useLoaderData();

  return (
    <ErrorBoundary level="page">
      <Suspense fallback={<DetailPageSkeleton />}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <PaymentDetailPage payment={payment as any} paymentId={paymentId} />
      </Suspense>
    </ErrorBoundary>
  );
}
