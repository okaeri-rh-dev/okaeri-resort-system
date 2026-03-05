// src/components/expenses/ExpenseEdit.tsx

import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLoaderData, useNavigate, useParams } from "@tanstack/react-router";
import { format } from "date-fns";
import { CalendarDays, Save, X } from "lucide-react";
import { useForm, type SubmitHandler } from "react-hook-form";

import { DetailPageLayout } from "@/components/entity-detail";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import { Input, NumberInput } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useEntityEdit } from "@/hooks/entity";
import { useActiveExpenseCategories } from "@/hooks/useExpenseCategories";
import { cn } from "@/lib/utils";
import { expenseEditSchema, type ExpenseEditInput } from "@/lib/validation/entity-schemas";
import type { Expense } from "@/types/entity-detail.types";

export interface ExpenseEditPageProps {
  expense?: Expense;
}

export function ExpenseEditPage() {
  const { expenseId } = useParams({ from: "/admin/expenses/$expenseId/edit" });
  const { expense } = useLoaderData({ from: "/admin/expenses/$expenseId/edit" });
  const navigate = useNavigate();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
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
  const onSubmit: SubmitHandler<ExpenseEditInput> = (data) => {
    // Transform Date object to YYYY-MM-DD string for database
    updateExpense.mutate({
      ...data,
      date: data.expense_date.toISOString().split("T")[0],
    });
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
          to: `/admin/expenses/${expenseId}`,
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
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter expense description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.length > 0 ? (
                          categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.name}>
                              {cat.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="" disabled>
                            No categories available
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Amount & Date Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Amount & Date</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (PHP)</FormLabel>
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
                      <FormDescription>Enter the amount in Philippine Peso</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expense_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Expense Date</FormLabel>
                      <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <CalendarDays className="mr-2 h-4 w-4" />
                              {field.value ? (
                                format(new Date(field.value), "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => {
                              field.onChange(date);
                              setDatePickerOpen(false);
                            }}
                            disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter any additional notes..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      This field is automatically sanitized for security
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
              disabled={updateExpense.isPending}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button type="submit" disabled={updateExpense.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {updateExpense.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Form>
    </DetailPageLayout>
  );
}
