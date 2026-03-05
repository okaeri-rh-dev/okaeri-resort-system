import { lazy, Suspense, useState } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
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
import { requireManager } from "@/lib/route-guards";
import type { AccountWithBalance } from "@/types";

// Lazy load components for better performance
const AccountsTable = lazy(() =>
  import("@/components/accounts/AccountsTable").then((m) => ({ default: m.AccountsTable }))
);
const AccountForm = lazy(() =>
  import("@/components/accounts/AccountForm").then((m) => ({ default: m.AccountForm }))
);
const AccountsSummary = lazy(() =>
  import("@/components/accounts/AccountsSummary").then((m) => ({ default: m.AccountsSummary }))
);

const accountsSearchSchema = z.object({
  search: z.string().optional(),
  type: z.string().optional(),
});

export const Route = createFileRoute("/admin/accounts")({
  beforeLoad: async () => {
    await requireManager();
  },
  validateSearch: accountsSearchSchema,
  component: AccountsPage,
});

function AccountsPage() {
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountWithBalance | null>(null);

  const handleEditAccount = (account: AccountWithBalance) => {
    setEditingAccount(account);
    setShowAccountForm(true);
  };

  const handleCloseForm = () => {
    setShowAccountForm(false);
    setEditingAccount(null);
  };

  return (
    <ErrorBoundary level="page">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Financial Accounts</h1>
            <p className="text-muted-foreground">
              Manage bank accounts, e-wallets, and cash balances
            </p>
          </div>
          <Button onClick={() => setShowAccountForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </Button>
        </div>

        {/* Summary Card */}
        <ErrorBoundary level="component">
          <Suspense fallback={<div className="bg-muted h-48 animate-pulse rounded-lg" />}>
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-1">
                <AccountsSummary />
              </div>
              <div className="lg:col-span-2">
                {/* Placeholder for future charts/graphs */}
                <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-dashed">
                  <p className="text-muted-foreground text-sm">Balance trends chart coming soon</p>
                </div>
              </div>
            </div>
          </Suspense>
        </ErrorBoundary>

        {/* Accounts Table */}
        <ErrorBoundary level="component">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
              </div>
            }
          >
            <AccountsTable onEditAccount={handleEditAccount} />
          </Suspense>
        </ErrorBoundary>

        {/* Account Form Dialog */}
        <Dialog open={showAccountForm} onOpenChange={handleCloseForm}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingAccount ? "Edit Account" : "Add New Account"}</DialogTitle>
              <DialogDescription>
                {editingAccount
                  ? "Update the account details below."
                  : "Fill in the details to add a new financial account."}
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
                <AccountForm
                  account={editingAccount || undefined}
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
