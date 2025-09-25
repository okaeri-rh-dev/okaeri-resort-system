import { createFileRoute } from "@tanstack/react-router";
import { useState, lazy, Suspense } from "react";

// Lazy load heavy components
const PaymentsTable = lazy(() =>
  import("@/components/payments/PaymentsTable").then((m) => ({ default: m.PaymentsTable }))
);
const PaymentForm = lazy(() =>
  import("@/components/payments/PaymentForm").then((m) => ({ default: m.PaymentForm }))
);
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { z } from "zod";
import type { Payment } from "@/types";

const paymentsSearchSchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
  page: z.number().optional(),
});

export const Route = createFileRoute("/_authenticated/payments")({
  validateSearch: paymentsSearchSchema,
  component: PaymentsPage,
});

function PaymentsPage() {
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const handleEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setShowEditDialog(true);
  };

  const handleViewPayment = (payment: Payment) => {
    // Future: Could open a detailed view dialog
    console.log("View payment:", payment);
  };

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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            }
          >
            <PaymentsTable onViewPayment={handleViewPayment} onEditPayment={handleEditPayment} />
          </Suspense>
        </ErrorBoundary>

        {/* New Payment Dialog */}
        <Dialog open={showPaymentForm} onOpenChange={setShowPaymentForm}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record New Payment</DialogTitle>
            </DialogHeader>
            <ErrorBoundary level="component">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
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

        {/* Edit Payment Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Payment</DialogTitle>
            </DialogHeader>
            <ErrorBoundary level="component">
              {editingPayment && (
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                    </div>
                  }
                >
                  <PaymentForm
                    payment={editingPayment}
                    onSuccess={() => {
                      setShowEditDialog(false);
                      setEditingPayment(null);
                    }}
                    onCancel={() => {
                      setShowEditDialog(false);
                      setEditingPayment(null);
                    }}
                  />
                </Suspense>
              )}
            </ErrorBoundary>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}
