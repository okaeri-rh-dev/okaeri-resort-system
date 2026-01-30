import React, { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ArrowRight, CalendarIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AccountSelector } from "@/components/accounts/AccountSelector";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { NumberInput } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useCreateTransfer } from "@/stores/useTransferStore";

// Validation schema
const transferFormSchema = z
  .object({
    from_account_id: z.string().min(1, "Source account is required"),
    to_account_id: z.string().min(1, "Destination account is required"),
    amount: z
      .number()
      .min(0.01, "Amount must be greater than 0")
      .max(999999999.99, "Amount too large"),
    transfer_date: z.date(),
    notes: z.string().max(500, "Notes too long").optional(),
  })
  .refine((data) => data.from_account_id !== data.to_account_id, {
    message: "Source and destination accounts must be different",
    path: ["to_account_id"],
  });

type TransferFormData = z.infer<typeof transferFormSchema>;

interface TransferFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const TransferForm: React.FC<TransferFormProps> = ({ onSuccess, onCancel }) => {
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const createTransfer = useCreateTransfer();

  const form = useForm<TransferFormData>({
    resolver: zodResolver(transferFormSchema),
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: {
      from_account_id: "",
      to_account_id: "",
      amount: undefined as unknown as number,
      transfer_date: new Date(),
      notes: "",
    },
  });

  const fromAccountId = form.watch("from_account_id");
  const toAccountId = form.watch("to_account_id");

  const onSubmit = async (data: TransferFormData) => {
    try {
      await createTransfer.mutateAsync({
        from_account_id: data.from_account_id,
        to_account_id: data.to_account_id,
        amount: data.amount,
        transfer_date: data.transfer_date.toISOString(),
        notes: data.notes?.trim() || null,
      });

      toast.success("Transfer recorded successfully");
      onSuccess?.();
      form.reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create transfer";
      toast.error(message);
      console.error("Transfer form error:", error);
    }
  };

  const isLoading = createTransfer.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Account Selection */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr,auto,1fr]">
          {/* From Account */}
          <FormField
            control={form.control}
            name="from_account_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>From Account *</FormLabel>
                <FormControl>
                  <AccountSelector
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select source account"
                    excludeAccountId={toAccountId}
                    required
                  />
                </FormControl>
                <FormDescription>Account to transfer money from</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Arrow indicator */}
          <div className="hidden items-center justify-center md:flex">
            <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-full">
              <ArrowRight className="text-muted-foreground h-5 w-5" />
            </div>
          </div>

          {/* To Account */}
          <FormField
            control={form.control}
            name="to_account_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>To Account *</FormLabel>
                <FormControl>
                  <AccountSelector
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select destination account"
                    excludeAccountId={fromAccountId}
                    required
                  />
                </FormControl>
                <FormDescription>Account to transfer money to</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Amount */}
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount (PHP) *</FormLabel>
                <FormControl>
                  <NumberInput
                    min={0.01}
                    allowDecimals={true}
                    placeholder="0.00"
                    startIcon={<span className="text-sm font-medium">₱</span>}
                    value={field.value}
                    onChange={(value) => field.onChange(value)}
                    onBlur={(value) => {
                      field.onChange(value || 0.01);
                      field.onBlur();
                    }}
                  />
                </FormControl>
                <FormDescription>Amount to transfer between accounts</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Transfer Date */}
          <FormField
            control={form.control}
            name="transfer_date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Transfer Date *</FormLabel>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
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
                      onSelect={(date) => {
                        field.onChange(date);
                        setDatePickerOpen(false);
                      }}
                      disabled={(date) => date > new Date() || date < new Date("2024-01-01")}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormDescription>When the transfer occurred</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Notes */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Optional notes about this transfer (e.g., purpose, reason)..."
                  className="min-h-[80px]"
                  {...field}
                />
              </FormControl>
              <FormDescription>Any additional details about this transfer</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Actions */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Recording..." : "Record Transfer"}
          </Button>
        </div>
      </form>
    </Form>
  );
};
