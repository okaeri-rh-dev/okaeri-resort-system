import { lazy, Suspense, useState } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireManager } from "@/lib/route-guards";
import type { PaymentMethodConfig } from "@/types";

// Lazy load components for better performance
const PaymentMethodsTable = lazy(() =>
  import("@/components/settings/PaymentMethodsTable").then((m) => ({
    default: m.PaymentMethodsTable,
  }))
);
const PaymentMethodForm = lazy(() =>
  import("@/components/settings/PaymentMethodForm").then((m) => ({
    default: m.PaymentMethodForm,
  }))
);

export const Route = createFileRoute("/admin/settings")({
  beforeLoad: async () => {
    await requireManager();
  },
  component: SettingsPage,
});

function SettingsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethodConfig | null>(null);

  const handleEditMethod = (method: PaymentMethodConfig) => {
    setEditingMethod(method);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingMethod(null);
  };

  return (
    <ErrorBoundary level="page">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage resort system configuration</p>
        </div>

        {/* Tabbed Settings */}
        <Tabs defaultValue="payment-methods">
          <TabsList>
            <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
          </TabsList>

          <TabsContent value="payment-methods" className="space-y-4">
            {/* Section Header with Add Button */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Payment Methods</h2>
                <p className="text-muted-foreground text-sm">
                  Configure payment methods shown to guests on the booking page
                </p>
              </div>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Payment Method
              </Button>
            </div>

            {/* Payment Methods Table */}
            <ErrorBoundary level="component">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
                  </div>
                }
              >
                <PaymentMethodsTable onEditMethod={handleEditMethod} />
              </Suspense>
            </ErrorBoundary>
          </TabsContent>
        </Tabs>

        {/* Payment Method Form Dialog */}
        <Dialog open={showForm} onOpenChange={handleCloseForm}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingMethod ? "Edit Payment Method" : "Add Payment Method"}
              </DialogTitle>
              <DialogDescription>
                {editingMethod
                  ? "Update the payment method details below."
                  : "Add a new payment method that guests can use for bookings."}
              </DialogDescription>
            </DialogHeader>
            <ErrorBoundary level="component">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
                  </div>
                }
              >
                <PaymentMethodForm
                  method={editingMethod || undefined}
                  onSuccess={handleCloseForm}
                  onCancel={handleCloseForm}
                />
              </Suspense>
            </ErrorBoundary>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}
