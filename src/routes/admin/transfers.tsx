import { lazy, Suspense, useState } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftRight, Plus } from "lucide-react";
import { z } from "zod";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Lazy load components for better performance
const TransfersTable = lazy(() =>
  import("@/components/transfers/TransfersTable").then((m) => ({ default: m.TransfersTable }))
);
const TransferForm = lazy(() =>
  import("@/components/transfers/TransferForm").then((m) => ({ default: m.TransferForm }))
);

const transfersSearchSchema = z.object({
  search: z.string().optional(),
  fromAccount: z.string().optional(),
  toAccount: z.string().optional(),
});

export const Route = createFileRoute("/admin/transfers")({
  validateSearch: transfersSearchSchema,
  component: TransfersPage,
});

function TransfersPage() {
  const [showTransferForm, setShowTransferForm] = useState(false);

  return (
    <ErrorBoundary level="page">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Account Transfers</h1>
            <p className="text-muted-foreground">
              Track and record money transfers between accounts
            </p>
          </div>
          <Button onClick={() => setShowTransferForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Transfer
          </Button>
        </div>

        {/* Info Card */}
        <div className="bg-muted/50 rounded-lg border p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <ArrowLeftRight className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium">About Transfers</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Transfers move money between your accounts without affecting your total balance. Use
                transfers to record when you move funds from one account to another, such as
                depositing cash into a bank account or withdrawing from the bank to petty cash.
              </p>
            </div>
          </div>
        </div>

        {/* Transfers Table */}
        <ErrorBoundary level="component">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
              </div>
            }
          >
            <TransfersTable />
          </Suspense>
        </ErrorBoundary>

        {/* Transfer Form Dialog */}
        <Dialog open={showTransferForm} onOpenChange={setShowTransferForm}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Transfer</DialogTitle>
              <DialogDescription>
                Record a transfer of funds between two accounts.
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
                <TransferForm
                  onSuccess={() => setShowTransferForm(false)}
                  onCancel={() => setShowTransferForm(false)}
                />
              </Suspense>
            </ErrorBoundary>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}
