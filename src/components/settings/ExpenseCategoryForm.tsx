import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input, NumberInput } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCreateExpenseCategory, useUpdateExpenseCategory } from "@/hooks/useExpenseCategories";
import { sanitizeFormData } from "@/lib/security/sanitize";
import type { ExpenseCategoryConfig } from "@/types";

const expenseCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100, "Category name too long"),
  display_order: z.number().int().min(0).max(999),
  is_active: z.boolean(),
});

type ExpenseCategoryFormData = z.infer<typeof expenseCategorySchema>;

interface ExpenseCategoryFormProps {
  category?: ExpenseCategoryConfig;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ExpenseCategoryForm({ category, onSuccess, onCancel }: ExpenseCategoryFormProps) {
  const isEditMode = !!category;

  const createCategory = useCreateExpenseCategory();
  const updateCategory = useUpdateExpenseCategory();

  const form = useForm<ExpenseCategoryFormData>({
    resolver: zodResolver(expenseCategorySchema),
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: {
      name: category?.name || "",
      display_order: category?.display_order ?? 0,
      is_active: category?.is_active ?? true,
    },
  });

  const onSubmit = async (data: ExpenseCategoryFormData) => {
    const sanitizedData = sanitizeFormData(data, {
      skipFields: ["display_order", "is_active"],
    });

    const payload = {
      name: sanitizedData.name.trim(),
      display_order: sanitizedData.display_order,
      is_active: sanitizedData.is_active,
    };

    if (isEditMode && category) {
      await updateCategory.mutateAsync({ id: category.id, updates: payload });
    } else {
      await createCategory.mutateAsync(payload);
    }

    onSuccess?.();
  };

  const isLoading = createCategory.isPending || updateCategory.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Category Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category Name *</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Transportation, Equipment Rental" {...field} />
              </FormControl>
              <FormDescription>
                Unique name for this expense category (max 100 chars)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Display Order */}
        <FormField
          control={form.control}
          name="display_order"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display Order</FormLabel>
              <FormControl>
                <NumberInput
                  min={0}
                  max={999}
                  allowDecimals={false}
                  placeholder="0"
                  value={field.value}
                  onChange={(value) => field.onChange(value)}
                  onBlur={(value) => {
                    field.onChange(value || 0);
                    field.onBlur();
                  }}
                />
              </FormControl>
              <FormDescription>Lower numbers appear first in dropdowns</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Active Toggle */}
        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Active</FormLabel>
                <FormDescription>
                  When active, this category appears in expense form dropdowns
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Actions */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading
              ? isEditMode
                ? "Updating..."
                : "Creating..."
              : isEditMode
                ? "Update Category"
                : "Create Category"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
