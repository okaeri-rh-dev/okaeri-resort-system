import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Upload, X, CalendarIcon } from "lucide-react";
import { format } from "date-fns";

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
import { Input, NumberInput } from "@/components/ui/input";
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

import { useCreateExpense, useUpdateExpense, EXPENSE_CATEGORIES } from "@/stores/useExpenseStore";
import type { Expense } from "@/types";
import { cn } from "@/lib/utils";

// Validation schema
const expenseFormSchema = z.object({
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required").max(500, "Description too long"),
  amount: z.number().min(0.01, "Amount must be greater than 0").max(1000000, "Amount too large"),
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

  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: {
      category: expense?.category || "",
      description: expense?.description || "",
      amount: expense?.amount || 0,
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
      const expenseData = {
        category: data.category,
        description: data.description.trim(),
        amount: data.amount,
        date: data.expense_date.toISOString().split("T")[0], // YYYY-MM-DD format
        vendor: null, // Optional field for future use
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
        {/* Category */}
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select expense category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Choose the most appropriate category for this expense
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description *</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Monthly electricity bill, Air conditioning repair"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Brief description of the expense (max 500 characters)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      field.onChange(value || 0.01); // Set minimum on blur
                      field.onBlur();
                    }}
                  />
                </FormControl>
                <FormDescription>Enter the amount in Philippine Peso</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Expense Date */}
          <FormField
            control={form.control}
            name="expense_date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Expense Date *</FormLabel>
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
                      disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormDescription>When did this expense occur?</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Receipt Upload */}
        <div className="space-y-4">
          <FormLabel>Receipt (Optional)</FormLabel>
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
            {receiptPreview ? (
              <div className="space-y-4">
                <div className="relative inline-block">
                  <img
                    src={receiptPreview}
                    alt="Receipt preview"
                    className="max-w-full max-h-48 object-contain rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                    onClick={removeReceipt}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  {receiptFile ? receiptFile.name : "Existing receipt"}
                </div>
              </div>
            ) : (
              <div className="text-center">
                <Upload className="mx-auto h-12 w-12 text-muted-foreground/40" />
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
                <p className="mt-2 text-xs text-muted-foreground">PNG, JPG up to 5MB</p>
              </div>
            )}
          </div>
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
                  placeholder="Additional notes about this expense..."
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Any additional information about this expense (max 1000 characters)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
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
