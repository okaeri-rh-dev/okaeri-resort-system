import { lazy, Suspense, useState } from "react";

import { createFileRoute, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { z } from "zod";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/patterns";
import { requireManager } from "@/lib/route-guards";
import type { Payment } from "@/types";

// Lazy load heavy components
const PaymentsTable = lazy(() =>
  import("@/components/payments/PaymentsTable").then((m) => ({ default: m.PaymentsTable }))
);
const PaymentForm = lazy(() =>
  import("@/components/payments/PaymentForm").then((m) => ({ default: m.PaymentForm }))
);

const paymentsSearchSchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
  page: z.number().optional(),
});

export const Route = createFileRoute("/admin/payments")({
  beforeLoad: async () => {
    await requireManager();
  },
  validateSearch: paymentsSearchSchema,
  component: PaymentsPage,
});

function PaymentsPage() {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isDetailView = !!(params as any).paymentId;
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  // Navigate to dedicated detail and edit routes instead of using modals
  const handleEditPayment = (payment: Payment) => {
    navigate({ to: "/admin/payments/$paymentId/edit", params: { paymentId: payment.payment_id } });
  };

  const handleViewPayment = (payment: Payment) => {
    navigate({ to: "/admin/payments/$paymentId", params: { paymentId: payment.payment_id } });
  };

  // If we're viewing a specific payment detail, render the child route
  if (isDetailView) {
    return (
      <ErrorBoundary level="page">
        <Outlet />
      </ErrorBoundary>
    );
  }

  // Otherwise, render the payments table page
  return (
    <ErrorBoundary level="page">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
            <p className="text-muted-foreground">Track payment receipts and transactions</p>
          </div>
          <Button onClick={() => setShowPaymentForm(true)}>Record Payment</Button>
        </div>

        <ErrorBoundary level="component">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-12">
                <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
              </div>
            }
          >
            <PaymentsTable onViewPayment={handleViewPayment} onEditPayment={handleEditPayment} />
          </Suspense>
        </ErrorBoundary>

        {/* New Payment Dialog */}
        <Dialog open={showPaymentForm} onOpenChange={setShowPaymentForm}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record New Payment</DialogTitle>
            </DialogHeader>
            <ErrorBoundary level="component">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-12">
                    <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
                  </div>
                }
              >
                <PaymentForm
                  onSuccess={() => setShowPaymentForm(false)}
                  onCancel={() => setShowPaymentForm(false)}
                />
              </Suspense>
            </ErrorBoundary>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}
