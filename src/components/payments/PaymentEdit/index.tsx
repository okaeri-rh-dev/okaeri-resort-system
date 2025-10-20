// src/components/payments/PaymentEdit/index.tsx

import { zodResolver } from "@hookform/resolvers/zod";
import { useLoaderData, useNavigate, useParams } from "@tanstack/react-router";
import { Save, X } from "lucide-react";
import { useForm } from "react-hook-form";

import { DetailPageLayout } from "@/components/entity-detail";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useEntityEdit } from "@/hooks/entity";
import { paymentEditSchema, type PaymentEditInput } from "@/lib/validation/entity-schemas";
import type { Payment } from "@/types/entity-detail.types";

export interface PaymentEditPageProps {
  payment?: Payment;
}

export function PaymentEditPage() {
  const { paymentId } = useParams({ from: "/_authenticated/payments/$paymentId/edit" });
  const { payment } = useLoaderData({ from: "/_authenticated/payments/$paymentId/edit" });
  const navigate = useNavigate();

  // Check if payment is verified (limits editing)
  // Note: payment_status field not in DB schema yet - will be added in Phase 3
  const isVerified = false;

  // Initialize form with default values from payment
  const form = useForm<PaymentEditInput>({
    resolver: zodResolver(paymentEditSchema),
    defaultValues: {
      payment_amount: payment.amount || 0,
      payment_method:
        (payment.payment_method as "Cash" | "GCash" | "BankTransfer" | "Card") || "Cash",
      payment_proof_url: payment.proof_url || "",
      notes: payment.notes || "",
    },
  });

  // Setup mutation with navigation on success
  const updatePayment = useEntityEdit("payment", paymentId, {
    onSuccess: () => {
      navigate({ to: "/payments" });
    },
  });

  // Form submission handler
  const onSubmit = (data: PaymentEditInput) => {
    updatePayment.mutate(data);
  };

  // Cancel handler
  const handleCancel = () => {
    navigate({ to: "/payments" });
  };

  return (
    <DetailPageLayout
      title="Edit Payment"
      subtitle={`Payment #${payment.payment_id.slice(0, 8)}`}
      breadcrumbs={[
        { label: "Payments", to: "/payments" },
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
            <CardContent className="space-y-4">
              {isVerified && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  Note: This payment has been verified. Amount and method are read-only.
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="payment_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          placeholder="0.00"
                          disabled={isVerified}
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>₱ Philippine Peso</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="payment_method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={isVerified}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="GCash">GCash</SelectItem>
                          <SelectItem value="BankTransfer">Bank Transfer</SelectItem>
                          <SelectItem value="Card">Credit Card</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                name="payment_proof_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proof of Payment URL (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormDescription>
                      URL to payment screenshot or receipt (image upload coming soon)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verification Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add notes about payment verification or any issues..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Internal notes for managers (automatically sanitized)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
