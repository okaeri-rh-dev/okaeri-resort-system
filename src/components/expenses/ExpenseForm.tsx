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
  NumberInput,
  SelectItem,
  Textarea,
} from "@/components/patterns";
import { SelectControl } from "@/components/payments/SelectControl";
import { useActiveExpenseCategories } from "@/hooks/useExpenseCategories";
import { sanitizeFormData } from "@/lib/security/sanitize";
import { toISODateString } from "@/lib/timezone";
import { useCreateExpense, useUpdateExpense } from "@/stores/useExpenseStore";
import type { Expense } from "@/types";

// Validation schema
const expenseFormSchema = z.object({
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required").max(500, "Description too long"),
  amount: z.number().min(0.01, "Amount must be greater than 0").max(1000000, "Amount too large"),
  account_id: z.string().min(1, "Payment account is required"),
  expense_date: z.date(),
  notes: z.string().max(1000, "Notes too long").optional(),
});

type ExpenseFormData = z.infer<typeof expenseFormSchema>;

interface ExpenseFormProps {
  expense?: Expense;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({ expense, onSuccess, onCancel }) => {
  const isEditMode = !!expense;
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(expense?.receipt_url || null);

  const { data: categories = [] } = useActiveExpenseCategories();
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: {
      category: expense?.category || "",
      description: expense?.description || "",
      // Use undefined for new expenses so the field appears empty
      amount: expense?.amount ?? (undefined as unknown as number),
      account_id: expense?.account_id || "",
      expense_date: expense ? new Date(expense.date) : new Date(),
      notes: "",
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }

      if (!file.type.startsWith("image/")) {
        toast.error("Please upload an image file");
        return;
      }

      setReceiptFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setReceiptPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    // Reset file input
    const fileInput = document.getElementById("receipt-upload") as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const onSubmit = async (data: ExpenseFormData) => {
    try {
      // Sanitize form data to prevent XSS
      const sanitizedData = sanitizeFormData(data, {
        skipFields: ["category", "amount", "expense_date"], // Skip non-text fields
      });

      const expenseData = {
        category: sanitizedData.category,
        description: sanitizedData.description?.trim() || "",
        amount: sanitizedData.amount,
        account_id: sanitizedData.account_id,
        date: toISODateString(data.expense_date),
        receipt_url: null, // Will be set by upload function
      };

      if (isEditMode && expense) {
        await updateExpense.mutateAsync({
          expenseId: expense.expense_id,
          updates: expenseData,
          receiptFile: receiptFile || undefined,
        });
        toast.success("Expense updated successfully");
      } else {
        await createExpense.mutateAsync({
          data: expenseData,
          receiptFile: receiptFile || undefined,
        });
        toast.success("Expense created successfully");
      }

      onSuccess?.();
      form.reset();
      setReceiptFile(null);
      setReceiptPreview(null);
    } catch (error) {
      toast.error(isEditMode ? "Failed to update expense" : "Failed to create expense");
      console.error("Expense form error:", error);
    }
  };

  const isLoading = createExpense.isPending || updateExpense.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="category"
          label="Category *"
          description="Choose the most appropriate category for this expense"
        >
          {(field) => (
            <SelectControl
              value={field.value}
              onValueChange={field.onChange}
              placeholder="Select expense category"
            >
              {categories.length > 0 ? (
                categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.name}>
                    {cat.name}
                  </SelectItem>
                ))
              ) : (
                // Radix throws on an empty-string item value; categories are [] while loading
                <p className="text-muted-foreground px-2 py-1.5 text-sm">No categories available</p>
              )}
            </SelectControl>
          )}
        </FormField>

        <FormField
          control={form.control}
          name="description"
          label="Description *"
          description="Brief description of the expense (max 500 characters)"
        >
          {(field) => (
            <Input
              placeholder="e.g., Monthly electricity bill, Air conditioning repair"
              {...field}
            />
          )}
        </FormField>

        <FormField
          control={form.control}
          name="account_id"
          label="Paid From *"
          description="Which account was used to pay this expense?"
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

        <div className="@container">
          <div className="grid grid-cols-1 gap-6 @lg:grid-cols-2">
            <FormField
              control={form.control}
              name="amount"
              label="Amount (PHP) *"
              description="Enter the amount in Philippine Peso"
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
                    field.onChange(value || 0.01); // Set minimum on blur
                    field.onBlur();
                  }}
                />
              )}
            </FormField>

            <FormField
              control={form.control}
              name="expense_date"
              label="Expense Date *"
              description="When did this expense occur?"
              className="flex flex-col"
            >
              {(field) => (
                <DatePicker
                  value={field.value}
                  onChange={field.onChange}
                  isDateDisabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                  placeholder="Pick a date"
                  aria-label="Expense date"
                  className="w-full"
                />
              )}
            </FormField>
          </div>
        </div>

        {/* Receipt Upload */}
        <div className="space-y-4">
          <Label htmlFor="receipt-upload">Receipt (Optional)</Label>
          <div className="border-muted-foreground/25 rounded-lg border-2 border-dashed p-6">
            {receiptPreview ? (
              <div className="space-y-4">
                <div className="relative inline-block">
                  <img
                    src={receiptPreview}
                    alt="Receipt preview"
                    width={192}
                    height={192}
                    className="h-auto max-h-48 w-auto max-w-full rounded-lg object-contain"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute -top-2 -right-2 size-6 rounded-full p-0"
                    onClick={removeReceipt}
                    aria-label="Remove receipt"
                  >
                    <X className="size-3" aria-hidden="true" />
                  </Button>
                </div>
                <div className="text-muted-foreground text-sm">
                  {receiptFile ? receiptFile.name : "Existing receipt"}
                </div>
              </div>
            ) : (
              <div className="text-center">
                <Upload className="text-muted-foreground/40 mx-auto size-12" aria-hidden="true" />
                <div className="mt-4">
                  <Button type="button" variant="outline" asChild>
                    <label htmlFor="receipt-upload" className="cursor-pointer">
                      Upload Receipt
                    </label>
                  </Button>
                  <input
                    id="receipt-upload"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                </div>
                <p className="text-muted-foreground mt-2 text-xs">PNG, JPG up to 5MB</p>
              </div>
            )}
          </div>
        </div>

        <FormField
          control={form.control}
          name="notes"
          label="Notes"
          description="Any additional information about this expense (max 1000 characters)"
        >
          {(field) => (
            <Textarea
              placeholder="Additional notes about this expense..."
              className="min-h-24"
              {...field}
            />
          )}
        </FormField>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading
              ? isEditMode
                ? "Updating..."
                : "Creating..."
              : isEditMode
                ? "Update Expense"
                : "Create Expense"}
          </Button>
        </div>
      </form>
    </Form>
  );
};
