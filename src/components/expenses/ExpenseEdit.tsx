// src/components/expenses/ExpenseEdit.tsx

import { zodResolver } from "@hookform/resolvers/zod";
import { useLoaderData, useNavigate, useParams } from "@tanstack/react-router";
import { Save, X } from "lucide-react";
import { useForm, type SubmitHandler } from "react-hook-form";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DatePicker,
  DetailPageLayout,
  Form,
  FormField,
  Input,
  NumberInput,
  SelectItem,
  Textarea,
} from "@/components/patterns";
import { SelectControl } from "@/components/payments/SelectControl";
import { useEntityEdit } from "@/hooks/entity";
import { useActiveExpenseCategories } from "@/hooks/useExpenseCategories";
import { toISODateString } from "@/lib/timezone";
import { expenseEditSchema, type ExpenseEditInput } from "@/lib/validation/entity-schemas";
import type { Expense } from "@/types/entity-detail.types";

export interface ExpenseEditPageProps {
  expense?: Expense;
}

export function ExpenseEditPage() {
  const { expenseId } = useParams({ from: "/admin/expenses/$expenseId/edit" });
  const { expense } = useLoaderData({ from: "/admin/expenses/$expenseId/edit" });
  const navigate = useNavigate();
  const { data: categories = [] } = useActiveExpenseCategories();

  // Initialize form with default values from expense
  const form = useForm<ExpenseEditInput>({
    resolver: zodResolver(expenseEditSchema),
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: {
      description: expense.description || "",
      amount: expense.amount,
      expense_date: new Date(expense.expense_date),
      category: expense.category || "",
      receipt_url: expense.receipt_url || "",
      notes: expense.notes || "",
    },
  });

  // Setup mutation with navigation on success
  const updateExpense = useEntityEdit("expense", expenseId, {
    onSuccess: () => {
      navigate({ to: "/admin/expenses/$expenseId", params: { expenseId } });
    },
  });

  // Form submission handler
  const onSubmit: SubmitHandler<ExpenseEditInput> = ({ expense_date, ...rest }) => {
    updateExpense.mutate({ ...rest, date: toISODateString(expense_date) });
  };

  // Cancel handler
  const handleCancel = () => {
    navigate({ to: "/admin/expenses/$expenseId", params: { expenseId } });
  };

  return (
    <DetailPageLayout
      title="Edit Expense"
      subtitle={expense.description}
      breadcrumbs={[
        { label: "Expenses", to: "/admin/expenses" },
        {
          label: expense.description || "Expense",
          to: "/admin/expenses/$expenseId",
          params: { expenseId },
        },
        { label: "Edit" },
      ]}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Expense Details Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Expense Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="description" label="Description">
                {(field) => <Input placeholder="Enter expense description" {...field} />}
              </FormField>

              <FormField control={form.control} name="category" label="Category">
                {(field) => (
                  <SelectControl
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="Select category"
                  >
                    {categories.length > 0 ? (
                      categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>
                          {cat.name}
                        </SelectItem>
                      ))
                    ) : (
                      // Radix throws on an empty-string item value; categories are [] while loading
                      <p className="text-muted-foreground px-2 py-1.5 text-sm">
                        No categories available
                      </p>
                    )}
                  </SelectControl>
                )}
              </FormField>
            </CardContent>
          </Card>

          {/* Amount & Date Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Amount & Date</CardTitle>
            </CardHeader>
            <CardContent className="@container space-y-4">
              <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
                <FormField
                  control={form.control}
                  name="amount"
                  label="Amount (PHP)"
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
                        field.onChange(value || 0.01);
                        field.onBlur();
                      }}
                    />
                  )}
                </FormField>

                <FormField
                  control={form.control}
                  name="expense_date"
                  label="Expense Date"
                  className="flex flex-col"
                >
                  {(field) => (
                    <DatePicker
                      value={field.value ? new Date(field.value) : undefined}
                      onChange={field.onChange}
                      isDateDisabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                      placeholder="Pick a date"
                      aria-label="Expense date"
                      className="w-full"
                    />
                  )}
                </FormField>
              </div>
            </CardContent>
          </Card>

          {/* Notes Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="notes"
                label="Additional Notes (Optional)"
                description="This field is automatically sanitized for security"
              >
                {(field) => (
                  <Textarea
                    placeholder="Enter any additional notes..."
                    className="min-h-24"
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
              disabled={updateExpense.isPending}
            >
              <X className="mr-2 size-4" aria-hidden="true" />
              Cancel
            </Button>
            <Button type="submit" disabled={updateExpense.isPending}>
              <Save className="mr-2 size-4" aria-hidden="true" />
              {updateExpense.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Form>
    </DetailPageLayout>
  );
}
