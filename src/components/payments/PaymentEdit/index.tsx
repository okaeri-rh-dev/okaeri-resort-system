// src/components/payments/PaymentEdit/index.tsx

import { zodResolver } from "@hookform/resolvers/zod";
import { useLoaderData, useNavigate, useParams } from "@tanstack/react-router";
import { Save, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  Button,
  Callout,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DetailPageLayout,
  Form,
  FormField,
  Input,
  SelectItem,
  Textarea,
} from "@/components/patterns";
import { paymentEditSchema, type PaymentEditInput } from "@/lib/validation/entity-schemas";
import { useUpdatePayment } from "@/stores/usePaymentStore";
import type { Payment } from "@/types/entity-detail.types";

import { SelectControl } from "../SelectControl";

export interface PaymentEditPageProps {
  payment?: Payment;
}

export function PaymentEditPage() {
  const { paymentId } = useParams({ from: "/admin/payments/$paymentId/edit" });
  const { payment } = useLoaderData({ from: "/admin/payments/$paymentId/edit" });
  const navigate = useNavigate();

  // Check if payment is verified (limits editing)
  // Note: payment_status field not in DB schema yet - will be added in Phase 3
  const isVerified = false;

  // Initialize form with default values from payment
  const form = useForm<PaymentEditInput>({
    resolver: zodResolver(paymentEditSchema),
    defaultValues: {
      amount: payment.amount || 0,
      payment_method:
        (payment.payment_method as "Cash" | "GCash" | "BankTransfer" | "Card") || "Cash",
      proof_url: payment.proof_url || "",
      notes: payment.notes || "",
    },
  });

  const updatePayment = useUpdatePayment();

  const onSubmit = ({ proof_url, ...changes }: PaymentEditInput) => {
    updatePayment.mutate(
      { paymentId, changes: { ...changes, proof_url: proof_url || null } },
      {
        onSuccess: () => {
          toast.success("Payment updated");
          navigate({ to: "/admin/payments" });
        },
        onError: (error) => {
          toast.error("Failed to update payment", { description: error.message });
        },
      }
    );
  };

  // Cancel handler
  const handleCancel = () => {
    navigate({ to: "/admin/payments" });
  };

  return (
    <DetailPageLayout
      title="Edit Payment"
      subtitle={`Payment #${payment.payment_id.slice(0, 8)}`}
      breadcrumbs={[
        { label: "Payments", to: "/admin/payments" },
        { label: `Payment #${payment.payment_id.slice(0, 8)}` },
        { label: "Edit" },
      ]}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Transaction Details Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Transaction Details</CardTitle>
            </CardHeader>
            <CardContent className="@container space-y-4">
              {isVerified && (
                <Callout tone="info">
                  Note: This payment has been verified. Amount and method are read-only.
                </Callout>
              )}

              <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
                <FormField
                  control={form.control}
                  name="amount"
                  label="Amount"
                  description="₱ Philippine Peso"
                >
                  {(field) => (
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      placeholder="0.00"
                      disabled={isVerified}
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  )}
                </FormField>

                <FormField control={form.control} name="payment_method" label="Payment Method">
                  {(field) => (
                    <SelectControl
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isVerified}
                      placeholder="Select payment method"
                    >
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="GCash">GCash</SelectItem>
                      <SelectItem value="BankTransfer">Bank Transfer</SelectItem>
                      <SelectItem value="Card">Credit Card</SelectItem>
                    </SelectControl>
                  )}
                </FormField>
              </div>
            </CardContent>
          </Card>

          {/* Status Management Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Status Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="proof_url"
                label="Proof of Payment URL (Optional)"
                description="URL to payment screenshot or receipt (image upload coming soon)"
              >
                {(field) => <Input placeholder="https://..." {...field} />}
              </FormField>

              <FormField
                control={form.control}
                name="notes"
                label="Verification Notes (Optional)"
                description="Internal notes for managers (automatically sanitized)"
              >
                {(field) => (
                  <Textarea
                    placeholder="Add notes about payment verification or any issues..."
                    className="min-h-[100px]"
                    {...field}
                  />
                )}
              </FormField>
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={updatePayment.isPending}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button type="submit" disabled={updatePayment.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {updatePayment.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Form>
    </DetailPageLayout>
  );
}
