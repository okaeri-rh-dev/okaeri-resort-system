import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button, Form, FormField, Input, NumberInput } from "@/components/patterns";
import { useCreateExpenseCategory, useUpdateExpenseCategory } from "@/hooks/useExpenseCategories";
import { sanitizeFormData } from "@/lib/security/sanitize";
import type { ExpenseCategoryConfig } from "@/types";

import { ActiveSwitchField } from "./ActiveSwitchField";

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
      <form onSubmit={form.handleSubmit(onSubmit)} className="@container space-y-6">
        <FormField
          control={form.control}
          name="name"
          label="Category Name *"
          description="Unique name for this expense category (max 100 chars)"
        >
          {(field) => <Input placeholder="e.g., Transportation, Equipment Rental" {...field} />}
        </FormField>

        <FormField
          control={form.control}
          name="display_order"
          label="Display Order"
          description="Lower numbers appear first in dropdowns"
        >
          {({ value, onChange, onBlur, ...field }) => (
            <NumberInput
              {...field}
              min={0}
              max={999}
              allowDecimals={false}
              placeholder="0"
              value={value}
              onChange={(next) => onChange(next)}
              onBlur={(next) => {
                onChange(next || 0);
                onBlur();
              }}
            />
          )}
        </FormField>

        <ActiveSwitchField
          control={form.control}
          name="is_active"
          description="When active, this category appears in expense form dropdowns"
        />

        {/* Actions */}
        <div className="flex flex-col-reverse gap-2 @md:flex-row @md:justify-end">
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
