// src/components/expenses/ExpenseEdit/index.tsx

import { zodResolver } from "@hookform/resolvers/zod";
import { useLoaderData, useNavigate, useParams } from "@tanstack/react-router";
import { format } from "date-fns";
import { CalendarDays, Save, X } from "lucide-react";
import { useForm } from "react-hook-form";

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
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";
import { expenseEditSchema, type ExpenseEditInput } from "@/lib/validation/entity-schemas";
import type { Expense, Unit } from "@/types/entity-detail.types";

export interface ExpenseEditPageProps {
  expense?: Expense;
  units?: Unit[];
}

export function ExpenseEditPage() {
  const { expenseId } = useParams({ from: "/_authenticated/expenses/$expenseId/edit" });
  const { expense, units } = useLoaderData({ from: "/_authenticated/expenses/$expenseId/edit" });
  const navigate = useNavigate();

  // Initialize form with default values from expense
  const form = useForm<ExpenseEditInput>({
    resolver: zodResolver(expenseEditSchema),
    defaultValues: {
      description: expense.description || "",
      amount: expense.amount || 0,
      expense_date: new Date(expense.expense_date),
      category: expense.category || "",
      receipt_url: expense.receipt_url || "",
      unit_id: undefined, // unit_id not in DB schema yet - will be added in Phase 3
      notes: expense.notes || "",
    },
  });

  // Setup mutation with navigation on success
  const updateExpense = useEntityEdit("expense", expenseId, {
    onSuccess: () => {
      navigate({ to: "/expenses" });
    },
  });

  // Form submission handler
  const onSubmit = (data: ExpenseEditInput) => {
    updateExpense.mutate(data);
  };

  // Cancel handler
  const handleCancel = () => {
    navigate({ to: "/expenses" });
  };

  return (
    <DetailPageLayout
      title="Edit Expense"
      subtitle={expense.description}
      breadcrumbs={[
        { label: "Expenses", to: "/expenses" },
        { label: expense.description },
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
                      <Input
                        placeholder="Brief description of the expense"
                        maxLength={200}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>{field.value?.length || 0}/200 characters</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                          min={0}
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>₱ Philippine Peso</FormDescription>
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
                      <Popover>
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
                            onSelect={(date) => field.onChange(date)}
                            disabled={(date) => date > new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select expense category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Maintenance">Maintenance</SelectItem>
                        <SelectItem value="Utilities">Utilities</SelectItem>
                        <SelectItem value="Supplies">Supplies</SelectItem>
                        <SelectItem value="Cleaning">Cleaning</SelectItem>
                        <SelectItem value="Repairs">Repairs</SelectItem>
                        <SelectItem value="Amenities">Amenities</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Association Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Association</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="unit_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Related Unit (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a unit (if applicable)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {units?.map((unit) => (
                          <SelectItem key={unit.unit_id} value={unit.unit_id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{unit.unit_name}</span>
                              <span className="text-muted-foreground text-xs">
                                {unit.unit_code}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Link this expense to a specific unit</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Documentation Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Documentation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="receipt_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Receipt URL (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormDescription>
                      URL to receipt image (file upload coming soon)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add any additional notes or context..."
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
