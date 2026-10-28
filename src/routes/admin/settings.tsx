import { lazy, Suspense, useState } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { z } from "zod";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/patterns";
import type { ContactChannel } from "@/hooks/useContactChannels";
import { requireManager } from "@/lib/route-guards";
import type { ExpenseCategoryConfig, PaymentMethodConfig } from "@/types";

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
const ExpenseCategoriesTable = lazy(() =>
  import("@/components/settings/ExpenseCategoriesTable").then((m) => ({
    default: m.ExpenseCategoriesTable,
  }))
);
const ExpenseCategoryForm = lazy(() =>
  import("@/components/settings/ExpenseCategoryForm").then((m) => ({
    default: m.ExpenseCategoryForm,
  }))
);
const ContactChannelsTable = lazy(() =>
  import("@/components/settings/ContactChannelsTable").then((m) => ({
    default: m.ContactChannelsTable,
  }))
);
const ContactChannelForm = lazy(() =>
  import("@/components/settings/ContactChannelForm").then((m) => ({
    default: m.ContactChannelForm,
  }))
);

const DEFAULT_TAB = "payment-methods";

const settingsTabSchema = z.enum([DEFAULT_TAB, "expense-categories", "contact-channels"]);

const settingsSearchSchema = z.object({
  tab: settingsTabSchema.optional().catch(undefined),
});

export const Route = createFileRoute("/admin/settings")({
  beforeLoad: async () => {
    await requireManager();
  },
  validateSearch: settingsSearchSchema,
  component: SettingsPage,
});

const LoadingSpinner = () => (
  <div className="flex items-center justify-center py-12">
    <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
  </div>
);

function SettingsPage() {
  const { tab = DEFAULT_TAB } = Route.useSearch();
  const navigate = Route.useNavigate();

  const handleTabChange = (value: string) => {
    const nextTab = settingsTabSchema.parse(value);
    void navigate({
      search: { tab: nextTab === DEFAULT_TAB ? undefined : nextTab },
      replace: true,
    });
  };

  // Payment Methods state
  const [showForm, setShowForm] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethodConfig | null>(null);

  // Expense Categories state
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategoryConfig | null>(null);

  const [showChannelForm, setShowChannelForm] = useState(false);
  const [editingChannel, setEditingChannel] = useState<ContactChannel | null>(null);

  const handleEditMethod = (method: PaymentMethodConfig) => {
    setEditingMethod(method);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingMethod(null);
  };

  const handleEditCategory = (category: ExpenseCategoryConfig) => {
    setEditingCategory(category);
    setShowCategoryForm(true);
  };

  const handleCloseCategoryForm = () => {
    setShowCategoryForm(false);
    setEditingCategory(null);
  };

  const handleEditChannel = (channel: ContactChannel) => {
    setEditingChannel(channel);
    setShowChannelForm(true);
  };

  const handleCloseChannelForm = () => {
    setShowChannelForm(false);
    setEditingChannel(null);
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
        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
            <TabsTrigger value="expense-categories">Expense Categories</TabsTrigger>
            <TabsTrigger value="contact-channels">Contact Channels</TabsTrigger>
          </TabsList>

          <TabsContent value="payment-methods" className="space-y-4">
            {/* Section Header with Add Button */}
            <div className="medium:flex-row medium:items-center medium:justify-between flex flex-col gap-4">
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
              <Suspense fallback={<LoadingSpinner />}>
                <PaymentMethodsTable onEditMethod={handleEditMethod} />
              </Suspense>
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="expense-categories" className="space-y-4">
            {/* Section Header with Add Button */}
            <div className="medium:flex-row medium:items-center medium:justify-between flex flex-col gap-4">
              <div>
                <h2 className="text-xl font-semibold">Expense Categories</h2>
                <p className="text-muted-foreground text-sm">
                  Manage categories used for classifying expenses
                </p>
              </div>
              <Button onClick={() => setShowCategoryForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Category
              </Button>
            </div>

            {/* Expense Categories Table */}
            <ErrorBoundary level="component">
              <Suspense fallback={<LoadingSpinner />}>
                <ExpenseCategoriesTable onEditCategory={handleEditCategory} />
              </Suspense>
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="contact-channels" className="space-y-4">
            <div className="medium:flex-row medium:items-center medium:justify-between flex flex-col gap-4">
              <div>
                <h2 className="text-xl font-semibold">Contact Channels</h2>
                <p className="text-muted-foreground text-sm">
                  How guests reach you, shown on the home page and the booking confirmation
                </p>
              </div>
              <Button onClick={() => setShowChannelForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Channel
              </Button>
            </div>

            <ErrorBoundary level="component">
              <Suspense fallback={<LoadingSpinner />}>
                <ContactChannelsTable onEditChannel={handleEditChannel} />
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
              <Suspense fallback={<LoadingSpinner />}>
                <PaymentMethodForm
                  method={editingMethod || undefined}
                  onSuccess={handleCloseForm}
                  onCancel={handleCloseForm}
                />
              </Suspense>
            </ErrorBoundary>
          </DialogContent>
        </Dialog>

        {/* Expense Category Form Dialog */}
        <Dialog open={showCategoryForm} onOpenChange={handleCloseCategoryForm}>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? "Edit Expense Category" : "Add Expense Category"}
              </DialogTitle>
              <DialogDescription>
                {editingCategory
                  ? "Update the expense category details below."
                  : "Add a new category for classifying expenses."}
              </DialogDescription>
            </DialogHeader>
            <ErrorBoundary level="component">
              <Suspense fallback={<LoadingSpinner />}>
                <ExpenseCategoryForm
                  category={editingCategory || undefined}
                  onSuccess={handleCloseCategoryForm}
                  onCancel={handleCloseCategoryForm}
                />
              </Suspense>
            </ErrorBoundary>
          </DialogContent>
        </Dialog>

        <Dialog open={showChannelForm} onOpenChange={handleCloseChannelForm}>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingChannel ? "Edit Contact Channel" : "Add Contact Channel"}
              </DialogTitle>
              <DialogDescription>
                Guests see shown channels on the home page and their booking confirmation.
              </DialogDescription>
            </DialogHeader>
            <ErrorBoundary level="component">
              <Suspense fallback={<LoadingSpinner />}>
                <ContactChannelForm
                  key={editingChannel?.id ?? "new"}
                  channel={editingChannel ?? undefined}
                  onSuccess={handleCloseChannelForm}
                  onCancel={handleCloseChannelForm}
                />
              </Suspense>
            </ErrorBoundary>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}
