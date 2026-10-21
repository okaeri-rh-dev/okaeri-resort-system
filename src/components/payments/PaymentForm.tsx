import React, { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Upload, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AccountSelector } from "@/components/accounts/AccountSelector";
import {
  Button,
  DatePicker,
  Form,
  FormField,
  Input,
  Label,
  SelectItem,
  Textarea,
} from "@/components/patterns";
import { formatCurrency } from "@/lib/formatters";
import { useBookings } from "@/stores/useBookingStore";
import { useCreatePayment, useUpdatePayment } from "@/stores/usePaymentStore";
import type { Payment } from "@/types";

import { SelectControl } from "./SelectControl";

// Validation schema
const paymentFormSchema = z.object({
  booking_id: z.string().min(1, "Booking is required"),
  account_id: z.string().min(1, "Receiving account is required"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  payment_method: z.enum(["Cash", "GCash", "BankTransfer", "Card", "Other"]),
  payment_date: z.date(),
  notes: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentFormSchema>;

interface PaymentFormProps {
  payment?: Payment;
  bookingId?: string; // Pre-select a booking
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const PaymentForm: React.FC<PaymentFormProps> = ({
  payment,
  bookingId,
  onSuccess,
  onCancel,
}) => {
  const isEditMode = !!payment;
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(payment?.proof_url || null);

  const createPayment = useCreatePayment();
  const updatePayment = useUpdatePayment();
  const { data: bookings = [] } = useBookings();

  // Filter out cancelled bookings
  const activeBookings = bookings.filter((b) => b.booking_status !== "Cancelled");

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: {
      booking_id: payment?.booking_id || bookingId || "",
      account_id: payment?.account_id || "",
      amount: payment?.amount || 0,
      payment_method:
        (payment?.payment_method as "Cash" | "GCash" | "BankTransfer" | "Card" | "Other") || "Cash",
      payment_date: payment?.payment_date ? new Date(payment.payment_date) : new Date(),
      notes: payment?.notes || "",
    },
  });

  const selectedBooking = activeBookings.find((b) => b.booking_id === form.watch("booking_id"));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }

      setReceiptFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeFile = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
  };

  const onSubmit = async (data: PaymentFormData) => {
    try {
      const paymentData = {
        booking_id: data.booking_id,
        account_id: data.account_id,
        amount: data.amount,
        payment_method: data.payment_method,
        payment_date: data.payment_date,
        notes: data.notes,
      };

      if (isEditMode) {
        await updatePayment.mutateAsync({
          paymentId: payment.payment_id,
          changes: paymentData,
          receiptFile: receiptFile || undefined,
        });
        toast.success("Payment updated successfully");
      } else {
        await createPayment.mutateAsync({
          input: paymentData,
          receiptFile: receiptFile || undefined,
        });
        toast.success("Payment recorded successfully");
      }

      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save payment");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Booking Selection */}
        <FormField
          control={form.control}
          name="booking_id"
          label="Booking"
          description={
            selectedBooking &&
            `Total: ${formatCurrency(selectedBooking.total_amount)} | Status: ${selectedBooking.payment_status}`
          }
        >
          {(field) => (
            <SelectControl
              value={field.value}
              onValueChange={field.onChange}
              placeholder="Select a booking"
            >
              {activeBookings.map((booking) => (
                <SelectItem key={booking.booking_id} value={booking.booking_id}>
                  <div className="flex w-full items-center justify-between">
                    <span>{booking.booking_reference}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {booking.guest_name} - {formatCurrency(booking.total_amount)}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectControl>
          )}
        </FormField>

        {/* Receiving Account */}
        <FormField
          control={form.control}
          name="account_id"
          label="Receiving Account *"
          description="Which account received this payment?"
        >
          {(field) => (
            <AccountSelector
              value={field.value}
              onChange={field.onChange}
              placeholder="Select account"
              required
            />
          )}
        </FormField>

        {/* Amount */}
        <FormField
          control={form.control}
          name="amount"
          label="Amount"
          description="Enter the payment amount in PHP"
        >
          {(field) => (
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              {...field}
              onChange={(e) => field.onChange(parseFloat(e.target.value))}
            />
          )}
        </FormField>

        {/* Payment Method */}
        <FormField control={form.control} name="payment_method" label="Payment Method">
          {(field) => (
            <SelectControl value={field.value} onValueChange={field.onChange}>
              <SelectItem value="Cash">Cash</SelectItem>
              <SelectItem value="GCash">GCash</SelectItem>
              <SelectItem value="BankTransfer">Bank Transfer</SelectItem>
              <SelectItem value="Card">Credit/Debit Card</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectControl>
          )}
        </FormField>

        {/* Payment Date */}
        <FormField
          control={form.control}
          name="payment_date"
          label="Payment Date"
          className="flex flex-col"
        >
          {(field) => (
            <DatePicker
              value={field.value}
              onChange={field.onChange}
              isDateDisabled={(date) => date > new Date() || date < new Date("2024-01-01")}
              placeholder="Pick a date"
              className="w-full"
            />
          )}
        </FormField>

        {/* Receipt Upload */}
        <div className="space-y-2">
          <Label htmlFor="payment-receipt">Payment Receipt</Label>
          <div className="rounded-lg border-2 border-dashed p-4">
            {receiptPreview ? (
              <div className="relative">
                <img
                  src={receiptPreview}
                  alt="Receipt preview"
                  width={192}
                  height={192}
                  className="mx-auto h-48 w-auto rounded object-contain"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={removeFile}
                  aria-label="Remove receipt"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center space-y-2">
                <Upload className="text-muted-foreground h-8 w-8" aria-hidden="true" />
                <span className="text-muted-foreground text-sm">
                  Click to upload receipt (Max 5MB)
                </span>
                <input
                  id="payment-receipt"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Notes */}
        <FormField control={form.control} name="notes" label="Notes (Optional)">
          {(field) => <Textarea placeholder="Additional payment notes..." {...field} />}
        </FormField>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={createPayment.isPending || updatePayment.isPending}>
            {isEditMode
              ? updatePayment.isPending
                ? "Updating..."
                : "Update Payment"
              : createPayment.isPending
                ? "Recording..."
                : "Record Payment"}
          </Button>
        </div>
      </form>
    </Form>
  );
};
