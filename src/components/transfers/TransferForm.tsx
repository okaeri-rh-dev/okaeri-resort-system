import React from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AccountSelector } from "@/components/accounts/AccountSelector";
import { Button, DatePicker, Form, FormField, NumberInput, Textarea } from "@/components/patterns";
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="@container space-y-6">
        <div className="grid grid-cols-1 gap-4 @lg:grid-cols-[1fr_auto_1fr]">
          <FormField
            control={form.control}
            name="from_account_id"
            label="From Account *"
            description="Account to transfer money from"
          >
            {(field) => (
              <AccountSelector
                value={field.value}
                onChange={field.onChange}
                placeholder="Select source account"
                excludeAccountId={toAccountId}
                required
              />
            )}
          </FormField>

          <div className="hidden items-center justify-center @lg:flex">
            <div className="bg-muted flex size-10 items-center justify-center rounded-full">
              <ArrowRight className="text-muted-foreground size-5" aria-hidden="true" />
            </div>
          </div>

          <FormField
            control={form.control}
            name="to_account_id"
            label="To Account *"
            description="Account to transfer money to"
          >
            {(field) => (
              <AccountSelector
                value={field.value}
                onChange={field.onChange}
                placeholder="Select destination account"
                excludeAccountId={fromAccountId}
                required
              />
            )}
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-6 @lg:grid-cols-2">
          <FormField
            control={form.control}
            name="amount"
            label="Amount (PHP) *"
            description="Amount to transfer between accounts"
          >
            {(field) => (
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
            )}
          </FormField>

          <FormField
            control={form.control}
            name="transfer_date"
            label="Transfer Date *"
            description="When the transfer occurred"
            className="flex flex-col"
          >
            {(field) => (
              <DatePicker
                value={field.value}
                onChange={field.onChange}
                isDateDisabled={(date) => date > new Date() || date < new Date("2024-01-01")}
                placeholder="Pick a date"
                aria-label="Transfer date"
                className="w-full"
              />
            )}
          </FormField>
        </div>

        <FormField
          control={form.control}
          name="notes"
          label="Notes"
          description="Any additional details about this transfer"
        >
          {(field) => (
            <Textarea
              placeholder="Optional notes about this transfer (e.g., purpose, reason)..."
              className="min-h-20"
              {...field}
            />
          )}
        </FormField>

        <div className="flex justify-end gap-2">
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
