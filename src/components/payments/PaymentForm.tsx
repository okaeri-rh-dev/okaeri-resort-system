import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { useCreatePayment, useUpdatePayment } from "@/stores/usePaymentStore";
import { useBookings } from "@/stores/useBookingStore";
import type { Payment } from "@/types";
import { formatCurrency } from "@/lib/validations";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

// Validation schema
const paymentFormSchema = z.object({
  booking_id: z.string().min(1, "Booking is required"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  payment_method: z.enum(["Cash", "GCash", "BankTransfer", "Card", "Other"]),
  payment_date: z.date(),
  reference_number: z.string().optional(),
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
    defaultValues: {
      booking_id: payment?.booking_id || bookingId || "",
      amount: payment?.amount || 0,
      payment_method: payment?.payment_method || "Cash",
      payment_date: payment ? new Date(payment.payment_date) : new Date(),
      reference_number: payment?.reference_number || "",
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
        ...data,
        payment_date: data.payment_date.toISOString(),
        payment_status: "Pending" as const,
      };

      if (isEditMode) {
        await updatePayment.mutateAsync({
          paymentId: payment.payment_id,
          updates: paymentData,
          receiptFile: receiptFile || undefined,
        });
        toast.success("Payment updated successfully");
      } else {
        await createPayment.mutateAsync({
          data: paymentData as any,
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
          render={({ field }) => (
            <FormItem>
              <FormLabel>Booking</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a booking" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {activeBookings.map((booking) => (
                    <SelectItem key={booking.booking_id} value={booking.booking_id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{booking.booking_reference}</span>
                        <span className="text-xs text-neutral-500 ml-2">
                          {booking.guest_name} - {formatCurrency(booking.total_amount)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedBooking && (
                <FormDescription>
                  Total: {formatCurrency(selectedBooking.total_amount)} | Status:{" "}
                  {selectedBooking.payment_status}
                </FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Amount */}
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                />
              </FormControl>
              <FormDescription>Enter the payment amount in PHP</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Payment Method */}
        <FormField
          control={form.control}
          name="payment_method"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Payment Method</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="GCash">GCash</SelectItem>
                  <SelectItem value="BankTransfer">Bank Transfer</SelectItem>
                  <SelectItem value="Card">Credit/Debit Card</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Reference Number */}
        {(form.watch("payment_method") === "GCash" ||
          form.watch("payment_method") === "BankTransfer") && (
          <FormField
            control={form.control}
            name="reference_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reference Number</FormLabel>
                <FormControl>
                  <Input placeholder="Enter transaction reference number" {...field} />
                </FormControl>
                <FormDescription>
                  {form.watch("payment_method") === "GCash"
                    ? "GCash transaction reference"
                    : "Bank transaction reference"}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Payment Date */}
        <FormField
          control={form.control}
          name="payment_date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Payment Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-[340px] p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date > new Date() || date < new Date("2024-01-01")}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Receipt Upload */}
        <div className="space-y-2">
          <FormLabel>Payment Receipt</FormLabel>
          <div className="border-2 border-dashed border-neutral-300 rounded-lg p-4">
            {receiptPreview ? (
              <div className="relative">
                <img
                  src={receiptPreview}
                  alt="Receipt preview"
                  className="max-h-48 mx-auto rounded"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={removeFile}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="cursor-pointer flex flex-col items-center space-y-2">
                <Upload className="h-8 w-8 text-neutral-400" />
                <span className="text-sm text-neutral-600">Click to upload receipt (Max 5MB)</span>
                <input
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
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Additional payment notes..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
